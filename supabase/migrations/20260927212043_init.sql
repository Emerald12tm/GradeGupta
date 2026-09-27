-- ShauryaGrades initial schema.
-- One Supabase auth user (student or parent) can own several HAC student profiles.
-- Every table is protected by RLS so users only ever see their own rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles & premium entitlement
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  theme_id text not null default 'default',
  -- Premium ($5/yr). Written only by the server (RevenueCat / Stripe webhooks), never by clients.
  premium_until timestamptz,
  created_at timestamptz not null default now()
);

create function public.is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select premium_until > now() from public.profiles where id = uid), false);
$$;

-- Auto-create a profile when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- HAC student accounts (multiple per user: siblings, parents)
-- ---------------------------------------------------------------------------
create table public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade default auth.uid(),
  hac_base_url text not null,            -- https://homeaccess.<district>.org
  hac_username text not null,
  -- AES-256-GCM ciphertext; key lives only in Vercel env (HAC_CREDENTIALS_KEY). Never exposed to clients.
  hac_password_enc text not null,
  display_name text,
  avatar_path text,                      -- storage: avatars/<owner_id>/<id>.jpg
  school_name text,
  gpa_scale jsonb,                       -- overrides DEFAULT_GPA_SCALE from @sg/core
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, hac_base_url, hac_username)
);
create index on public.student_accounts (owner_id);

-- Clients may read everything except the encrypted password.
revoke select on public.student_accounts from anon, authenticated;
grant select (id, owner_id, hac_base_url, hac_username, display_name, avatar_path, school_name,
              gpa_scale, last_synced_at, created_at)
  on public.student_accounts to authenticated;
revoke insert, update on public.student_accounts from anon, authenticated;
grant update (display_name, avatar_path, gpa_scale) on public.student_accounts to authenticated;
-- Inserts (which include the encrypted password) go through the /api/hac/link route (service role).

-- ---------------------------------------------------------------------------
-- Cached HAC data (latest snapshot per student) + history for Grade Insights
-- ---------------------------------------------------------------------------
create table public.grade_snapshots (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.student_accounts on delete cascade,
  taken_at timestamptz not null default now(),
  courses jsonb not null,                -- Course[] from @sg/core
  content_hash text not null             -- skip inserting identical snapshots
);
create index on public.grade_snapshots (student_id, taken_at desc);

-- Per-course average over time (cheap to chart).
create table public.course_averages (
  student_id uuid not null references public.student_accounts on delete cascade,
  course_id text not null,
  course_name text not null,
  average numeric(6,2),
  recorded_on date not null default current_date,
  primary key (student_id, course_id, recorded_on)
);

create table public.transcripts (
  student_id uuid primary key references public.student_accounts on delete cascade,
  courses jsonb not null,                -- TranscriptCourse[]
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User-created data (synced across web + mobile)
-- ---------------------------------------------------------------------------
create table public.mock_grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_accounts on delete cascade,
  course_id text not null,
  name text not null,
  category text not null,
  score numeric not null,
  total_points numeric not null,
  created_at timestamptz not null default now()
);

create table public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_accounts on delete cascade,
  title text not null,
  notes text,
  course_id text,
  due_at timestamptz,
  estimated_minutes int,
  source text not null default 'personal' check (source in ('personal', 'hac')),
  hac_assignment_key text,               -- dedupe key for synced HAC assignments
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, hac_assignment_key)
);
create index on public.planner_tasks (student_id, due_at);

create table public.bell_schedules (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_accounts on delete cascade,
  name text not null,                    -- "A Day", "B Day", "Pep Rally"
  periods jsonb not null,                -- Period[]
  rotation_anchor date,                  -- a known A-day for A/B rotation
  created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_accounts on delete cascade,
  name text not null,                    -- "FTC Robotics", "Coding bootcamp"
  category text,                         -- club, sport, volunteer, work...
  color text,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities on delete cascade,
  logged_on date not null default current_date,
  hours numeric(5,2) not null check (hours > 0),
  note text,
  created_at timestamptz not null default now()
);
create index on public.activity_logs (activity_id, logged_on desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.student_accounts enable row level security;
alter table public.grade_snapshots enable row level security;
alter table public.course_averages enable row level security;
alter table public.transcripts enable row level security;
alter table public.mock_grades enable row level security;
alter table public.planner_tasks enable row level security;
alter table public.bell_schedules enable row level security;
alter table public.activities enable row level security;
alter table public.activity_logs enable row level security;

create policy "own profile" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Clients can only edit cosmetic columns; premium_until is server-only.
revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name, theme_id) on public.profiles to authenticated;

create policy "own students" on public.student_accounts
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Helper: does the current user own this student profile?
create function public.owns_student(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.student_accounts where id = sid and owner_id = (select auth.uid()));
$$;

-- Server-written tables: read-only for clients.
create policy "read own snapshots" on public.grade_snapshots for select using (public.owns_student(student_id));
create policy "read own averages" on public.course_averages for select using (public.owns_student(student_id));
create policy "read own transcripts" on public.transcripts for select using (public.owns_student(student_id));

-- Client-written tables.
-- "What if" grades are premium: enforced here, not just in the UI.
create policy "own mock grades" on public.mock_grades
  for all using (public.owns_student(student_id))
  with check (public.owns_student(student_id) and public.is_premium((select auth.uid())));
create policy "own tasks" on public.planner_tasks
  for all using (public.owns_student(student_id)) with check (public.owns_student(student_id));
create policy "own bell schedules" on public.bell_schedules
  for all using (public.owns_student(student_id)) with check (public.owns_student(student_id));
create policy "own activities" on public.activities
  for all using (public.owns_student(student_id)) with check (public.owns_student(student_id));
create policy "own activity logs" on public.activity_logs
  for all using (exists (select 1 from public.activities a where a.id = activity_id and public.owns_student(a.student_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and public.owns_student(a.student_id)));

-- ---------------------------------------------------------------------------
-- Realtime: web and mobile see each other's edits instantly
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.planner_tasks, public.mock_grades, public.activity_logs;

-- ---------------------------------------------------------------------------
-- Storage: profile pictures (premium), path = <owner_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
  on conflict (id) do nothing;
create policy "own avatars" on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

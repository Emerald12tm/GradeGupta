-- Follow-up to the initial schema: tighten a few grants, enforce premium avatars
-- in storage, and index the remaining foreign keys.

-- ---------------------------------------------------------------------------
-- Premium check: only answer for the calling user (don't leak others' status).
-- The server reads profiles.premium_until directly with the service role.
-- ---------------------------------------------------------------------------
create or replace function public.is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select premium_until > now() from public.profiles
      where id = uid and id = (select auth.uid())),
    false);
$$;
revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated;

revoke execute on function public.owns_student(uuid) from public, anon;
grant execute on function public.owns_student(uuid) to authenticated;

-- Profiles are created by the signup trigger and removed with the auth user.
-- Deleting one from a client would drop premium_until with no way to recreate it.
revoke delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Avatars: private bucket, images only, 2 MB max, uploads are premium-only.
-- ---------------------------------------------------------------------------
update storage.buckets
  set file_size_limit = 2 * 1024 * 1024,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';

drop policy if exists "own avatars" on storage.objects;
create policy "read own avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "premium upload avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_premium((select auth.uid())));
create policy "premium update avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_premium((select auth.uid())));

-- ---------------------------------------------------------------------------
-- Foreign-key indexes (RLS runs owns_student(student_id) on every row).
-- ---------------------------------------------------------------------------
create index if not exists mock_grades_student_course_idx on public.mock_grades (student_id, course_id);
create index if not exists bell_schedules_student_idx on public.bell_schedules (student_id);
create index if not exists activities_student_idx on public.activities (student_id);

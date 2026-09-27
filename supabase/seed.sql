-- Local-only seed data, loaded by `npx supabase db reset` (never pushed to the hosted project).
-- Creates a test login: test@example.com / password123 (premium for a year).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'test@example.com', crypt('password123', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
values (
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"test@example.com"}', 'email', now(), now(), now()
);

-- The signup trigger already created the profile; make it premium so paid features can be tested.
update public.profiles
  set display_name = 'Test Student', premium_until = now() + interval '1 year'
  where id = '11111111-1111-1111-1111-111111111111';

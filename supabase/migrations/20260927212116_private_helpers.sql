-- Trigger function: never callable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RLS helpers live in a schema PostgREST doesn't expose. Policies reference the
-- functions by OID, so existing policies keep working after the move.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_premium(uuid) set schema private;
alter function public.owns_student(uuid) set schema private;

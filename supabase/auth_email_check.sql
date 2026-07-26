-- Email registration check for Confirm page (run after profiles.sql)
-- Run in Supabase Dashboard → SQL Editor

create or replace function public.check_email_registered(target_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(target_email))
  );
$$;

revoke all on function public.check_email_registered(text) from public;
grant execute on function public.check_email_registered(text) to anon, authenticated;

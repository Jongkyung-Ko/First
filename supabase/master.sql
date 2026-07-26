-- Run in Supabase SQL Editor (after profiles.sql)

create policy "Master can view all profiles"
  on public.profiles for select
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
  );

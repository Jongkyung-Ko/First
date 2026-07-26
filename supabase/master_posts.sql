-- Run in Supabase SQL Editor (after setup_board.sql)
-- Allows Master account to edit and delete any board post

drop policy if exists "Master can update any post" on public.posts;
create policy "Master can update any post"
  on public.posts for update
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
    or auth.jwt() ->> 'email' = 'master@digitalworld.local'
  );

drop policy if exists "Master can delete any post" on public.posts;
create policy "Master can delete any post"
  on public.posts for delete
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
    or auth.jwt() ->> 'email' = 'master@digitalworld.local'
  );

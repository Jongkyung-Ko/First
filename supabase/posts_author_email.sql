-- Run in Supabase SQL Editor (after setup_board.sql)
-- Stores author login email on posts for board ID display

alter table public.posts
  add column if not exists author_email text;

update public.posts p
set author_email = pr.email
from public.profiles pr
where p.user_id = pr.id
  and p.author_email is null
  and pr.email is not null;

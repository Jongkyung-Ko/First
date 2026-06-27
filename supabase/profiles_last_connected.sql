-- Last connected timestamp for account info panel
-- Run in Supabase Dashboard → SQL Editor (after profiles.sql)

alter table public.profiles
  add column if not exists last_connected_at timestamptz;

create index if not exists profiles_last_connected_at_idx
  on public.profiles (last_connected_at desc);

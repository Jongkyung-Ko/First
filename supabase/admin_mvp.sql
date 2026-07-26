-- Admin MVP — Supabase Dashboard → SQL Editor
-- Run after profiles.sql, digimon_history.sql, master.sql

-- ---------------------------------------------------------------------------
-- Admin helper (JWT email / master role)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
      or lower(coalesce(auth.jwt() ->> 'email', '')) in (
        'maspro79@naver.com',
        'master@digitalworld.local'
      );
$$;

-- Extend profiles read for admin emails
drop policy if exists "Master can view all profiles" on public.profiles;
drop policy if exists "Admin can view all profiles" on public.profiles;

create policy "Admin can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Admin read all Digi-Mon history
drop policy if exists "Admin read all digimon history" on public.digimon_history;

create policy "Admin read all digimon history"
  on public.digimon_history for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Menu / page analytics (append-only events)
-- ---------------------------------------------------------------------------
create table if not exists public.menu_analytics (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  page_key text not null check (char_length(page_key) between 1 and 64),
  is_guest boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists menu_analytics_page_created_idx
  on public.menu_analytics (page_key, created_at desc);

create index if not exists menu_analytics_user_created_idx
  on public.menu_analytics (user_id, created_at desc)
  where user_id is not null;

create index if not exists menu_analytics_created_idx
  on public.menu_analytics (created_at desc);

alter table public.menu_analytics enable row level security;

drop policy if exists "Insert own menu analytics" on public.menu_analytics;
drop policy if exists "Insert guest menu analytics" on public.menu_analytics;
drop policy if exists "Admin read menu analytics" on public.menu_analytics;

create policy "Insert own menu analytics"
  on public.menu_analytics for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and is_guest = false
  );

create policy "Insert guest menu analytics"
  on public.menu_analytics for insert
  with check (
    auth.uid() is null
    and user_id is null
    and is_guest = true
  );

create policy "Admin read menu analytics"
  on public.menu_analytics for select
  using (public.is_admin());

-- Daily rollup view (scalable reads for admin dashboard)
create or replace view public.menu_analytics_daily as
select
  page_key,
  date_trunc('day', created_at at time zone 'Asia/Seoul')::date as day_kst,
  count(*)::bigint as click_count,
  count(distinct user_id) filter (where user_id is not null)::bigint as unique_users
from public.menu_analytics
group by 1, 2;

-- DM totals per user (for admin list joins)
create or replace view public.digimon_user_totals as
select
  user_id,
  coalesce(sum(amount) filter (where entry_type = 'spend'), 0)::bigint as dm_spent,
  coalesce(sum(amount) filter (where entry_type = 'grant'), 0)::bigint as dm_granted,
  count(*)::bigint as tx_count,
  max(created_at) as last_tx_at
from public.digimon_history
group by user_id;

notify pgrst, 'reload schema';

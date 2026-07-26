-- Web Push subscriptions for Stock Picks digest alerts
-- Run in Supabase SQL Editor after digimon_setup_all.sql

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  kr_enabled boolean not null default false,
  us_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create index if not exists push_subscriptions_kr_enabled_idx
  on public.push_subscriptions (kr_enabled)
  where kr_enabled = true;

create index if not exists push_subscriptions_us_enabled_idx
  on public.push_subscriptions (us_enabled)
  where us_enabled = true;

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create table if not exists public.notification_digest_log (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('kr', 'us')),
  trade_date date not null,
  digest_json jsonb,
  sent_at timestamptz not null default now(),
  subscriber_count integer not null default 0,
  success_count integer not null default 0,
  unique (region, trade_date)
);

alter table public.notification_digest_log enable row level security;

-- digest log: service role only (no user policies)

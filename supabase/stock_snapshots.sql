-- Global stock picks snapshots — shared across all users/devices
-- Run in Supabase SQL Editor (service role writes; anyone reads)

create table if not exists public.stock_snapshots (
  snapshot_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  source text,
  saved_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists stock_snapshots_updated_idx
  on public.stock_snapshots (updated_at desc);

alter table public.stock_snapshots enable row level security;

drop policy if exists "Anyone can read stock snapshots" on public.stock_snapshots;
create policy "Anyone can read stock snapshots"
  on public.stock_snapshots for select using (true);

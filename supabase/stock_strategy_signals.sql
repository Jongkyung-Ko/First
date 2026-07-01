-- Stock strategy live runs (Re / cron) — signal per row
-- Run in Supabase SQL Editor

create table if not exists public.stock_strategy_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_id text not null,
  run_at timestamptz not null default now(),
  source text not null default 'user_re' check (source in ('user_re', 'cron')),
  analysis_date date,
  active_count integer not null default 0,
  signal_count integer not null default 0,
  updated_at_ny timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stock_strategy_runs_strategy_run_idx
  on public.stock_strategy_runs (strategy_id, run_at desc);

create table if not exists public.stock_strategy_signals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.stock_strategy_runs (id) on delete cascade,
  strategy_id text not null,
  segment text not null check (segment in ('kospi', 'kosdaq', 'nasdaq', 'nyse')),
  ticker text not null,
  name text,
  signal_date date not null,
  pattern text,
  pattern_label text,
  close_price numeric,
  close_pct numeric,
  day_return_pct numeric,
  direction_match text,
  currency text,
  created_at timestamptz not null default now(),
  unique (run_id, segment, ticker, signal_date, pattern)
);

create index if not exists stock_strategy_signals_run_idx
  on public.stock_strategy_signals (run_id);

create index if not exists stock_strategy_signals_lookup_idx
  on public.stock_strategy_signals (strategy_id, segment, signal_date desc);

alter table public.stock_strategy_runs enable row level security;
alter table public.stock_strategy_signals enable row level security;

drop policy if exists "Anyone can read stock strategy runs" on public.stock_strategy_runs;
create policy "Anyone can read stock strategy runs"
  on public.stock_strategy_runs for select using (true);

drop policy if exists "Anyone can read stock strategy signals" on public.stock_strategy_signals;
create policy "Anyone can read stock strategy signals"
  on public.stock_strategy_signals for select using (true);

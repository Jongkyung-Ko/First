-- Stock Picks prediction accuracy history
-- Run in Supabase Dashboard → SQL Editor

create table if not exists public.stock_pick_predictions (
  id uuid primary key default gen_random_uuid(),
  trade_date date not null,
  market text not null check (market in ('kr_kospi', 'kr_kosdaq', 'us')),
  ticker text not null,
  name text,
  score integer not null,
  recommend_label text not null,
  stance text not null check (stance in ('recommend', 'watch', 'caution')),
  predicted_at timestamptz not null default now(),
  close_price numeric,
  prev_close numeric,
  change_pct numeric,
  matched boolean,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trade_date, market, ticker)
);

create index if not exists stock_pick_predictions_ticker_date_idx
  on public.stock_pick_predictions (ticker, trade_date desc);

create index if not exists stock_pick_predictions_market_date_idx
  on public.stock_pick_predictions (market, trade_date desc);

alter table public.stock_pick_predictions enable row level security;

drop policy if exists "Anyone can read stock pick predictions" on public.stock_pick_predictions;
create policy "Anyone can read stock pick predictions"
  on public.stock_pick_predictions for select
  using (true);

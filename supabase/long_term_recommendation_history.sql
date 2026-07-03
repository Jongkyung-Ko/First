-- Long-term recommendation history (max 100 rows trimmed by backend)
-- Run in Supabase SQL Editor

create table if not exists public.long_term_recommendation_history (
  id uuid primary key default gen_random_uuid(),
  recommended_at timestamptz not null default now(),
  strategy_id text not null,
  strategy_label text,
  market text,
  ticker text not null,
  name text,
  price numeric,
  metric_label text,
  metric_value text,
  created_at timestamptz not null default now()
);

create index if not exists long_term_rec_history_at_idx
  on public.long_term_recommendation_history (recommended_at desc);

create index if not exists long_term_rec_history_strategy_idx
  on public.long_term_recommendation_history (strategy_id, recommended_at desc);

alter table public.long_term_recommendation_history enable row level security;

drop policy if exists "Anyone can read long term history" on public.long_term_recommendation_history;
create policy "Anyone can read long term history"
  on public.long_term_recommendation_history for select using (true);

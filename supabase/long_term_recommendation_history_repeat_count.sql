-- 추천 이력: 동일 종목 재추천 횟수 (최초 1, 중복 시 +1)
-- Run in Supabase SQL Editor

alter table public.long_term_recommendation_history
  add column if not exists repeat_count smallint not null default 1;

create index if not exists long_term_rec_history_strategy_ticker_idx
  on public.long_term_recommendation_history (strategy_id, ticker);

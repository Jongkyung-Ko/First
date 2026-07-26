-- Add rank column to existing long_term_recommendation_history (run once if table already exists)
alter table public.long_term_recommendation_history
  add column if not exists rank smallint;

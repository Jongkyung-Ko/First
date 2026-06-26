-- Run in Supabase SQL Editor
-- Shared leaderboard for all games (top 10 per game)

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  player_name text not null check (char_length(trim(player_name)) between 1 and 24),
  score integer not null check (score >= 0),
  sort_key bigint not null,
  higher_is_better boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists game_scores_game_sort_idx
  on public.game_scores (game_id, sort_key desc);

alter table public.game_scores enable row level security;

drop policy if exists "Anyone can read game scores" on public.game_scores;
create policy "Anyone can read game scores"
  on public.game_scores for select
  using (true);

drop policy if exists "Anyone can insert game scores" on public.game_scores;
create policy "Anyone can insert game scores"
  on public.game_scores for insert
  with check (true);

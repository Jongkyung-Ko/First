-- Tour page daily editions — service role writes; anyone reads
-- Run in Supabase SQL Editor

create table if not exists public.tour_editions (
  edition_date date primary key,
  title text not null default 'Trending / Hot Place',
  places jsonb not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now()
);

create index if not exists tour_editions_refreshed_idx
  on public.tour_editions (refreshed_at desc);

alter table public.tour_editions enable row level security;

drop policy if exists "Anyone can read tour editions" on public.tour_editions;
create policy "Anyone can read tour editions"
  on public.tour_editions for select using (true);

drop policy if exists "Service role can manage tour editions" on public.tour_editions;
create policy "Service role can manage tour editions"
  on public.tour_editions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

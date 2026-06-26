-- Run in Supabase SQL Editor (after profiles.sql)

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  author_name text not null default 'Anonymous',
  author_email text,
  title text not null,
  content text not null,
  image_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

create policy "Anyone can read posts"
  on public.posts for select
  using (true);

create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

create policy "Master can update any post"
  on public.posts for update
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
    or auth.jwt() ->> 'email' = 'master@digitalworld.local'
  );

create policy "Master can delete any post"
  on public.posts for delete
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
    or auth.jwt() ->> 'email' = 'master@digitalworld.local'
  );

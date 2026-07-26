-- Run this entire script in Supabase → SQL Editor
-- Creates the board posts table + image storage bucket

-- ========== POSTS TABLE ==========
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

alter table public.posts
  add column if not exists author_email text;

create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts"
  on public.posts for select
  using (true);

drop policy if exists "Authenticated users can create posts" on public.posts;
create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own posts" on public.posts;
create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

drop policy if exists "Master can update any post" on public.posts;
create policy "Master can update any post"
  on public.posts for update
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
    or auth.jwt() ->> 'email' = 'master@digitalworld.local'
  );

drop policy if exists "Master can delete any post" on public.posts;
create policy "Master can delete any post"
  on public.posts for delete
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master'
    or auth.jwt() ->> 'email' = 'master@digitalworld.local'
  );

-- ========== IMAGE STORAGE ==========
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read post images" on storage.objects;
create policy "Public read post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

drop policy if exists "Authenticated users upload post images" on storage.objects;
create policy "Authenticated users upload post images"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Users delete own post images" on storage.objects;
create policy "Users delete own post images"
  on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

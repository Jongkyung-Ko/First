-- Run in Supabase SQL Editor (after posts.sql)

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

create policy "Public read post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "Authenticated users upload post images"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.role() = 'authenticated'
  );

create policy "Users delete own post images"
  on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

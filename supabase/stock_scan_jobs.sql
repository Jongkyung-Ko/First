-- 전역 Stock Picks Re 스캔 Job (동시 running 1건만)
-- Supabase SQL Editor에서 실행

create table if not exists public.stock_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  target_label text not null default '',
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  step int not null default 0,
  total_steps int not null default 4,
  step_label text,
  started_by uuid references auth.users (id) on delete set null,
  error_message text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists stock_scan_jobs_status_updated_idx
  on public.stock_scan_jobs (status, updated_at desc);

create unique index if not exists stock_scan_jobs_single_running_idx
  on public.stock_scan_jobs ((true))
  where status = 'running';

alter table public.stock_scan_jobs enable row level security;

create policy "service role all stock_scan_jobs"
  on public.stock_scan_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

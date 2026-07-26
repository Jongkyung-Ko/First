-- Digi-Mon transaction history — run after digimon_setup_all.sql

create table if not exists public.digimon_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  amount integer not null check (amount > 0),
  entry_type text not null check (entry_type in ('spend', 'grant')),
  reason text not null default ''
);

create index if not exists digimon_history_user_created_idx
  on public.digimon_history (user_id, created_at desc);

alter table public.digimon_history enable row level security;

drop policy if exists "Users read own digimon history" on public.digimon_history;

create policy "Users read own digimon history"
  on public.digimon_history
  for select
  using (auth.uid() = user_id);

create or replace function public.spend_digimon(amount integer, p_reason text default '사용')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
  v_reason text := coalesce(nullif(trim(p_reason), ''), '사용');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if amount is null or amount < 1 then
    raise exception 'Invalid amount';
  end if;

  select digimon into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_balance < amount then
    raise exception 'Insufficient Digi-Mon';
  end if;

  perform set_config('app.digimon_system', 'true', true);

  update public.profiles
  set digimon = digimon - amount
  where id = v_uid
  returning digimon into v_balance;

  insert into public.digimon_history (user_id, amount, entry_type, reason)
  values (v_uid, amount, 'spend', v_reason);

  return v_balance;
end;
$$;

create or replace function public.grant_digimon(amount integer, p_reason text default '충전')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
  v_reason text := coalesce(nullif(trim(p_reason), ''), '충전');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if amount is null or amount < 1 then
    raise exception 'Invalid amount';
  end if;

  perform set_config('app.digimon_system', 'true', true);

  update public.profiles
  set digimon = digimon + amount
  where id = v_uid
  returning digimon into v_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.digimon_history (user_id, amount, entry_type, reason)
  values (v_uid, amount, 'grant', v_reason);

  return v_balance;
end;
$$;

create or replace function public.ensure_digimon_zero_refill()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
  v_last date;
  v_today date := (timezone('Asia/Seoul', now()))::date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select digimon, digimon_last_zero_refill_date
  into v_balance, v_last
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_balance > 0 then
    return v_balance;
  end if;

  if v_last is null or v_last < v_today then
    perform set_config('app.digimon_system', 'true', true);

    update public.profiles
    set
      digimon = 3,
      digimon_last_zero_refill_date = v_today
    where id = v_uid
    returning digimon into v_balance;

    insert into public.digimon_history (user_id, amount, entry_type, reason)
    values (v_uid, 3, 'grant', '0개 일일 충전 (한국 시간 24시)');
  end if;

  return v_balance;
end;
$$;

revoke all on function public.spend_digimon(integer, text) from public;
revoke all on function public.grant_digimon(integer, text) from public;
grant execute on function public.spend_digimon(integer, text) to authenticated;
grant execute on function public.grant_digimon(integer, text) to authenticated;

notify pgrst, 'reload schema';

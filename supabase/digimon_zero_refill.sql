-- Stock Picks: daily +3 Digi-Mon when balance is 0 (next KST calendar day)
-- Run in Supabase SQL Editor after digimon_setup_all.sql

alter table public.profiles
  add column if not exists digimon_last_zero_refill_date date;

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
  end if;

  return v_balance;
end;
$$;

revoke all on function public.ensure_digimon_zero_refill() from public;
grant execute on function public.ensure_digimon_zero_refill() to authenticated;

notify pgrst, 'reload schema';

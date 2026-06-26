-- Run in Supabase SQL Editor (after digimon.sql)

create or replace function public.protect_digimon_on_profile_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.digimon_system', true), '') = 'true' then
    return NEW;
  end if;

  if NEW.digimon is distinct from OLD.digimon then
    NEW.digimon := OLD.digimon;
  end if;
  return NEW;
end;
$$;

create or replace function public.spend_digimon(amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
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

  return v_balance;
end;
$$;

create or replace function public.grant_digimon(amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
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

  return v_balance;
end;
$$;

revoke all on function public.spend_digimon(integer) from public;
revoke all on function public.grant_digimon(integer) from public;
grant execute on function public.spend_digimon(integer) to authenticated;
grant execute on function public.grant_digimon(integer) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Digi-Mon FULL SETUP — Supabase Dashboard → SQL Editor → Run
-- (digimon.sql + digimon_game.sql combined)
-- ============================================================

alter table public.profiles
  add column if not exists digimon integer not null default 100
  check (digimon >= 0);

update public.profiles
set digimon = 100
where digimon is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, digimon)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    100
  );
  return new;
end;
$$;

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

drop trigger if exists protect_digimon_update on public.profiles;

create trigger protect_digimon_update
  before update on public.profiles
  for each row execute function public.protect_digimon_on_profile_update();

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

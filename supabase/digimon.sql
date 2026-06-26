-- Run in Supabase Dashboard → SQL Editor (after profiles.sql)

alter table public.profiles
  add column if not exists digimon integer not null default 100
  check (digimon >= 0);

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

update public.profiles
set digimon = 100
where digimon is null;

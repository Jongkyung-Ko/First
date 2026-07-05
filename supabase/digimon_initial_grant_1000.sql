-- Run in Supabase Dashboard → SQL Editor
-- 신규 가입 초기 Digi-Mon 지급: 100 → 1000

alter table public.profiles
  alter column digimon set default 1000;

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
    1000
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';

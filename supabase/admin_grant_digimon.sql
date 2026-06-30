-- 관리자: 이메일로 Digi-Mon 충전 (Supabase SQL Editor에서 1회 실행)
-- service_role 키 또는 SQL Editor에서만 호출하세요.

create or replace function public.admin_grant_digimon_by_email(
  p_email text,
  p_amount integer,
  p_reason text default '관리자 충전'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_balance integer;
  v_reason text := coalesce(nullif(trim(p_reason), ''), '관리자 충전');
begin
  if p_email is null or trim(p_email) = '' then
    raise exception 'Email is required';
  end if;

  if p_amount is null or p_amount < 1 then
    raise exception 'Invalid amount';
  end if;

  select id into v_uid
  from public.profiles
  where lower(email) = lower(trim(p_email));

  if v_uid is null then
    raise exception 'Profile not found: %', p_email;
  end if;

  perform set_config('app.digimon_system', 'true', true);

  update public.profiles
  set digimon = digimon + p_amount
  where id = v_uid
  returning digimon into v_balance;

  insert into public.digimon_history (user_id, amount, entry_type, reason)
  values (v_uid, p_amount, 'grant', v_reason);

  return v_balance;
end;
$$;

revoke all on function public.admin_grant_digimon_by_email(text, integer, text) from public;
grant execute on function public.admin_grant_digimon_by_email(text, integer, text) to service_role;

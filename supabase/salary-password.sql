-- ============================================================================
-- Salary page password gate. The password hash lives in app_config and is
-- NEVER exposed to the browser — all access is via SECURITY DEFINER functions:
--   • verify_salary_password(pw)  -> boolean   (any signed-in user, to unlock)
--   • set_salary_password(new_pw) -> void      (ONLY the salary admin)
--   • salary_password_is_set()    -> boolean
-- Change the admin email in is_salary_admin() below to move ownership.
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_config (
  key        text primary key,
  value      text,
  updated_by text,
  updated_at timestamptz default now()
);
alter table public.app_config enable row level security;
-- No policies on purpose: direct table access is blocked for everyone; only the
-- definer functions below can read/write it.

-- The only account allowed to set/reset the salary password.
create or replace function public.is_salary_admin()
returns boolean language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'vraj@astrico.ai';
$$;

create or replace function public.salary_password_is_set()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.app_config where key = 'salary_password_hash');
$$;

create or replace function public.set_salary_password(new_pw text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_salary_admin() then
    raise exception 'Only the salary administrator can set this password';
  end if;
  if length(coalesce(new_pw, '')) < 4 then
    raise exception 'Password must be at least 4 characters';
  end if;
  insert into public.app_config (key, value, updated_by, updated_at)
  values ('salary_password_hash', crypt(new_pw, gen_salt('bf')), auth.jwt() ->> 'email', now())
  on conflict (key) do update
    set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function public.verify_salary_password(pw text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare stored text;
begin
  select value into stored from public.app_config where key = 'salary_password_hash';
  if stored is null then return false; end if;
  return stored = crypt(pw, stored);
end $$;

grant execute on function public.is_salary_admin()            to authenticated;
grant execute on function public.salary_password_is_set()     to authenticated;
grant execute on function public.set_salary_password(text)    to authenticated;
grant execute on function public.verify_salary_password(text) to authenticated;

-- ============================================================================
-- Access management: explicit user allow-list + per-capability permissions.
-- Replaces the old "any @astrico.ai" rule. Only users in app_users (active)
-- can log in; admin (vraj@astrico.ai) manages everyone.
-- ============================================================================
create table if not exists public.app_users (
  email       text primary key,
  name        text,
  is_active   boolean default true,
  is_admin    boolean default false,
  permissions text[] default '{}',
  created_by  text,
  created_at  timestamptz default now()
);
alter table public.app_users enable row level security;

-- The single super-admin (manages users; only one who can approve invoices).
create or replace function public.is_app_admin()
returns boolean language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'vraj@astrico.ai';
$$;

-- Allow-list gate used by every table's RLS. Now backed by app_users, so
-- removing someone here removes their access everywhere. (Replaces the old
-- domain check — astricoai@gmail.com no longer has access.)
create or replace function public.is_allowed_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_admin()
      or exists (select 1 from public.app_users
                 where lower(email) = lower(auth.jwt() ->> 'email') and is_active);
$$;

-- Does the caller hold a capability? Admin holds all.
create or replace function public.has_perm(cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_admin()
      or exists (select 1 from public.app_users
                 where lower(email) = lower(auth.jwt() ->> 'email') and is_active
                   and cap = any (permissions));
$$;

-- RLS: a user can read their own row; the admin can read/write everyone.
-- Writes are limited to @astrico.ai addresses.
drop policy if exists app_users_self on public.app_users;
create policy app_users_self on public.app_users for select to authenticated
  using (public.is_app_admin() or lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists app_users_admin_write on public.app_users;
create policy app_users_admin_write on public.app_users for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin() and email ilike '%@astrico.ai');

grant all on table public.app_users to authenticated;
grant execute on function public.is_app_admin()   to authenticated;
grant execute on function public.is_allowed_user() to authenticated;
grant execute on function public.has_perm(text)    to authenticated;

-- Seed the admin.
insert into public.app_users (email, name, is_active, is_admin, permissions, created_by)
values ('vraj@astrico.ai', 'Vraj Sheth', true, true, '{}', 'system')
on conflict (email) do update set is_admin = true, is_active = true;

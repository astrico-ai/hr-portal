-- ============================================================================
-- Per-user PROJECT scoping — PHASE 1 (safe, changes no access yet).
-- Adds a per-user list of projects they may access + helper functions. RLS is
-- NOT tightened here (that's phase 2, project-scoping-enforce.sql) so nothing
-- changes until you've assigned projects to each user in Access Management.
-- Model: admin sees everything; a non-admin sees ONLY their assigned projects
-- (and the parent clients / invoices / POs of those projects). Empty list =
-- sees nothing (locked down by default).
-- Run once in the Supabase SQL Editor.
-- ============================================================================

alter table public.app_users
  add column if not exists project_ids bigint[] not null default '{}';

-- Projects the current signed-in user may access ('{}' if none / not found).
create or replace function public.my_project_ids()
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select project_ids from public.app_users
     where lower(email) = lower(auth.jwt() ->> 'email') and is_active),
    '{}'::bigint[]
  );
$$;

-- Admin sees all; otherwise only assigned projects.
create or replace function public.can_see_project(pid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_admin() or pid = any (public.my_project_ids());
$$;

-- A client is visible when the user can see at least one of its projects.
create or replace function public.can_see_client(cid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_admin()
      or exists (select 1 from public.projects p
                 where p.client_id = cid and p.id = any (public.my_project_ids()));
$$;

grant execute on function public.my_project_ids()      to authenticated;
grant execute on function public.can_see_project(bigint) to authenticated;
grant execute on function public.can_see_client(bigint)  to authenticated;

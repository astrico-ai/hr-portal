-- ============================================================================
-- Per-user PROJECT scoping — PHASE 2 (enforcement — run LAST).
-- Only after project-scoping.sql has run, the app is deployed, AND you've
-- assigned projects to every non-admin user in Access Management. This swaps
-- each data table's flat allow-list policy for a scoped one:
--   • projects / billable_items / purchase_orders  -> only assigned projects
--   • clients / client_documents                   -> only clients that own an
--                                                     assigned project
-- Admin keeps full access. audit_log stays on the flat allow-list.
--
-- To ROLL BACK (revert to everyone-sees-everything), re-run rls-allowlist.sql.
-- Run once in the Supabase SQL Editor.
-- ============================================================================

-- projects: scoped by the project id itself
drop policy if exists allowlist_all on public.projects;
drop policy if exists scoped_all    on public.projects;
create policy scoped_all on public.projects for all to authenticated
  using (public.is_allowed_user() and public.can_see_project(id))
  with check (public.is_allowed_user() and public.can_see_project(id));

-- billable_items: scoped by their project
drop policy if exists allowlist_all on public.billable_items;
drop policy if exists scoped_all    on public.billable_items;
create policy scoped_all on public.billable_items for all to authenticated
  using (public.is_allowed_user() and public.can_see_project(project_id))
  with check (public.is_allowed_user() and public.can_see_project(project_id));

-- purchase_orders: scoped by their project
drop policy if exists allowlist_all on public.purchase_orders;
drop policy if exists scoped_all    on public.purchase_orders;
create policy scoped_all on public.purchase_orders for all to authenticated
  using (public.is_allowed_user() and public.can_see_project(project_id))
  with check (public.is_allowed_user() and public.can_see_project(project_id));

-- clients: visible when the user owns a project under them
drop policy if exists allowlist_all on public.clients;
drop policy if exists scoped_all    on public.clients;
create policy scoped_all on public.clients for all to authenticated
  using (public.is_allowed_user() and public.can_see_client(id))
  with check (public.is_allowed_user() and public.can_see_client(id));

-- client_documents: same client scope
drop policy if exists allowlist_all on public.client_documents;
drop policy if exists scoped_all    on public.client_documents;
create policy scoped_all on public.client_documents for all to authenticated
  using (public.is_allowed_user() and public.can_see_client(client_id))
  with check (public.is_allowed_user() and public.can_see_client(client_id));

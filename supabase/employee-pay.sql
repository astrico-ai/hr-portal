-- ============================================================================
-- Hard salary/bank lock — PHASE 1 (safe, non-destructive).
-- Splits sensitive pay out of `employees` into a separate `employee_pay` table
-- whose RLS only lets salary.access READ and salary.edit WRITE. A user without
-- salary rights can no longer fetch pay from the API at all (not just hidden
-- in the UI). The old employees.salary/ifsc/account_number columns are LEFT IN
-- PLACE here as a backup; drop them later with employee-pay-drop-columns.sql
-- once the deployed app is confirmed working.
-- Run once in the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.employee_pay (
  employee_id     bigint primary key references public.employees(id) on delete cascade,
  salary          numeric not null default 0,
  ifsc            text,
  account_number  text,
  updated_by      text,
  updated_at      timestamptz default now()
);

-- Copy existing pay across (idempotent — safe to re-run; won't overwrite).
insert into public.employee_pay (employee_id, salary, ifsc, account_number)
select id, coalesce(salary, 0), ifsc, account_number
from public.employees
on conflict (employee_id) do nothing;

alter table public.employee_pay enable row level security;

-- READ: admin or anyone granted salary.access.
drop policy if exists pay_read on public.employee_pay;
create policy pay_read on public.employee_pay for select to authenticated
  using (public.is_app_admin() or public.has_perm('salary.access'));

-- WRITE (insert/update/delete): admin or anyone granted salary.edit.
drop policy if exists pay_write on public.employee_pay;
create policy pay_write on public.employee_pay for all to authenticated
  using (public.is_app_admin() or public.has_perm('salary.edit'))
  with check (public.is_app_admin() or public.has_perm('salary.edit'));

grant all on table public.employee_pay to authenticated;
grant usage, select on all sequences in schema public to authenticated;

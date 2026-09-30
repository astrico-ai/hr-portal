-- ============================================================================
-- RECOVERY: recreate employee_pay and restore salary/bank data.
-- The drop-columns step ran without employee_pay existing, so pay data was lost
-- from `employees`. This recreates the locked table and restores values from
-- the August 2026 salary sheet (7 employees, matched by id). Idempotent:
-- re-running only refreshes the same rows. Run once in the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.employee_pay (
  employee_id     bigint primary key references public.employees(id) on delete cascade,
  salary          numeric not null default 0,
  ifsc            text,
  account_number  text,
  updated_by      text,
  updated_at      timestamptz default now()
);

alter table public.employee_pay enable row level security;

drop policy if exists pay_read on public.employee_pay;
create policy pay_read on public.employee_pay for select to authenticated
  using (public.is_app_admin() or public.has_perm('salary.access'));

drop policy if exists pay_write on public.employee_pay;
create policy pay_write on public.employee_pay for all to authenticated
  using (public.is_app_admin() or public.has_perm('salary.edit'))
  with check (public.is_app_admin() or public.has_perm('salary.edit'));

grant all on table public.employee_pay to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Restore pay from the August 2026 sheet (matched to employees by id + name).
insert into public.employee_pay (employee_id, salary, ifsc, account_number) values
  (1, 99800,  'ICIC0001243', '124301505807'),    -- Nayan Jain
  (2, 99800,  'KKBK0001410', '1345367896'),       -- Sanuj Philip
  (3, 99800,  'HDFC0001201', '50100585212586'),   -- Vraj Sheth
  (4, 99800,  'HDFC0000539', '5391050011373'),    -- Rahul Kulkarni
  (5, 108133, 'HDFC0000997', '50100610780991'),   -- Kedar Sawant
  (6, 45190,  'YESB0000024', '2499300008322'),    -- Pulkit Agrawal
  (7, 37300,  'KKBK0001398', '1349278402')        -- Soumil Dhywershetty
on conflict (employee_id) do update
  set salary = excluded.salary,
      ifsc = excluded.ifsc,
      account_number = excluded.account_number,
      updated_at = now();

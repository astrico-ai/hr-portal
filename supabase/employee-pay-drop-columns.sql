-- ============================================================================
-- Hard salary/bank lock — PHASE 3 (destructive — run LAST).
-- Only after employee-pay.sql has been run AND the updated app is deployed and
-- confirmed working (Salary page shows/saves pay correctly, HR Center still
-- works). This removes the now-unused pay columns from `employees`, so pay
-- exists ONLY in the locked employee_pay table.
--
-- Safety: the data already lives in employee_pay. Verify first, e.g.:
--   select count(*) from public.employee_pay;                 -- matches # employees with pay
--   select e.id, e.salary, p.salary from public.employees e
--     join public.employee_pay p on p.employee_id = e.id
--     where coalesce(e.salary,0) <> coalesce(p.salary,0);     -- should return 0 rows
-- Run once in the Supabase SQL Editor.
-- ============================================================================

alter table public.employees
  drop column if exists salary,
  drop column if exists ifsc,
  drop column if exists account_number;

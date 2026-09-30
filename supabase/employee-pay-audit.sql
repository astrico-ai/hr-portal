-- ============================================================================
-- Salary change history + audit trail. Every INSERT/UPDATE/DELETE on
-- employee_pay is recorded with old & new values, who changed it, and when —
-- so any accidental change (or wipe) is always reversible, and there's a
-- permanent trail for the most sensitive module. Writes happen only through the
-- trigger (SECURITY DEFINER); there is no direct write policy, so the log can't
-- be tampered with from the app. Run once (after employee_pay exists).
-- ============================================================================

create table if not exists public.employee_pay_history (
  id           bigserial primary key,
  employee_id  bigint,
  action       text not null,        -- INSERT / UPDATE / DELETE
  old_salary   numeric, new_salary   numeric,
  old_ifsc     text,    new_ifsc     text,
  old_account  text,    new_account  text,
  changed_by   text,
  changed_at   timestamptz default now()
);

alter table public.employee_pay_history enable row level security;
-- Read for salary viewers/admin; no write policy (trigger-only inserts).
drop policy if exists pay_hist_read on public.employee_pay_history;
create policy pay_hist_read on public.employee_pay_history for select to authenticated
  using (public.is_app_admin() or public.has_perm('salary.access'));
grant select on table public.employee_pay_history to authenticated;

create or replace function public.log_employee_pay_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.employee_pay_history(
    employee_id, action, old_salary, new_salary, old_ifsc, new_ifsc,
    old_account, new_account, changed_by)
  values (
    coalesce(new.employee_id, old.employee_id), tg_op,
    old.salary, new.salary, old.ifsc, new.ifsc,
    old.account_number, new.account_number,
    coalesce(auth.jwt() ->> 'email', current_user));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_employee_pay_audit on public.employee_pay;
create trigger trg_employee_pay_audit
  after insert or update or delete on public.employee_pay
  for each row execute function public.log_employee_pay_change();

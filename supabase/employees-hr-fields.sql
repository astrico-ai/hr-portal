-- Add HR-profile fields to employees (for the HR Center page).
-- Run once in the Supabase SQL Editor.
alter table public.employees
  add column if not exists employee_id text,
  add column if not exists email       text,
  add column if not exists phone       text;

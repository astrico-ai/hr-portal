-- Foreign-currency (export) invoices: store the currency and the INR exchange
-- rate used for dashboard/GST conversion (rate is NOT printed on the invoice).
-- Run once in the Supabase SQL Editor.
alter table public.billable_items
  add column if not exists currency      text default 'INR',
  add column if not exists exchange_rate numeric;  -- INR per 1 unit of currency

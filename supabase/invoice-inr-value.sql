-- ============================================================================
-- Foreign-currency invoices: capture the INR value directly (for dashboard/GST)
-- instead of deriving it from an exchange rate. The invoice itself still shows
-- only the PO/foreign currency; this INR figure is never printed. INR invoices
-- ignore this column (their `amount` is already INR). Run once.
-- ============================================================================
alter table public.billable_items
  add column if not exists inr_value numeric;  -- INR equivalent, entered by hand (foreign invoices only)

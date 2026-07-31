-- ============================================================================
-- NV360 Billing — Supabase schema (mirrors the Firestore collections)
-- Safe to re-run: drops and recreates the tables. Run in Supabase SQL Editor.
-- Every table has Row Level Security ON and is readable/writable ONLY by a
-- logged-in user (tightened to an email allowlist later, in the auth phase).
-- ============================================================================

-- Clean slate (order respects nothing since we don't use hard FKs) -----------
drop table if exists public.audit_log        cascade;
drop table if exists public.client_documents cascade;
drop table if exists public.purchase_orders  cascade;
drop table if exists public.billable_items    cascade;
drop table if exists public.projects          cascade;
drop table if exists public.clients           cascade;

-- Clients --------------------------------------------------------------------
create table public.clients (
  id               bigint primary key,
  legal_name       text,
  gst_number       text,
  billing_address  text,
  state            text,
  country          text,
  pincode          text,
  is_active        boolean default true,
  msa_document     text,
  nda_document     text,
  documents        jsonb default '[]'::jsonb,
  other_documents  jsonb default '[]'::jsonb,
  created_by_email text,
  created_at       timestamptz,
  updated_at       timestamptz
);

-- Projects -------------------------------------------------------------------
create table public.projects (
  id              bigint primary key,
  client_id       bigint,
  name            text,
  project_manager text,
  sales_manager   text,
  cx_manager      text,
  spoc_name       text,
  spoc_mobile     text,
  mrr             numeric,
  is_active       boolean default true,
  inactive_date   date,
  created_at      timestamptz
);
create index on public.projects (client_id);

-- Billable items (invoices / bills) ------------------------------------------
create table public.billable_items (
  id                       bigint primary key,
  project_id               bigint,
  name                     text,
  type                     text,   -- LICENSE | ONE_TIME
  status                   text,   -- PENDING | RAISED | RECEIVED | ...
  amount                   numeric,
  invoice_number           text,
  invoice_date             date,
  start_date               date,
  end_date                 date,
  payment_date             date,
  po_number                text,
  po_end_date              date,
  billing_frequency        text,
  custom_interval_days     integer,
  line_items               jsonb default '[]'::jsonb,
  bank_account             text,
  invoice_document_url     text,   -- currently base64; → Storage URL in phase 5
  po_document_url          text,
  proposal_document_url    text,
  generated_pdf_url        text,
  invoice_generated        boolean,
  invoice_number_generated text,
  invoice_generation_date  text,
  invoice_raised_by        text,
  project_manager          text,
  sales_manager            text,
  cx_manager               text
);
create index on public.billable_items (project_id);
create index on public.billable_items (status);
create index on public.billable_items (type);

-- Purchase orders ------------------------------------------------------------
create table public.purchase_orders (
  id              bigint primary key,
  project_id      bigint,
  name            text,
  po_number       text,
  po_value        numeric,
  currency        text,
  po_end_date     date,
  po_document_url text,   -- currently base64; → Storage URL in phase 5
  created_at      timestamptz
);
create index on public.purchase_orders (project_id);

-- Client documents -----------------------------------------------------------
create table public.client_documents (
  id          bigint primary key,
  client_id   bigint,
  type        text,
  file_url    text,   -- currently base64; → Storage URL in phase 5
  uploaded_at timestamptz
);
create index on public.client_documents (client_id);

-- Audit log ------------------------------------------------------------------
-- (Firestore doc ids were random strings; keep them as the text primary key.)
create table public.audit_log (
  id         text primary key,
  entity_id  bigint,
  user_email text,
  at         timestamptz,
  summary    text,
  action     text
);
create index on public.audit_log (at desc);

-- ============================================================================
-- Row Level Security: lock every table, allow ONLY authenticated users.
-- (Phase 4 will tighten `using (true)` to an email allowlist.)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','billable_items','purchase_orders','client_documents','audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists authed_all on public.%I;', t);
    execute format(
      'create policy authed_all on public.%I for all to authenticated using (true) with check (true);', t
    );
    execute format('grant all on table public.%I to authenticated;', t);
  end loop;
end $$;

import { supabase } from './supabaseClient';

// Supabase implementation of the same interface as firebaseService.ts, so the
// existing data files (storage.ts, clients.ts, purchaseOrders.ts) work unchanged.
// The app's Firestore field names already match the Postgres columns (snake_case),
// so reads pass through as-is; writes are filtered to known columns and empty
// strings in date/number columns are coerced to null (Postgres rejects '').

// App collection name -> Postgres table name.
const TABLE: Record<string, string> = {
  projects: 'projects',
  billableItems: 'billable_items',
  clients: 'clients',
  purchaseOrders: 'purchase_orders',
  client_documents: 'client_documents',
};

// Allowed columns per table (writes are filtered to these; unknown fields such
// as File objects are dropped so an insert never fails on an unknown column).
const COLUMNS: Record<string, string[]> = {
  clients: ['id', 'legal_name', 'gst_number', 'billing_address', 'state', 'country', 'pincode',
    'is_active', 'msa_document', 'nda_document', 'documents', 'other_documents',
    'created_by_email', 'created_at', 'updated_at'],
  projects: ['id', 'client_id', 'name', 'project_manager', 'sales_manager', 'cx_manager',
    'spoc_name', 'spoc_mobile', 'mrr', 'is_active', 'inactive_date', 'created_at'],
  billable_items: ['id', 'project_id', 'name', 'type', 'status', 'amount', 'invoice_number',
    'invoice_date', 'start_date', 'end_date', 'payment_date', 'po_number', 'po_end_date',
    'billing_frequency', 'custom_interval_days', 'line_items', 'bank_account',
    'invoice_document_url', 'po_document_url', 'proposal_document_url', 'generated_pdf_url',
    'invoice_generated', 'invoice_number_generated', 'invoice_generation_date',
    'invoice_raised_by', 'project_manager', 'sales_manager', 'cx_manager'],
  purchase_orders: ['id', 'project_id', 'name', 'po_number', 'po_value', 'currency',
    'po_end_date', 'po_document_url', 'created_at'],
  client_documents: ['id', 'client_id', 'type', 'file_url', 'uploaded_at'],
};

// Columns where an empty string must become NULL (Postgres date/numeric types).
const NULLABLE_EMPTY: Record<string, string[]> = {
  clients: ['created_at', 'updated_at'],
  projects: ['inactive_date', 'created_at', 'mrr', 'client_id'],
  billable_items: ['invoice_date', 'start_date', 'end_date', 'payment_date', 'po_end_date',
    'amount', 'custom_interval_days', 'project_id'],
  purchase_orders: ['po_end_date', 'created_at', 'po_value', 'project_id'],
  client_documents: ['uploaded_at', 'client_id'],
};

// Heavy base64 blob columns bloat the billable_items rows (~8MB total). Bulk
// list reads exclude them for speed; the per-project fetch (queryDocuments,
// which selects '*') still returns them where the download links need them.
const LIST_SELECT: Record<string, string> = {
  billable_items: [
    'id', 'project_id', 'name', 'type', 'status', 'amount', 'invoice_number', 'invoice_date',
    'start_date', 'end_date', 'payment_date', 'po_number', 'po_end_date', 'billing_frequency',
    'custom_interval_days', 'line_items', 'bank_account', 'invoice_generated',
    'invoice_number_generated', 'invoice_generation_date', 'invoice_raised_by',
    'project_manager', 'sales_manager', 'cx_manager',
  ].join(','),
};

const tableOf = (collectionName: string): string => {
  const t = TABLE[collectionName];
  if (!t) throw new Error(`[supabase] unknown collection "${collectionName}"`);
  return t;
};

// Build a clean row for a write: keep only known columns, coerce '' -> null where
// the column type can't accept an empty string, and set the primary key.
const toRow = (table: string, docId: string, data: any) => {
  const allowed = COLUMNS[table] || [];
  const emptyToNull = new Set(NULLABLE_EMPTY[table] || []);
  const row: Record<string, any> = {};
  for (const key of allowed) {
    if (key === 'id') continue;
    if (!(key in data)) continue;
    let v = data[key];
    if (v === '' && emptyToNull.has(key)) v = null;
    if (v === undefined) v = null;
    row[key] = v;
  }
  // Primary key: numeric for every table except audit_log (not handled here).
  row.id = /^\d+$/.test(String(docId)) ? Number(docId) : docId;
  return row;
};

export const getDocument = async (collectionName: string, docId: string) => {
  const table = tableOf(collectionName);
  const { data, error } = await supabase.from(table).select('*').eq('id', docId).maybeSingle();
  if (error) { console.error('Error getting document:', error); throw error; }
  return data ?? null;
};

export const getDocuments = async (collectionName: string) => {
  const table = tableOf(collectionName);
  const { data, error } = await supabase.from(table).select(LIST_SELECT[table] || '*');
  if (error) { console.error('Error getting documents:', error); return []; }
  return data ?? [];
};

export const setDocument = async (collectionName: string, docId: string, data: any) => {
  const table = tableOf(collectionName);
  const row = toRow(table, docId, data);
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) { console.error('Error setting document:', error); throw error; }
  return { id: docId, ...data };
};

export const updateDocument = async (collectionName: string, docId: string, data: any) => {
  const table = tableOf(collectionName);
  const row = toRow(table, docId, data);
  delete row.id; // don't rewrite the primary key on update
  const { error } = await supabase.from(table).update(row).eq('id', docId);
  if (error) { console.error('Error updating document:', error); throw error; }
  return { id: docId, ...data };
};

export const deleteDocument = async (collectionName: string, docId: string) => {
  const table = tableOf(collectionName);
  const { error } = await supabase.from(table).delete().eq('id', docId);
  if (error) { console.error('Error deleting document:', error); throw error; }
  return true;
};

// Only '==' is used by the app; map it to eq. Other operators map to PostgREST filters.
export const queryDocuments = async (collectionName: string, field: string, operator: any, value: any) => {
  const table = tableOf(collectionName);
  let q = supabase.from(table).select('*');
  switch (operator) {
    case '==': q = q.eq(field, value); break;
    case '!=': q = q.neq(field, value); break;
    case '>':  q = q.gt(field, value); break;
    case '>=': q = q.gte(field, value); break;
    case '<':  q = q.lt(field, value); break;
    case '<=': q = q.lte(field, value); break;
    case 'in': q = q.in(field, value); break;
    default:   q = q.eq(field, value);
  }
  const { data, error } = await q;
  if (error) { console.error('Error querying documents:', error); throw error; }
  return data ?? [];
};

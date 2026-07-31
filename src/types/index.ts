export interface Document {
  id: number;
  client_id: number;
  type: 'MSA' | 'NDA' | 'OTHER';
  name?: string;  // Only required for type OTHER
  file_url: string;
  uploaded_at: string;
  viewDocument?: () => void;
}

export interface Client {
  id: number;
  legal_name: string;
  gst_number?: string;
  billing_address?: string;
  pincode?: string;
  state?: string;
  country?: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  documents?: Document[];
  is_active: boolean;
  // Date the client was marked inactive (revenue stops counting from here).
  inactive_date?: string | null;
}

export interface ClientFormData {
  legal_name: string;
  gst_number: string;
  billing_address: string;
  pincode: string;
  state: string;
  country: string;
  created_by_email: string;
  msa_document?: File;
  nda_document?: File;
  other_documents?: Array<{ name: string; file: File; }>;
  is_active?: boolean;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  spoc_name: string;
  spoc_mobile: string;
  created_at: string;
  sales_manager: string;
  project_manager: string;
  cx_manager: string;
  mrr: number;
  // Active by default; inactive projects stop counting toward MRR/ARR.
  is_active?: boolean;
  inactive_date?: string | null;
}

export interface ProjectFormData {
  client_id: number;
  name: string;
  spoc_name: string;
  spoc_mobile: string;
  sales_manager: string;
  project_manager: string;
  cx_manager: string;
}

export type BillableStatus = 'NOT_APPROVED' | 'PENDING' | 'APPROVED' | 'RAISED' | 'RECEIVED';
export type BillableType = 'LICENSE' | 'ONE_TIME' | 'OTHERS';

// A single line on an invoice (one invoice/bill can have several).
// amount = quantity × rate when both are given; otherwise it's a lump sum.
export interface BillableLineItem {
  description: string;
  quantity?: number | null;
  rate?: number | null;   // unit cost
  unit?: string | null;   // the "per" label, e.g. "Unt", "Month"
  amount: number;
}

export interface BillableItem {
  id: number;
  project_id: number;
  name: string;
  type: BillableType;
  // Multiple line items per invoice; `amount` is the sum. Optional for
  // backward-compat (older items have a single name/amount).
  line_items?: BillableLineItem[];
  billing_frequency?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
  custom_interval_days?: number | null;
  po_number: string | null;
  po_end_date: string | null;
  po_document_url: string | null;
  proposal_document_url: string | null;
  invoice_number: string | null;
  invoice_document_url: string | null;
  start_date: string;
  end_date: string;
  amount: number;
  invoice_date: string | null;
  payment_date: string | null;
  status: BillableStatus;
  sales_manager: string;
  project_manager: string;
  cx_manager: string;
  invoice_raised_by: string | null;
  // Bank account (chosen by the approver) used on the generated invoice PDF.
  bank_account?: string | null;
  // Invoice generation tracking
  invoice_generated: boolean;
  invoice_number_generated?: string | null;
  invoice_generation_date?: string | null;
  generated_pdf_url?: string | null;
}

export interface BillableItemFormData {
  project_id: number;
  name: string;
  type: BillableType;
  line_items?: BillableLineItem[];
  billing_frequency?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
  custom_interval_days?: number | null;
  po_number: string | null;
  po_end_date: string | null;
  po_document: File | null;
  proposal_document: File | null;
  invoice_number: string | null;
  invoice_document: File | null;
  start_date: string;
  end_date: string;
  amount: number;
  invoice_date: string | null;
  payment_date: string | null;
  status: BillableStatus;
  sales_manager: string;
  project_manager: string;
  cx_manager: string;
  invoice_raised_by: string | null;
}

export interface PurchaseOrder {
  id: number;
  project_id: number;
  name: string;
  po_number: string;
  po_end_date: string;
  po_value: number;
  po_document_url: string;
  created_at: string;
}

export interface PurchaseOrderFormData {
  project_id: number;
  name: string;
  po_number: string;
  po_end_date: string;
  po_value: number;
  po_document: File;
}
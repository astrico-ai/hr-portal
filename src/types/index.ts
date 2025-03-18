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

export interface BillableItem {
  id: number;
  project_id: number;
  name: string;
  type: BillableType;
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
}

export interface BillableItemFormData {
  project_id: number;
  name: string;
  type: BillableType;
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
export interface Document {
  id: number;
  client_id: number;
  type: 'MSA' | 'NDA' | 'OTHER';
  name?: string;  // Only required for type OTHER
  file_url: string;
  uploaded_at: string;
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
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  spoc_name: string;
  spoc_mobile: string;
  created_at: string;
}

export interface ProjectFormData {
  client_id: number;
  name: string;
  spoc_name: string;
  spoc_mobile: string;
}

export type BillableStatus = 'PENDING' | 'RAISED' | 'RECEIVED';
export type BillableType = 'LICENSE' | 'ONE_TIME' | 'OTHERS';

export interface BillableItem {
  id: number;
  project_id: number;
  name: string;
  type: BillableType;
  po_number?: string;
  po_end_date?: string;
  po_document_url?: string;
  proposal_document_url?: string;
  start_date: string;
  end_date: string;
  amount: number;
  status: BillableStatus;
}

export interface BillableItemFormData {
  project_id: number;
  name: string;
  type: BillableType;
  po_number?: string;
  po_document?: File;
  proposal_document?: File;
  start_date: string;
  end_date: string;
  amount: number;
  invoice_date?: string;
  status: BillableStatus;
}
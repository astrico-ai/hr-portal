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
}

export interface ClientFormData {
  legal_name: string;
  gst_number: string;
  billing_address: string;
  pincode: string;
  state: string;
  country: string;
  created_by_email: string;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  created_at: string;
}

export interface ProjectFormData {
  client_id: number;
  name: string;
}

export type BillableStatus = 'PENDING' | 'INVOICED' | 'PAID';

export interface BillableItem {
  id: number;
  project_id: number;
  name: string;
  po_number: string;
  po_document_url: string;
  proposal_document_url: string;
  start_date: string;
  end_date: string;
  amount: number;
  invoice_date?: string;
  status: BillableStatus;
  created_at: string;
}

export interface BillableItemFormData {
  project_id: number;
  name: string;
  po_number: string;
  po_document?: File;
  proposal_document?: File;
  start_date: string;
  end_date: string;
  amount: number;
  invoice_date?: string;
}
import type { Project, BillableItem, BillableItemFormData, Client, PurchaseOrder, PurchaseOrderFormData } from '../types';
import { 
  getDocument, 
  getDocuments, 
  setDocument, 
  updateDocument, 
  deleteDocument as deleteFirestoreDocument,
  queryDocuments
} from './dataService';
import { supabase } from './supabaseClient';

const COLLECTIONS = {
  PROJECTS: 'projects',
  BILLABLE_ITEMS: 'billableItems',
  CLIENTS: 'clients',
  PURCHASE_ORDERS: 'purchaseOrders'
} as const;

// Helper to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

// Client operations
export async function getClients(): Promise<Client[]> {
  try {
    const clients = await getDocuments(COLLECTIONS.CLIENTS);
    return (Array.isArray(clients) ? clients : []) as unknown as Client[];
  } catch (error) {
    console.error('Error getting clients:', error);
    return [];
  }
}

// Project operations
export async function getProjects(): Promise<Project[]> {
  try {
    const projects = await getDocuments(COLLECTIONS.PROJECTS);
    return (Array.isArray(projects) ? projects : []) as unknown as Project[];
  } catch (error) {
    console.error('Error getting projects:', error);
    return [];
  }
}

export async function saveProject(project: Omit<Project, 'created_at'> & { id?: number }): Promise<Project> {
  try {
    const projects = await getProjects();
    let projectToSave: Project;

    if (project.id) {
      // Update existing project
      projectToSave = {
        ...project,
        created_at: projects.find(p => p.id === project.id)?.created_at || new Date().toISOString()
      } as Project;
    } else {
      // Create new project with next available ID
      const nextId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
      projectToSave = {
        ...project,
        id: nextId,
        created_at: new Date().toISOString()
      } as Project;
    }
    
    console.log('Saving project:', projectToSave);
    await setDocument(COLLECTIONS.PROJECTS, projectToSave.id.toString(), projectToSave);
    return projectToSave;
  } catch (error) {
    console.error('Error saving project:', error);
    throw error;
  }
}

export async function deleteProject(id: number): Promise<void> {
  const projects = (await getProjects()).filter(p => p.id !== id);
  await deleteFirestoreDocument(COLLECTIONS.PROJECTS, id.toString());
  
  // Also delete associated billable items
  const billableItems = (await getBillableItems()).filter(item => item.project_id !== id);
  await deleteFirestoreDocument(COLLECTIONS.BILLABLE_ITEMS, id.toString());
}

export async function deleteProjectsWithZeroAmount(): Promise<void> {
  try {
    const projects = await getProjects();
    const billableItems = await getBillableItems();
    
    // Calculate total amount for each project
    const projectAmounts = projects.map(project => {
      const projectItems = billableItems.filter(item => item.project_id === project.id);
      const totalAmount = projectItems.reduce((sum, item) => sum + item.amount, 0);
      return { project, totalAmount };
    });

    // Find projects with 0 amount
    const zeroAmountProjects = projectAmounts.filter(({ totalAmount }) => totalAmount === 0);

    // Delete each project with 0 amount
    for (const { project } of zeroAmountProjects) {
      await deleteProject(project.id);
      console.log(`Deleted project with ID ${project.id} (${project.name}) - 0 amount`);
    }

    console.log(`Deleted ${zeroAmountProjects.length} projects with 0 amount`);
  } catch (error) {
    console.error('Error deleting projects with 0 amount:', error);
    throw error;
  }
}

// Billable item operations
export const getBillableItems = async (): Promise<BillableItem[]> => {
  try {
    return await getDocuments(COLLECTIONS.BILLABLE_ITEMS) as unknown as BillableItem[];
  } catch (error) {
    console.error('Error getting billable items:', error);
    return [];
  }
};

// Items for a single project — INCLUDES the document blob columns (which the
// bulk getBillableItems() omits for speed). Used by the project detail page,
// where the view/download links need the base64 documents.
export const getBillableItemsByProject = async (projectId: number): Promise<BillableItem[]> => {
  try {
    return await queryDocuments(COLLECTIONS.BILLABLE_ITEMS, 'project_id', '==', projectId) as unknown as BillableItem[];
  } catch (error) {
    console.error('Error getting billable items by project:', error);
    return [];
  }
};

export const saveBillableItem = async (formData: BillableItemFormData): Promise<BillableItem> => {
  try {
    const items = await getBillableItems();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;

    // Handle file uploads if provided
    let poDocumentUrl: string | null = null;
    let proposalDocumentUrl: string | null = null;
    let invoiceDocumentUrl: string | null = null;

    // If we have a PO number, get the PO document URL from the existing PO
    if (formData.po_number && formData.po_number !== 'NO_PO_REQUIRED') {
      const purchaseOrders = await getPurchaseOrders(formData.project_id);
      const selectedPO = purchaseOrders.find(po => po.po_number === formData.po_number);
      if (selectedPO) {
        poDocumentUrl = selectedPO.po_document_url;
      }
    }

    // Only handle PO document upload if we're not using an existing PO
    if (formData.po_document && !poDocumentUrl) {
      poDocumentUrl = await fileToBase64(formData.po_document);
    }

    if (formData.proposal_document) {
      proposalDocumentUrl = await fileToBase64(formData.proposal_document);
    }

    if (formData.invoice_document) {
      invoiceDocumentUrl = await fileToBase64(formData.invoice_document);
    }

    // Validate required fields for RAISED and RECEIVED status
    if ((formData.status === 'RAISED' || formData.status === 'RECEIVED') &&
        (!formData.invoice_number || !formData.invoice_document)) {
      throw new Error('Invoice number and document are required when status is RAISED or RECEIVED');
    }

    const newItem: BillableItem = {
      id: newId,
      project_id: formData.project_id,
      name: formData.name,
      line_items: formData.line_items && formData.line_items.length ? formData.line_items : undefined,
      type: formData.type,
      billing_frequency: formData.type === 'LICENSE' ? formData.billing_frequency : undefined,
      custom_interval_days: formData.type === 'LICENSE' && formData.billing_frequency === 'CUSTOM' ? formData.custom_interval_days : null,
      po_number: formData.po_number || null,
      po_end_date: formData.po_end_date || null,
      po_document_url: poDocumentUrl,
      proposal_document_url: proposalDocumentUrl,
      invoice_number: formData.invoice_number || null,
      invoice_document_url: invoiceDocumentUrl,
      start_date: formData.start_date,
      end_date: formData.end_date,
      amount: formData.amount,
      invoice_date: formData.invoice_date || null,
      payment_date: formData.payment_date || null,
      status: formData.status || 'PENDING',
      sales_manager: formData.sales_manager,
      project_manager: formData.project_manager,
      cx_manager: formData.cx_manager,
      invoice_raised_by: formData.invoice_raised_by || null,
      // Initialize invoice generation fields
      invoice_generated: false,
      invoice_number_generated: null,
      invoice_generation_date: null,
      generated_pdf_url: null
    };

    // Remove any undefined values before saving to Firestore
    const cleanItem = Object.fromEntries(
      Object.entries(newItem).filter(([_, value]) => value !== undefined)
    );

    await setDocument(COLLECTIONS.BILLABLE_ITEMS, newItem.id.toString(), cleanItem);
    return newItem;
  } catch (error) {
    console.error('Error saving billable item:', error);
    throw error;
  }
};

export const updateBillableItem = async (itemId: number, updatedItem: BillableItem): Promise<void> => {
  try {
    // Validate required fields for RAISED and RECEIVED status
    if ((updatedItem.status === 'RAISED' || updatedItem.status === 'RECEIVED') &&
        (!updatedItem.invoice_number || !updatedItem.invoice_document_url)) {
      throw new Error('Invoice number and document are required when status is RAISED or RECEIVED');
    }

    // Remove any undefined values before saving to Firestore
    const cleanItem = Object.fromEntries(
      Object.entries(updatedItem).filter(([_, value]) => value !== undefined)
    );

    await setDocument(COLLECTIONS.BILLABLE_ITEMS, itemId.toString(), cleanItem);
  } catch (error) {
    console.error('Error updating billable item:', error);
    throw error;
  }
};

export async function deleteBillableItem(id: number): Promise<void> {
  await deleteFirestoreDocument(COLLECTIONS.BILLABLE_ITEMS, id.toString());
}

// File handling. On Supabase we upload to Storage and store the PATH; on Firebase
// we keep the legacy base64 data URI. The document-open helper handles both.
const useSupabaseStorage = (process.env.REACT_APP_DATA_BACKEND || 'firebase').toLowerCase() === 'supabase';
const STORAGE_BUCKET = 'documents';

const uploadToStorage = async (file: File, prefix: string): Promise<string> => {
  const safeName = (file.name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${prefix}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' });
  if (error) throw error;
  return path;
};

export function saveFile(file: File): Promise<string> {
  return useSupabaseStorage ? uploadToStorage(file, 'uploads') : fileToBase64(file);
}

export const uploadDocument = async (file: File, itemId: number, type: 'po' | 'proposal' | 'invoice'): Promise<string> => {
  try {
    return useSupabaseStorage
      ? await uploadToStorage(file, `billable_items/${itemId}/${type}`)
      : await fileToBase64(file);
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};

export const getDocumentFromUrl = async (url: string): Promise<{ fileName: string; content: string; type: string } | null> => {
  try {
    // Since we're storing base64 strings directly, we can return them as is
    return {
      fileName: 'document',
      content: url,
      type: 'application/octet-stream'
    };
  } catch (error) {
    console.error('Error retrieving document:', error);
    return null;
  }
};

// Purchase Order operations
export async function getPurchaseOrders(projectId?: number): Promise<PurchaseOrder[]> {
  try {
    if (projectId) {
      const orders = await queryDocuments(COLLECTIONS.PURCHASE_ORDERS, 'project_id', '==', projectId);
      return (Array.isArray(orders) ? orders : []) as unknown as PurchaseOrder[];
    } else {
      const orders = await getDocuments(COLLECTIONS.PURCHASE_ORDERS);
      return (Array.isArray(orders) ? orders : []) as unknown as PurchaseOrder[];
    }
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    return [];
  }
}

export async function savePurchaseOrder(formData: PurchaseOrderFormData): Promise<PurchaseOrder> {
  try {
    // Get existing POs to determine next ID
    const existingPOs = await getPurchaseOrders();
    const newId = existingPOs.length > 0 
      ? Math.max(...existingPOs.map(po => Number(po.id))) + 1 
      : 1;
    
    // Convert file to base64
    const poDocumentBase64 = formData.po_document ? await fileToBase64(formData.po_document) : null;
    
    // Create new PO object
    const newPO: PurchaseOrder = {
      id: newId,
      project_id: formData.project_id,
      name: formData.name,
      po_number: formData.po_number,
      po_end_date: formData.po_end_date,
      po_value: formData.po_value,
      po_document_url: poDocumentBase64 || '',
      created_at: new Date().toISOString()
    };
    
    // Save to Firestore
    await setDocument(COLLECTIONS.PURCHASE_ORDERS, newId.toString(), newPO);
    return newPO;
  } catch (error) {
    console.error('Error saving purchase order:', error);
    throw error;
  }
}

export async function deletePurchaseOrder(poId: number): Promise<void> {
  try {
    await deleteFirestoreDocument(COLLECTIONS.PURCHASE_ORDERS, poId.toString());
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    throw error;
  }
}

export const updatePurchaseOrder = async (po: Partial<PurchaseOrder> & { id: number }, document?: File): Promise<PurchaseOrder> => {
  try {
    // Get current PO
    const currentPO = await getDocument(COLLECTIONS.PURCHASE_ORDERS, po.id.toString()) as unknown as PurchaseOrder;
    if (!currentPO) {
      throw new Error('Purchase order not found');
    }

    // If there's a new document, convert it to base64
    let documentUrl = po.po_document_url;
    if (document) {
      documentUrl = await fileToBase64(document);
    }

    // Create updated PO
    const updatedPO: PurchaseOrder = {
      ...currentPO,
      ...po,
      po_document_url: documentUrl || currentPO.po_document_url
    };

    // Save to Firestore
    await setDocument(COLLECTIONS.PURCHASE_ORDERS, po.id.toString(), updatedPO);
    return updatedPO;
  } catch (error) {
    console.error('Error updating purchase order:', error);
    throw error;
  }
}; 
import type { Project, BillableItem, BillableItemFormData } from '../types';
import { 
  getDocument, 
  getDocuments, 
  setDocument, 
  updateDocument, 
  deleteDocument as deleteFirestoreDocument,
  queryDocuments
} from './firebaseService';

const COLLECTIONS = {
  PROJECTS: 'projects',
  BILLABLE_ITEMS: 'billableItems'
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

export async function saveProject(project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
  try {
    const projects = await getProjects();
    const newProject: Project = {
      ...project,
      id: Date.now(),
      created_at: new Date().toISOString()
    };
    
    console.log('Saving new project:', newProject);
    await setDocument(COLLECTIONS.PROJECTS, newProject.id.toString(), newProject);
    return newProject;
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

// Billable item operations
export const getBillableItems = async (): Promise<BillableItem[]> => {
  try {
    return await getDocuments(COLLECTIONS.BILLABLE_ITEMS) as unknown as BillableItem[];
  } catch (error) {
    console.error('Error getting billable items:', error);
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

    if (formData.po_document) {
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
      type: formData.type,
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
      status: formData.status || 'PENDING'
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

export const updateBillableItem = async (id: number, updatedItem: BillableItem): Promise<void> => {
  try {
    await updateDocument(COLLECTIONS.BILLABLE_ITEMS, id.toString(), updatedItem);
  } catch (error) {
    console.error('Error updating billable item:', error);
    throw error;
  }
};

export async function deleteBillableItem(id: number): Promise<void> {
  await deleteFirestoreDocument(COLLECTIONS.BILLABLE_ITEMS, id.toString());
}

// File handling
export function saveFile(file: File): Promise<string> {
  return fileToBase64(file);
}

export const uploadDocument = async (file: File, itemId: number, type: 'po' | 'proposal' | 'invoice'): Promise<string> => {
  try {
    return await fileToBase64(file);
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
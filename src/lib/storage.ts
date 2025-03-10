import type { Project, BillableItem, BillableItemFormData } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'projects',
  BILLABLE_ITEMS: 'billableItems'
} as const;

// Project operations
export function getProjects(): Project[] {
  const projects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
  return projects ? JSON.parse(projects) : [];
}

export function saveProject(project: Omit<Project, 'id' | 'created_at'>): Project {
  const projects = getProjects();
  const newProject: Project = {
    ...project,
    id: Date.now(),
    created_at: new Date().toISOString()
  };
  
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify([...projects, newProject]));
  return newProject;
}

export function deleteProject(id: number): void {
  const projects = getProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  
  // Also delete associated billable items
  const billableItems = getBillableItems().filter(item => item.project_id !== id);
  localStorage.setItem(STORAGE_KEYS.BILLABLE_ITEMS, JSON.stringify(billableItems));
}

// Billable item operations
export const getBillableItems = (): BillableItem[] => {
  try {
    const items = localStorage.getItem(STORAGE_KEYS.BILLABLE_ITEMS);
    return items ? JSON.parse(items) : [];
  } catch (error) {
    console.error('Error getting billable items:', error);
    return [];
  }
};

export const saveBillableItem = async (formData: BillableItemFormData): Promise<BillableItem> => {
  try {
    const items = getBillableItems();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;

    // Handle file uploads if provided
    let poDocumentUrl: string | undefined;
    let proposalDocumentUrl: string | undefined;

    if (formData.po_document) {
      poDocumentUrl = await uploadDocument(formData.po_document, newId, 'po');
    }

    if (formData.proposal_document) {
      proposalDocumentUrl = await uploadDocument(formData.proposal_document, newId, 'proposal');
    }

    const newItem: BillableItem = {
      id: newId,
      project_id: formData.project_id,
      name: formData.name,
      type: formData.type,
      po_number: formData.po_number,
      po_document_url: poDocumentUrl,
      proposal_document_url: proposalDocumentUrl,
      start_date: formData.start_date,
      end_date: formData.end_date,
      amount: formData.amount,
      status: formData.status || 'PENDING'
    };

    localStorage.setItem(STORAGE_KEYS.BILLABLE_ITEMS, JSON.stringify([...items, newItem]));
    return newItem;
  } catch (error) {
    console.error('Error saving billable item:', error);
    throw error;
  }
};

export const updateBillableItem = (id: number, updatedItem: BillableItem): void => {
  try {
    const items = getBillableItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = updatedItem;
      localStorage.setItem(STORAGE_KEYS.BILLABLE_ITEMS, JSON.stringify(items));
    }
  } catch (error) {
    console.error('Error updating billable item:', error);
    throw error;
  }
};

export function deleteBillableItem(id: number): void {
  const items = getBillableItems().filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.BILLABLE_ITEMS, JSON.stringify(items));
}

// File handling
export function saveFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const uploadDocument = async (file: File, itemId: number, type: 'po' | 'proposal'): Promise<string> => {
  // In a real app, this would upload to a server/cloud storage
  // For now, we'll store in localStorage as base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64String = reader.result as string;
        const fileName = file.name;
        const key = `document_${itemId}_${type}`;
        localStorage.setItem(key, JSON.stringify({
          fileName,
          content: base64String,
          type: file.type,
          uploadedAt: new Date().toISOString()
        }));
        // Return a fake URL that we can use to retrieve the file later
        resolve(`data:${file.type};filename=${fileName};key=${key}`);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

export const getDocumentFromUrl = (url: string): { fileName: string; content: string; type: string } | null => {
  try {
    const key = url.split('key=')[1];
    if (!key) return null;
    
    const storedData = localStorage.getItem(key);
    if (!storedData) return null;
    
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Error retrieving document:', error);
    return null;
  }
}; 
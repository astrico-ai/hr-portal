import type { Project, BillableItem } from '../types';

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
export function getBillableItems(): BillableItem[] {
  const items = localStorage.getItem(STORAGE_KEYS.BILLABLE_ITEMS);
  return items ? JSON.parse(items) : [];
}

export function saveBillableItem(item: Omit<BillableItem, 'id' | 'created_at'>): BillableItem {
  const items = getBillableItems();
  const newItem: BillableItem = {
    ...item,
    id: Date.now(),
    created_at: new Date().toISOString()
  };
  
  localStorage.setItem(STORAGE_KEYS.BILLABLE_ITEMS, JSON.stringify([...items, newItem]));
  return newItem;
}

export function updateBillableItem(id: number, item: Partial<BillableItem>): BillableItem {
  const items = getBillableItems();
  const index = items.findIndex(i => i.id === id);
  if (index === -1) throw new Error('Item not found');
  
  const updatedItem = { ...items[index], ...item };
  items[index] = updatedItem;
  
  localStorage.setItem(STORAGE_KEYS.BILLABLE_ITEMS, JSON.stringify(items));
  return updatedItem;
}

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
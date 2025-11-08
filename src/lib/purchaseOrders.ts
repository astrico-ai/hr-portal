import type { PurchaseOrder, PurchaseOrderFormData } from '../types';
import { 
  getDocument, 
  getDocuments, 
  setDocument, 
  updateDocument, 
  deleteDocument as deleteFirestoreDocument,
  queryDocuments
} from './firebaseService';
import { saveFile } from './storage';

const COLLECTIONS = {
  PURCHASE_ORDERS: 'purchaseOrders'
} as const;

export const getPurchaseOrders = async (projectId?: number): Promise<PurchaseOrder[]> => {
  try {
    if (projectId) {
      const docs = await queryDocuments(COLLECTIONS.PURCHASE_ORDERS, 'project_id', '==', projectId);
      return docs as unknown as PurchaseOrder[];
    }
    const docs = await getDocuments(COLLECTIONS.PURCHASE_ORDERS);
    return docs as unknown as PurchaseOrder[];
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    return [];
  }
};

export const savePurchaseOrder = async (formData: PurchaseOrderFormData): Promise<PurchaseOrder> => {
  try {
    const pos = await getPurchaseOrders();
    const newId = pos.length > 0 ? Math.max(...pos.map(po => po.id)) + 1 : 1;

    // Convert document to base64
    const documentUrl = await saveFile(formData.po_document);

    const newPO: PurchaseOrder = {
      id: newId,
      project_id: formData.project_id,
      name: formData.name,
      po_number: formData.po_number,
      po_value: formData.po_value,
      po_document_url: documentUrl,
      po_end_date: formData.po_end_date,
      created_at: new Date().toISOString(),
    };

    await setDocument(COLLECTIONS.PURCHASE_ORDERS, newId.toString(), newPO);
    return newPO;
  } catch (error) {
    console.error('Failed to save purchase order:', error);
    throw error;
  }
};

export const updatePurchaseOrder = async (id: number, updates: Partial<PurchaseOrder>, newDocument?: File): Promise<PurchaseOrder> => {
  try {
    const doc = await getDocument(COLLECTIONS.PURCHASE_ORDERS, id.toString());
    if (!doc) {
      throw new Error('Purchase order not found');
    }
    const currentPO = doc as unknown as PurchaseOrder;

    let documentUrl = updates.po_document_url || currentPO.po_document_url;

    // If there's a new document, convert it to base64
    if (newDocument) {
      documentUrl = await saveFile(newDocument);
    }

    const updatedPO: PurchaseOrder = {
      ...currentPO,
      ...updates,
      po_document_url: documentUrl,
    };

    await updateDocument(COLLECTIONS.PURCHASE_ORDERS, id.toString(), updatedPO);
    return updatedPO;
  } catch (error) {
    console.error('Failed to update purchase order:', error);
    throw error;
  }
};

export const deletePurchaseOrder = async (id: number): Promise<void> => {
  try {
    await deleteFirestoreDocument(COLLECTIONS.PURCHASE_ORDERS, id.toString());
  } catch (error) {
    console.error('Failed to delete purchase order:', error);
    throw error;
  }
};
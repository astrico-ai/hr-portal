import type { Client, ClientFormData, Document } from '../types';
import { 
  getDocument, 
  getDocuments, 
  setDocument, 
  updateDocument, 
  deleteDocument as deleteFirestoreDocument,
  queryDocuments
} from './firebaseService';
import { handleDocumentClick } from '../utils/documentUtils';

const COLLECTIONS = {
  CLIENTS: 'clients',
  DOCUMENTS: 'client_documents'
} as const;

// Helper to get the next ID
async function getNextId(): Promise<number> {
  const clients = await getDocuments(COLLECTIONS.CLIENTS) as unknown as Client[];
  return clients.length > 0 ? Math.max(...clients.map((c: Client) => c.id)) + 1 : 1;
}

// Helper to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export async function getClients(): Promise<Client[]> {
  const clients = await getDocuments(COLLECTIONS.CLIENTS) as unknown as Client[];
  const documents = await getClientDocuments();
  
  return clients.map((client: Client) => ({
    ...client,
    documents: documents.filter(doc => doc.client_id === client.id)
  }));
}

export async function getClientDocuments(): Promise<Document[]> {
  const documents = await getDocuments(COLLECTIONS.DOCUMENTS) as unknown as Document[];
  
  // Add a method to view each document
  return documents.map(doc => ({
    ...doc,
    viewDocument: () => handleDocumentClick(doc.file_url)
  }));
}

export async function getClientById(id: number): Promise<Client | null> {
  const clients = await queryDocuments(COLLECTIONS.CLIENTS, 'id', '==', id) as unknown as Client[];
  return clients[0] || null;
}

export async function createClient(clientData: ClientFormData): Promise<Client> {
  const newClient: Client = {
    id: await getNextId(),
    ...clientData,
    is_active: true, // Set active by default
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await setDocument(COLLECTIONS.CLIENTS, newClient.id.toString(), newClient);
  return newClient;
}

export async function updateClient(id: number, clientData: Partial<Client>): Promise<Client> {
  const existingClient = await getClientById(id);
  if (!existingClient) {
    throw new Error('Client not found');
  }

  // If we're updating fields other than is_active, check if client is active
  if (Object.keys(clientData).length > 1 || (Object.keys(clientData).length === 1 && !('is_active' in clientData))) {
    if (!existingClient.is_active) {
      throw new Error('Cannot update an inactive client');
    }
  }

  const updatedClient: Client = {
    ...existingClient,
    ...clientData,
    updated_at: new Date().toISOString()
  };

  await updateDocument(COLLECTIONS.CLIENTS, id.toString(), updatedClient);
  return updatedClient;
}

export async function saveDocument(clientId: number, type: Document['type'], name: string | undefined, file: File): Promise<Document> {
  try {
    // Convert file to base64
    const base64Content = await fileToBase64(file);
    
    const documents = await getClientDocuments();
    const newDocument: Document = {
      id: documents.length > 0 ? Math.max(...documents.map(d => d.id)) + 1 : 1,
      client_id: clientId,
      type,
      file_url: base64Content,
      uploaded_at: new Date().toISOString()
    };

    // Only add name if it's provided (for OTHER type documents)
    if (name) {
      newDocument.name = name;
    }
    
    await setDocument(COLLECTIONS.DOCUMENTS, newDocument.id.toString(), newDocument);
    return newDocument;
  } catch (error) {
    console.error('Error saving document:', error);
    throw error;
  }
}

export async function deleteDocument(documentId: number): Promise<void> {
  const documents = await getClientDocuments();
  const document = documents.find(d => d.id === documentId);
  
  if (document) {
    await deleteFirestoreDocument(COLLECTIONS.DOCUMENTS, documentId.toString());
  }
}

export async function saveClient(id: number | undefined, data: ClientFormData): Promise<Client> {
  const timestamp = new Date().toISOString();
  
  let client: Client;
  
  if (id) {
    // Update existing client
    const existingClient = await getClientById(id);
    if (!existingClient) throw new Error('Client not found');
    
    // Don't allow updates if client is inactive
    if (!existingClient.is_active) {
      throw new Error('Cannot update an inactive client');
    }
    
    client = {
      ...existingClient,
      ...data,
      updated_at: timestamp
    };
    await updateDocument(COLLECTIONS.CLIENTS, id.toString(), client);
  } else {
    // Create new client
    client = {
      id: await getNextId(),
      ...data,
      is_active: true, // Always set active for new clients
      created_at: timestamp,
      updated_at: timestamp,
      documents: []
    };
    await setDocument(COLLECTIONS.CLIENTS, client.id.toString(), client);
    
    // Handle document uploads for new clients
    if (data.msa_document) {
      await saveDocument(client.id, 'MSA', undefined, data.msa_document);
    }
    if (data.nda_document) {
      await saveDocument(client.id, 'NDA', undefined, data.nda_document);
    }
    if (data.other_documents) {
      for (const doc of data.other_documents) {
        await saveDocument(client.id, 'OTHER', doc.name, doc.file);
      }
    }
  }
  
  return client;
}

export async function deleteClient(id: number): Promise<void> {
  // Get client's documents first
  const documents = await getClientDocuments();
  const clientDocuments = documents.filter(doc => doc.client_id === id);
  
  // Delete all associated documents
  for (const doc of clientDocuments) {
    await deleteDocument(doc.id);
  }
  
  // Delete client
  await deleteFirestoreDocument(COLLECTIONS.CLIENTS, id.toString());
}
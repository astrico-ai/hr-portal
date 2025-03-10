import type { Client, ClientFormData, Document } from '../types';

const STORAGE_KEY = 'clients';
const DOCUMENTS_STORAGE_KEY = 'client_documents';

// Initialize storage if it doesn't exist
if (!localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}
if (!localStorage.getItem(DOCUMENTS_STORAGE_KEY)) {
  localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify([]));
}

// Helper to get the next ID
function getNextId(): number {
  const clients = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return clients.length > 0 ? Math.max(...clients.map((c: Client) => c.id)) + 1 : 1;
}

export async function getClients(): Promise<Client[]> {
  const data = localStorage.getItem(STORAGE_KEY);
  const clients = data ? JSON.parse(data) : [];
  
  // Attach documents to each client
  const documents = await getClientDocuments();
  return clients.map((client: Client) => ({
    ...client,
    documents: documents.filter(doc => doc.client_id === client.id)
  }));
}

export async function getClientDocuments(): Promise<Document[]> {
  const data = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export async function getClientById(id: number): Promise<Client | null> {
  const clients = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return clients.find((c: Client) => c.id === id) || null;
}

export async function createClient(clientData: ClientFormData): Promise<Client> {
  const clients = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const newClient: Client = {
    id: getNextId(),
    ...clientData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  clients.push(newClient);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  return newClient;
}

export async function updateClient(id: number, clientData: ClientFormData): Promise<Client> {
  const clients = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const index = clients.findIndex((c: Client) => c.id === id);
  
  if (index === -1) {
    throw new Error('Client not found');
  }

  const updatedClient: Client = {
    ...clients[index],
    ...clientData,
    updated_at: new Date().toISOString()
  };

  clients[index] = updatedClient;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  return updatedClient;
}

export async function saveDocument(clientId: number, type: Document['type'], name: string | undefined, file: File): Promise<Document> {
  // Create a URL for the file
  const fileUrl = URL.createObjectURL(file);
  
  // Get existing documents
  const documents = await getClientDocuments();
  
  // Create new document
  const newDocument: Document = {
    id: documents.length > 0 ? Math.max(...documents.map(d => d.id)) + 1 : 1,
    client_id: clientId,
    type,
    name,
    file_url: fileUrl,
    uploaded_at: new Date().toISOString()
  };
  
  // Add to documents list
  documents.push(newDocument);
  localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
  
  // Update client's documents
  const clients = await getClients();
  const clientIndex = clients.findIndex(c => c.id === clientId);
  if (clientIndex !== -1) {
    if (!clients[clientIndex].documents) {
      clients[clientIndex].documents = [];
    }
    clients[clientIndex].documents.push(newDocument);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }
  
  return newDocument;
}

export async function deleteDocument(documentId: number): Promise<void> {
  // Get existing documents
  const documents = await getClientDocuments();
  const document = documents.find(d => d.id === documentId);
  
  if (document) {
    // Revoke the URL to free up memory
    URL.revokeObjectURL(document.file_url);
    
    // Remove from documents list
    const updatedDocuments = documents.filter(d => d.id !== documentId);
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(updatedDocuments));
    
    // Update client's documents
    const clients = await getClients();
    const clientIndex = clients.findIndex(c => c.id === document.client_id);
    if (clientIndex !== -1 && clients[clientIndex].documents) {
      clients[clientIndex].documents = clients[clientIndex].documents.filter(d => d.id !== documentId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    }
  }
}

export async function saveClient(id: number | undefined, data: ClientFormData): Promise<Client> {
  const clients = await getClients();
  const timestamp = new Date().toISOString();
  
  let client: Client;
  
  if (id) {
    // Update existing client
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Client not found');
    
    client = {
      ...clients[index],
      ...data,
      updated_at: timestamp
    };
    clients[index] = client;
  } else {
    // Create new client
    client = {
      id: clients.length > 0 ? Math.max(...clients.map(c => c.id)) + 1 : 1,
      ...data,
      created_at: timestamp,
      updated_at: timestamp,
      documents: []
    };
    clients.push(client);
    
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
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
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
  const clients = await getClients();
  const updatedClients = clients.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClients));
}
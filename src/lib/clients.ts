import type { Client, ClientFormData } from '../types';

// Initialize clients in localStorage if it doesn't exist
if (!localStorage.getItem('clients')) {
  localStorage.setItem('clients', JSON.stringify([]));
}

// Helper to get the next ID
function getNextId(): number {
  const clients = JSON.parse(localStorage.getItem('clients') || '[]');
  return clients.length > 0 ? Math.max(...clients.map((c: Client) => c.id)) + 1 : 1;
}

export async function getClients(): Promise<Client[]> {
  const clients = JSON.parse(localStorage.getItem('clients') || '[]');
  return clients.sort((a: Client, b: Client) => 
    new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  );
}

export async function getClientById(id: number): Promise<Client | null> {
  const clients = JSON.parse(localStorage.getItem('clients') || '[]');
  return clients.find((c: Client) => c.id === id) || null;
}

export async function createClient(clientData: ClientFormData): Promise<Client> {
  const clients = JSON.parse(localStorage.getItem('clients') || '[]');
  const newClient: Client = {
    id: getNextId(),
    ...clientData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  clients.push(newClient);
  localStorage.setItem('clients', JSON.stringify(clients));
  return newClient;
}

export async function updateClient(id: number, clientData: ClientFormData): Promise<Client> {
  const clients = JSON.parse(localStorage.getItem('clients') || '[]');
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
  localStorage.setItem('clients', JSON.stringify(clients));
  return updatedClient;
}

export async function deleteClient(id: number): Promise<void> {
  const clients = JSON.parse(localStorage.getItem('clients') || '[]');
  const filteredClients = clients.filter((c: Client) => c.id !== id);
  localStorage.setItem('clients', JSON.stringify(filteredClients));
}
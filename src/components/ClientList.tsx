import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { getClients, deleteClient, updateClient } from '../lib/clients';
import type { Client } from '../types';

interface StatusToggleProps {
  client: Client;
  onToggle: (e: React.MouseEvent, client: Client) => void;
}

const StatusToggle: React.FC<StatusToggleProps> = ({ client, onToggle }) => {
  return (
    <div className="flex items-center">
      <button
        onClick={(e) => onToggle(e, client)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 ${
          client.is_active ? 'bg-primary-600' : 'bg-gray-200'
        }`}
        title="Click to toggle client status"
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            client.is_active ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="ml-2">
        {client.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
};

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ClientList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  // Client being deactivated — we ask for the inactivation date first.
  const [deactivating, setDeactivating] = useState<Client | null>(null);
  const [inactiveDate, setInactiveDate] = useState(todayYMD());
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await deleteClient(id);
      setClients(clients.filter(client => client.id !== id));
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  }

  async function handleStatusToggle(e: React.MouseEvent, client: Client) {
    e.preventDefault();
    e.stopPropagation();

    if (client.is_active) {
      // Deactivating → ask for the inactivation date first.
      setInactiveDate(todayYMD());
      setDeactivating(client);
      return;
    }

    // Reactivating → clear the inactivation date.
    try {
      const updatedClient = await updateClient(client.id, { is_active: true, inactive_date: null });
      setClients(clients.map(c => c.id === client.id ? updatedClient : c));
    } catch (error) {
      console.error('Failed to reactivate client:', error);
    }
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    try {
      const updatedClient = await updateClient(deactivating.id, {
        is_active: false,
        inactive_date: inactiveDate,
      });
      setClients(clients.map(c => c.id === deactivating.id ? updatedClient : c));
      setDeactivating(null);
    } catch (error) {
      console.error('Failed to deactivate client:', error);
      alert('Failed to deactivate client. See console for details.');
    }
  }

  const handleEditClick = (e: React.MouseEvent, client: Client) => {
    e.preventDefault();
    e.stopPropagation();
    if (!client.is_active) {
      alert('Cannot edit an inactive client');
      return;
    }
    navigate(`/clients/${client.id}/edit`);
  };

  const handleRowClick = (clientId: number) => {
    navigate(`/clients/${clientId}`);
  };

  const filteredClients = clients.filter(client => 
    client.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    client.gst_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all clients including their legal name, GST number, contact details, and actions.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/clients/new"
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        </div>
      </div>

      <div className="mt-8 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="relative rounded-md shadow-sm max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                  Legal Name
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  GST Number
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  State
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">No clients found</p>
                      <div className="mt-4">
                        <Link
                          to="/clients/new"
                          className="btn btn-primary"
                        >
                          <Plus className="h-4 w-4" />
                          Add your first client
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr 
                    key={client.id} 
                    onClick={() => handleRowClick(client.id)}
                    className={`group hover:bg-gray-50 cursor-pointer ${!client.is_active ? 'opacity-75' : ''}`}
                  >
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {client.legal_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {client.gst_number || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {client.state || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <StatusToggle 
                        client={client} 
                        onToggle={handleStatusToggle}
                      />
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => handleEditClick(e, client)}
                          disabled={!client.is_active}
                          className={`text-primary-600 hover:text-primary-900 ${!client.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={client.is_active ? 'Edit' : 'Cannot edit inactive client'}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, client.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deactivating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift ring-1 ring-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Deactivate client</h3>
            <p className="mt-1 text-sm text-gray-500">
              {deactivating.legal_name} will be marked inactive. Their recurring revenue (MRR/ARR)
              and projections stop counting from the date below.
            </p>
            <label className="block text-sm font-medium text-gray-700 mt-5 mb-1.5">Inactive from</label>
            <input
              type="date"
              value={inactiveDate}
              onChange={(e) => setInactiveDate(e.target.value)}
              className="form-input w-full"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeactivating(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={confirmDeactivate} disabled={!inactiveDate} className="btn btn-danger">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;
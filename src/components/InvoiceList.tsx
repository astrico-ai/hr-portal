import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { Client, Project, BillableItem } from '../types';
import { getClients } from '../lib/clients';
import { getProjects, getBillableItems } from '../lib/storage';
import ProjectModal from './ProjectModal';
import { useNavigate } from 'react-router-dom';

interface GroupedData {
  client: Client;
  projects: Array<{
    project: Project;
    items: BillableItem[];
  }>;
}

const InvoiceList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [clientsData, projectsData, itemsData] = await Promise.all([
        getClients(),
        getProjects(),
        getBillableItems()
      ]);
      setClients(clientsData);
      setProjects(projectsData);
      setBillableItems(itemsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  const groupedData: GroupedData[] = clients.map(client => ({
    client,
    projects: projects
      .filter(p => p.client_id === client.id)
      .map(project => ({
        project,
        items: billableItems.filter(item => item.project_id === project.id)
      }))
  }));

  const toggleClient = (clientId: number) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const getStatusColor = (status: BillableItem['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'INVOICED': return 'bg-blue-100 text-blue-800';
      case 'PAID': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
          <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your projects and billable items.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      <div className="mt-8 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg divide-y divide-gray-200">
        {groupedData.map(({ client, projects }) => (
          <div key={client.id} className="divide-y divide-gray-200">
            <div 
              className="px-4 py-4 sm:px-6 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleClient(client.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {expandedClients.has(client.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <h3 className="ml-2 text-lg font-medium text-gray-900">
                    {client.legal_name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {projects.length} project{projects.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {expandedClients.has(client.id) && projects.map(({ project, items }) => (
              <div key={project.id} className="px-4 py-4 sm:px-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-medium text-gray-900">{project.name}</h4>
                  <button
                    onClick={() => navigate(`/invoices/project/${project.id}/items/new`)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                </div>

                {items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            PO Number
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Period
                          </th>
                          <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Documents
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {item.po_number}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">
                              ₹{item.amount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {item.po_document_url && (
                                  <a
                                    href={item.po_document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-900"
                                    title="View PO"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </a>
                                )}
                                {item.proposal_document_url && (
                                  <a
                                    href={item.proposal_document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-900"
                                    title="View Proposal"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No billable items yet.</p>
                )}
              </div>
            ))}
          </div>
        ))}

        {groupedData.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No clients found.</p>
          </div>
        )}
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={loadData}
        clients={clients}
      />
    </div>
  );
};

export default InvoiceList; 
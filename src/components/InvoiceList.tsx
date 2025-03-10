import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, Search } from 'lucide-react';
import type { Client, Project, BillableItem } from '../types';
import { getClients } from '../lib/clients';
import { getProjects, getBillableItems } from '../lib/storage';
import ProjectModal from './ProjectModal';
import { useNavigate } from 'react-router-dom';

interface ProjectWithClient {
  project: Project;
  client: Client;
  itemCount: number;
  totalAmount: number;
}

const InvoiceList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProjects(projects);
      return;
    }

    const searchTermLower = searchTerm.toLowerCase();
    const filtered = projects.filter(({ project, client }) => 
      client.legal_name.toLowerCase().includes(searchTermLower) ||
      project.name.toLowerCase().includes(searchTermLower) ||
      project.spoc_name.toLowerCase().includes(searchTermLower) ||
      project.spoc_mobile.toLowerCase().includes(searchTermLower)
    );
    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  async function loadData() {
    try {
      const [clientsData, projectsData, itemsData] = await Promise.all([
        getClients(),
        getProjects(),
        getBillableItems()
      ]);

      const projectsWithClients: ProjectWithClient[] = projectsData.map(project => {
        const client = clientsData.find(c => c.id === project.client_id)!;
        const projectItems = itemsData.filter(item => item.project_id === project.id);
        const totalAmount = projectItems.reduce((sum, item) => sum + item.amount, 0);

        return {
          project,
          client,
          itemCount: projectItems.length,
          totalAmount
        };
      });

      setClients(clientsData);
      setProjects(projectsWithClients);
      setFilteredProjects(projectsWithClients);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all projects and their billable items.
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

      <div className="mt-8 flex items-center gap-4">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client, project, or SPOC..."
            className="form-input pl-10 w-full"
          />
        </div>
      </div>

      <div className="mt-4 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                Client
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Project
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                SPOC
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Mobile
              </th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                Items
              </th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                Total Amount
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      {searchTerm.trim() 
                        ? 'No projects found matching your search'
                        : 'No projects found'}
                    </p>
                    {!searchTerm.trim() && (
                      <div className="mt-4">
                        <button
                          onClick={() => setIsProjectModalOpen(true)}
                          className="btn btn-primary"
                        >
                          <Plus className="h-4 w-4" />
                          Create your first project
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredProjects.map(({ project, client, itemCount, totalAmount }) => (
                <tr 
                  key={project.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/invoices/project/${project.id}`)}
                >
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    {client.legal_name}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {project.name}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    {project.spoc_name}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    {project.spoc_mobile}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 text-right">
                    {itemCount}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 text-right">
                    ₹{totalAmount.toLocaleString()}
                  </td>
                  <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
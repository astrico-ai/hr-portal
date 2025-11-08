import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, Search, AlertCircle, Check, X, FileText, Trash2 } from 'lucide-react';
import type { Client, Project, BillableItem, BillableType, BillableStatus } from '../types';
import { getClients } from '../lib/clients';
import { getProjects, getBillableItems, updateBillableItem, deleteProject } from '../lib/storage';
import ProjectModal from './ProjectModal';
import { useNavigate } from 'react-router-dom';
import { handleDocumentClick } from '../utils/documentUtils';

interface ProjectWithClient {
  project: Project;
  client: Client;
  itemCount: number;
  totalAmount: number;
}

interface PendingInvoice {
  item: BillableItem;
  project: Project;
  client: Client;
}

interface BillableItemWithDetails extends Omit<BillableItem, 'project_id'> {
  project_id: number;
  project?: Project;
  client?: Client;
}

type TabType = 'projects' | 'pending' | 'approve';

const InvoiceList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [approvalItems, setApprovalItems] = useState<BillableItemWithDetails[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [approvingItemId, setApprovingItemId] = useState<number | null>(null);
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithClient | null>(null);
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

      // Get pending invoices (status = RAISED)
      const pendingInvoices: PendingInvoice[] = itemsData
        .filter(item => item.status === 'RAISED')
        .map(item => {
          const project = projectsData.find(p => p.id === item.project_id)!;
          const client = clientsData.find(c => c.id === project.client_id)!;
          return { item, project, client };
        });

      // Get items pending approval
      const approvalItems: BillableItemWithDetails[] = itemsData
        .filter(item => item.status === 'PENDING')
        .map(item => {
          const project = projectsData.find(p => p.id === item.project_id);
          return {
            ...item,
            project,
            client: clientsData.find(c => c.id === project?.client_id)
          };
        });

      setClients(clientsData);
      setProjects(projectsWithClients);
      setFilteredProjects(projectsWithClients);
      setPendingInvoices(pendingInvoices);
      setApprovalItems(approvalItems);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (itemId: number) => {
    try {
      const item = approvalItems.find(i => i.id === itemId);
      if (!item) return;

      const updatedItem: BillableItem = {
        id: item.id,
        project_id: item.project_id,
        name: item.name,
        type: item.type,
        po_number: item.po_number,
        po_end_date: item.po_end_date,
        po_document_url: item.po_document_url,
        proposal_document_url: item.proposal_document_url,
        invoice_number: item.invoice_number,
        invoice_document_url: item.invoice_document_url,
        start_date: item.start_date,
        end_date: item.end_date,
        amount: item.amount,
        invoice_date: item.invoice_date,
        payment_date: item.payment_date,
        status: 'APPROVED',
        sales_manager: item.sales_manager,
        project_manager: item.project_manager,
        cx_manager: item.cx_manager,
        invoice_raised_by: item.invoice_raised_by
      };

      await updateBillableItem(itemId, updatedItem);
      setApprovalItems(approvalItems.filter(i => i.id !== itemId));
      setApprovingItemId(null);
    } catch (error) {
      console.error('Failed to approve item:', error);
    }
  };

  const handleReject = async (itemId: number) => {
    try {
      const item = approvalItems.find(i => i.id === itemId);
      if (!item) return;

      const updatedItem: BillableItem = {
        id: item.id,
        project_id: item.project_id,
        name: item.name,
        type: item.type,
        po_number: item.po_number,
        po_end_date: item.po_end_date,
        po_document_url: item.po_document_url,
        proposal_document_url: item.proposal_document_url,
        invoice_number: item.invoice_number,
        invoice_document_url: item.invoice_document_url,
        start_date: item.start_date,
        end_date: item.end_date,
        amount: item.amount,
        invoice_date: item.invoice_date,
        payment_date: item.payment_date,
        status: 'NOT_APPROVED',
        sales_manager: item.sales_manager,
        project_manager: item.project_manager,
        cx_manager: item.cx_manager,
        invoice_raised_by: item.invoice_raised_by
      };

      await updateBillableItem(itemId, updatedItem);
      setApprovalItems(approvalItems.filter(i => i.id !== itemId));
      setRejectingItemId(null);
    } catch (error) {
      console.error('Failed to reject item:', error);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    try {
      await deleteProject(projectId);
      await loadData(); // Refresh the data
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  // Calculate total amounts
  const totalPendingAmount = pendingInvoices.reduce((sum, { item }) => sum + item.amount, 0);
  const totalApprovalAmount = approvalItems.reduce((sum, item) => sum + item.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('projects')}
            className={`
              py-4 px-1 border-b-2 text-sm font-medium
              ${activeTab === 'projects'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`
              py-4 px-1 border-b-2 text-sm font-medium inline-flex items-center gap-2
              ${activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Pending Invoices
            {pendingInvoices.length > 0 && (
              <span className={`
                rounded-full px-2.5 py-0.5 text-xs font-medium
                ${activeTab === 'pending'
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {pendingInvoices.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('approve')}
            className={`
              py-4 px-1 border-b-2 text-sm font-medium inline-flex items-center gap-2
              ${activeTab === 'approve'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Approve Invoices
            {approvalItems.length > 0 && (
              <span className={`
                rounded-full px-2.5 py-0.5 text-xs font-medium
                ${activeTab === 'approve'
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {approvalItems.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {activeTab === 'projects' ? (
        <>
          <div className="mt-8 sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
              <p className="mt-2 text-sm text-gray-700">
                A list of all projects and their billable items. Click on a project to view details.
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

          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-lg w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by project or SPOC..."
                className="form-input pl-10 w-full"
              />
            </div>
          </div>

          <div className="mt-4 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Project
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Client
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
                  <th scope="col" className="hidden">
                    View
                  </th>
                  <th scope="col" className="hidden">
                    Delete
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
                      className="hover:bg-gray-50 transition duration-150"
                    >
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <button
                          onClick={() => navigate(`/invoices/project/${project.id}`)}
                          className="font-medium text-primary-600 hover:text-primary-900"
                        >
                          {project.name}
                        </button>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {client.legal_name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {project.spoc_name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {project.spoc_mobile}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {itemCount}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm font-medium text-gray-900 text-right">
                        ₹{totalAmount.toLocaleString()}
                      </td>
                      <td className="hidden">
                        <button 
                          onClick={() => navigate(`/invoices/project/${project.id}`)}
                          className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-200"
                          title="View Project"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </td>
                      <td className="hidden">
                        <button
                          onClick={() => setProjectToDelete({ project, client, itemCount, totalAmount })}
                          className="inline-flex items-center justify-center p-2 bg-red-50 text-red-600 hover:text-white hover:bg-red-600 rounded-full transition-colors duration-200"
                          title="Delete Project"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : activeTab === 'pending' ? (
        <>
          <div className="mt-8 sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <h1 className="text-2xl font-semibold text-gray-900">Pending Invoices</h1>
              </div>
              <p className="mt-2 text-sm text-gray-700">
                A list of all raised invoices that are pending payment.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Outstanding Amount</h2>
                <p className="mt-1 text-3xl font-bold text-primary-600">₹{totalPendingAmount.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-500">{pendingInvoices.length} pending invoice{pendingInvoices.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Invoice Number
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Client
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Project
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Item Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Invoice Date
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {pendingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">No pending invoices found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pendingInvoices.map(({ item, client, project }) => (
                    <tr 
                      key={item.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/invoices/project/${project.id}`)}
                    >
                      <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {item.invoice_number}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {client.legal_name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {project.name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900 text-right">
                        ₹{item.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {new Date(item.invoice_date!).toLocaleDateString()}
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
        </>
      ) : (
        <>
          <div className="mt-8 sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h1 className="text-2xl font-semibold text-gray-900">Approve Invoices</h1>
              <p className="mt-2 text-sm text-gray-700">
                Review and approve pending invoice requests.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Total Amount for Approval</h2>
                <p className="mt-1 text-3xl font-bold text-yellow-600">₹{totalApprovalAmount.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-500">{approvalItems.length} invoice{approvalItems.length !== 1 ? 's' : ''} pending approval</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Client
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Project
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Item Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      PO Number
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Period
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Documents
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {approvalItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {item.client?.legal_name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {item.project?.name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {item.type.replace('_', ' ')}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {item.po_document_url ? (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDocumentClick(item.po_document_url!);
                            }}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            {item.po_number}
                          </a>
                        ) : (
                          item.po_number || '-'
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900 text-right">
                        ₹{item.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          {item.po_document_url && (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDocumentClick(item.po_document_url!);
                              }}
                              className="flex items-center gap-1 text-primary-600 hover:text-primary-900"
                              title="View PO Document"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-xs">PO</span>
                            </a>
                          )}
                          {item.proposal_document_url && (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDocumentClick(item.proposal_document_url!);
                              }}
                              className="flex items-center gap-1 text-primary-600 hover:text-primary-900"
                              title="View Proposal"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-xs">Proposal</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={approvingItemId === item.id}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleReject(item.id)}
                            disabled={rejectingItemId === item.id}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {projectToDelete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">
                      Delete Project
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete the project "{projectToDelete.project.name}"? This action cannot be undone and will also delete all associated billable items.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                    onClick={() => handleDeleteProject(projectToDelete.project.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={() => setProjectToDelete(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
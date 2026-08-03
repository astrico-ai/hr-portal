import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, Search, AlertCircle, Check, X, FileText, Trash2 } from 'lucide-react';
import type { Client, Project, BillableItem, BillableType, BillableStatus } from '../types';
import { getClients } from '../lib/clients';
import { getProjects, getBillableItems, updateBillableItem, deleteProject } from '../lib/storage';
import ProjectModal from './ProjectModal';
import { useNavigate } from 'react-router-dom';
import { handleDocumentClick } from '../utils/documentUtils';
import { generateInvoiceNumber } from '../lib/invoiceData';
import { BANK_ACCOUNTS, getBank } from '../lib/invoiceConfig';
import { logAudit } from '../lib/audit';
import GstExport from './GstExport';
import { useAuth } from '../contexts/AuthContext';

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

type TabType = 'projects' | 'pending' | 'approve' | 'export';

const InvoiceList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [approvalItems, setApprovalItems] = useState<BillableItemWithDetails[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const { isAdmin, can } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [approvingItemId, setApprovingItemId] = useState<number | null>(null);
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithClient | null>(null);
  // Bank chosen by the approver per item (required to approve) + full item list for numbering.
  const [bankByItem, setBankByItem] = useState<Record<number, string>>({});
  const [allItems, setAllItems] = useState<BillableItem[]>([]);
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
      setAllItems(itemsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (itemId: number) => {
    try {
      if (!isAdmin) { alert('Only the admin can approve invoices.'); return; }
      const item = approvalItems.find(i => i.id === itemId);
      if (!item) return;

      const bankId = bankByItem[itemId];
      if (!bankId) {
        alert('Please select a bank account before approving this invoice.');
        return;
      }

      // Invoice date = approval date (today). Number = next in that month's series.
      const now = new Date();
      const approvalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const invoiceNo = item.invoice_number || generateInvoiceNumber(approvalDate, allItems);

      const updatedItem: BillableItem = {
        ...item,
        invoice_number: invoiceNo,
        invoice_date: approvalDate,
        status: 'APPROVED',
        bank_account: bankId,
      };

      await updateBillableItem(itemId, updatedItem);
      logAudit('Invoice approved', `${invoiceNo} · ${item.client?.legal_name ?? ''} · ${getBank(bankId)?.bankName ?? ''}`, itemId);
      setAllItems(prev => prev.map(i => (i.id === itemId ? { ...i, invoice_number: invoiceNo } : i)));
      setApprovalItems(approvalItems.filter(i => i.id !== itemId));
      setApprovingItemId(null);
    } catch (error) {
      console.error('Failed to approve item:', error);
      alert('Failed to approve the invoice. See console for details.');
    }
  };

  const handleReject = async (itemId: number) => {
    try {
      const item = approvalItems.find(i => i.id === itemId);
      if (!item) return;

      const updatedItem: BillableItem = {
        ...item,
        status: 'NOT_APPROVED',
      };

      await updateBillableItem(itemId, updatedItem);
      logAudit('Invoice rejected', `${item.name} · ${item.client?.legal_name ?? ''}`, itemId);
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

  // Distinct clients (for the filter dropdown) and the search+filter-scoped,
  // client-grouped project list.
  const clientOptions = Array.from(
    new Map(projects.map(p => [p.client.id, p.client])).values()
  ).sort((a, b) => a.legal_name.localeCompare(b.legal_name));

  const projectGroups = (() => {
    const scoped = filteredProjects.filter(
      p => clientFilter === 'ALL' || p.client.id === Number(clientFilter)
    );
    const map = new Map<number, { client: Client; rows: ProjectWithClient[]; items: number; total: number }>();
    scoped.forEach(p => {
      const g = map.get(p.client.id) || { client: p.client, rows: [], items: 0, total: 0 };
      g.rows.push(p);
      g.items += p.itemCount;
      g.total += p.totalAmount;
      map.set(p.client.id, g);
    });
    return Array.from(map.values()).sort((a, b) => a.client.legal_name.localeCompare(b.client.legal_name));
  })();

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
          {isAdmin && (
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
          )}
          {can('invoices.export') && (
          <button
            onClick={() => setActiveTab('export')}
            className={`
              py-4 px-1 border-b-2 text-sm font-medium
              ${activeTab === 'export'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            GST Export
          </button>
          )}
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
            {can('invoices.create') && (
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </div>
            )}
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
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="form-select w-full sm:w-auto sm:min-w-[200px]"
            >
              <option value="ALL">All clients</option>
              {clientOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}{c.is_active === false ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {projectGroups.length === 0 ? (
            <div className="mt-4 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg py-12 text-center">
              <p className="text-sm text-gray-500">
                {searchTerm.trim() || clientFilter !== 'ALL'
                  ? 'No projects match your search/filter'
                  : 'No projects found'}
              </p>
              {!searchTerm.trim() && clientFilter === 'ALL' && (
                <div className="mt-4">
                  <button onClick={() => setIsProjectModalOpen(true)} className="btn btn-primary">
                    <Plus className="h-4 w-4" />
                    Create your first project
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {projectGroups.map(group => (
                <div key={group.client.id} className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{group.client.legal_name}</h3>
                      {group.client.is_active === false && (
                        <span className="badge bg-gray-100 ring-gray-200 text-gray-500">Inactive</span>
                      )}
                      <span className="text-xs text-gray-400">
                        · {group.rows.length} project{group.rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">₹{group.total.toLocaleString()}</span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {group.rows.map(({ project, itemCount, totalAmount }) => (
                      <li key={project.id}>
                        <button
                          onClick={() => navigate(`/invoices/project/${project.id}`)}
                          className="flex w-full items-center gap-3 px-6 py-3 text-left transition hover:bg-gray-50/70"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-primary-600">{project.name}</p>
                          </div>
                          <span className="badge bg-blue-50 ring-blue-100 text-blue-700">
                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                          </span>
                          <span className="w-28 text-right text-sm font-medium text-gray-900">
                            ₹{totalAmount.toLocaleString()}
                          </span>
                          <ChevronRight className="h-4 w-4 flex-none text-gray-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
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
      ) : activeTab === 'approve' ? (
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
                      Bank Account <span className="text-red-500">*</span>
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
                        <select
                          value={bankByItem[item.id] || ''}
                          onChange={(e) =>
                            setBankByItem(prev => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="form-select w-full min-w-[180px] rounded-lg border-gray-300 py-1.5 text-sm"
                        >
                          <option value="">Select bank…</option>
                          {BANK_ACCOUNTS.map(b => (
                            <option key={b.id} value={b.id}>{b.label}</option>
                          ))}
                        </select>
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
      ) : (
        <div className="mt-8">
          <GstExport
            projects={projects.map(p => p.project)}
            clients={clients}
            billableItems={allItems}
          />
        </div>
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
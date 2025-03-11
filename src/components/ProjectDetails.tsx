import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Pencil, Save, X, Trash2, Download } from 'lucide-react';
import type { Project, Client, BillableItem, BillableType, BillableStatus } from '../types';
import { getProjects, getBillableItems, saveProject, updateBillableItem, deleteBillableItem, uploadDocument } from '../lib/storage';
import { getClients } from '../lib/clients';
import { handleDocumentClick } from '../utils/documentUtils';
import { createInvoiceDocument } from '../utils/invoiceUtils';

interface ProjectInfoProps {
  project: Project;
  onSave: (updatedProject: Project) => Promise<void>;
  client: Client | null;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({ project, onSave, client }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(project);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary btn-sm"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary btn-sm"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
        <form className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="form-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="spoc_name" className="block text-sm font-medium text-gray-700">
              SPOC Name
            </label>
            <input
              type="text"
              id="spoc_name"
              value={formData.spoc_name}
              onChange={(e) => setFormData(prev => ({ ...prev, spoc_name: e.target.value }))}
              className="form-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="spoc_mobile" className="block text-sm font-medium text-gray-700">
              SPOC Mobile
            </label>
            <input
              type="text"
              id="spoc_mobile"
              value={formData.spoc_mobile}
              onChange={(e) => setFormData(prev => ({ ...prev, spoc_mobile: e.target.value }))}
              className="form-input mt-1"
            />
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
        <button
          onClick={() => setIsEditing(true)}
          className={`btn btn-secondary btn-sm ${!client?.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!client?.is_active}
          title={client?.is_active ? 'Edit Project Info' : 'Cannot edit project of inactive client'}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">Project Name</dt>
          <dd className="text-sm text-gray-900">{project.name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">SPOC Name</dt>
          <dd className="text-sm text-gray-900">{project.spoc_name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">SPOC Mobile</dt>
          <dd className="text-sm text-gray-900">{project.spoc_mobile}</dd>
        </div>
      </dl>
    </div>
  );
};

interface EditItemModalProps {
  item: BillableItem;
  client: Client;
  project: Project;
  onSave: (updatedItem: BillableItem, poDocument?: File, proposalDocument?: File, invoiceDocument?: File) => Promise<void>;
  onClose: () => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, client, project, onSave, onClose }) => {
  const [formData, setFormData] = useState(item);
  const [poDocument, setPoDocument] = useState<File | null>(null);
  const [proposalDocument, setProposalDocument] = useState<File | null>(null);
  const [invoiceDocument, setInvoiceDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const formatType = (type: BillableType) => {
    return type.replace('_', ' ').charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
  };

  const getStatusColor = (status: BillableStatus) => {
    switch (status) {
      case 'NOT_APPROVED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'RAISED': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailableStatuses = (currentStatus: BillableStatus): BillableStatus[] => {
    switch (currentStatus) {
      case 'NOT_APPROVED':
        return ['NOT_APPROVED']; // Can only be changed to PENDING via "Send for Approval" button
      case 'PENDING':
        return ['PENDING']; // Can only be changed via Approve Invoices module
      case 'APPROVED':
        return ['APPROVED', 'RAISED', 'RECEIVED']; // Can change to RAISED or RECEIVED
      case 'RAISED':
        return ['RAISED', 'RECEIVED'];
      case 'RECEIVED':
        return ['RECEIVED'];
      default:
        return ['NOT_APPROVED'];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData, poDocument || undefined, proposalDocument || undefined, invoiceDocument || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendForApproval = async () => {
    setLoading(true);
    try {
      const updatedData = { ...formData, status: 'PENDING' as BillableStatus };
      await onSave(updatedData);
      onClose();
    } catch (error) {
      console.error('Failed to send for approval:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    setLoading(true);
    try {
      // Generate invoice PDF blob
      const pdfBlob = await createInvoiceDocument(formData, client, project);
      
      // Create a file from the blob
      const invoiceFile = new File([pdfBlob], `invoice_${formData.id}.pdf`, { type: 'application/pdf' });

      // Upload the invoice document
      const invoiceDocumentUrl = await uploadDocument(invoiceFile, formData.id, 'invoice');

      // Update the item with new status and invoice URL
      const updatedData = { 
        ...formData, 
        status: 'RAISED' as BillableStatus,
        invoice_document_url: invoiceDocumentUrl
      };

      await onSave(updatedData);
      onClose();
    } catch (error) {
      console.error('Failed to create invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Edit Billable Item
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="form-input mt-1 w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as BillableType }))}
              className="form-select mt-1 w-full"
              required
            >
              {['LICENSE', 'ONE_TIME', 'OTHERS'].map(type => (
                <option key={type} value={type}>
                  {formatType(type as BillableType)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
                PO Number
              </label>
              <input
                type="text"
                id="po_number"
                value={formData.po_number || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                className="form-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="po_end_date" className="block text-sm font-medium text-gray-700">
                PO End Date
              </label>
              <input
                type="date"
                id="po_end_date"
                value={formData.po_end_date || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, po_end_date: e.target.value }))}
                className="form-input mt-1 w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="start_date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="form-input mt-1 w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="end_date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="form-input mt-1 w-full"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">₹</span>
              </div>
              <input
                type="number"
                id="amount"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                className="form-input pl-7 w-full"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700">
              Invoice Number {(formData.status === 'RAISED' || formData.status === 'RECEIVED') && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              id="invoice_number"
              value={formData.invoice_number || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
              className="form-input mt-1 w-full"
              required={formData.status === 'RAISED' || formData.status === 'RECEIVED'}
            />
          </div>

          <div>
            <label htmlFor="invoice_date" className="block text-sm font-medium text-gray-700">
              Invoice Date {(formData.status === 'RAISED' || formData.status === 'RECEIVED') && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              id="invoice_date"
              value={formData.invoice_date || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
              className="form-input mt-1 w-full"
              required={formData.status === 'RAISED' || formData.status === 'RECEIVED'}
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as BillableStatus }))}
              className={`form-select mt-1 w-full text-sm font-medium ${getStatusColor(formData.status)}`}
              required
              disabled={formData.status === 'NOT_APPROVED' || formData.status === 'PENDING'}
            >
              {getAvailableStatuses(formData.status).map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {(formData.status === 'NOT_APPROVED' || formData.status === 'PENDING') && (
              <p className="mt-1 text-sm text-gray-500">
                {formData.status === 'NOT_APPROVED' 
                  ? "Use 'Send for Approval' to change status to PENDING"
                  : "Status can only be changed in the Approve Invoices module"}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                PO Document
              </label>
              <div className="mt-1 flex items-center gap-4">
                {item.po_document_url && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentClick(item.po_document_url!);
                    }}
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-900"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Current PO Document
                  </a>
                )}
                <input
                  type="file"
                  onChange={(e) => setPoDocument(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Proposal Document
              </label>
              <div className="mt-1 flex items-center gap-4">
                {item.proposal_document_url && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentClick(item.proposal_document_url!);
                    }}
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-900"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Current Proposal Document
                  </a>
                )}
                <input
                  type="file"
                  onChange={(e) => setProposalDocument(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice Document {(formData.status === 'RAISED' || formData.status === 'RECEIVED') && <span className="text-red-500">*</span>}
              </label>
              <div className="mt-1 flex items-center gap-4">
                {item.invoice_document_url && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentClick(item.invoice_document_url!);
                    }}
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-900"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Current Invoice Document
                  </a>
                )}
                <input
                  type="file"
                  onChange={(e) => setInvoiceDocument(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="form-input"
                  required={
                    (formData.status === 'RAISED' || formData.status === 'RECEIVED') &&
                    !item.invoice_document_url
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            {formData.status === 'NOT_APPROVED' && (
              <button
                type="button"
                onClick={handleSendForApproval}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Sending...' : 'Send for Approval'}
              </button>
            )}
            {formData.status === 'APPROVED' && (
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : 'Create Invoice'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProjectDetails: React.FC = () => {
  const { projectId: projectIdParam } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<BillableItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<BillableType | 'ALL'>('ALL');

  const loadData = async () => {
    try {
      const projectId = parseInt(projectIdParam || '0', 10);
      console.log('Loading project with ID:', projectId);
      
      const [projects, billableItems, clients] = await Promise.all([
        getProjects(),
        getBillableItems(),
        getClients()
      ]);
      
      console.log('Loaded projects:', projects);
      console.log('Loaded billable items:', billableItems);
      console.log('Loaded clients:', clients);

      const project = projects.find(p => p.id === projectId);
      console.log('Found project:', project);
      
      if (!project) {
        console.error('Project not found with ID:', projectId);
        navigate('/invoices');
        return;
      }

      const client = clients.find(c => c.id === project.client_id);
      console.log('Found client:', client);
      
      if (!client) {
        console.error('Client not found for project:', project);
        navigate('/invoices');
        return;
      }

      setProject(project);
      setClient(client);
      setBillableItems(billableItems.filter(item => item.project_id === projectId));
    } catch (error) {
      console.error('Error loading data:', error);
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectIdParam]);

  const handleProjectSave = async (updatedProject: Project) => {
    try {
      await saveProject(updatedProject);
      setProject(updatedProject);
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const handleItemSave = async (updatedItem: BillableItem, poDocument?: File, proposalDocument?: File, invoiceDocument?: File) => {
    try {
      // Handle file uploads if provided
      let poDocumentUrl = updatedItem.po_document_url;
      let proposalDocumentUrl = updatedItem.proposal_document_url;
      let invoiceDocumentUrl = updatedItem.invoice_document_url;

      if (poDocument) {
        poDocumentUrl = await uploadDocument(poDocument, updatedItem.id, 'po');
      }

      if (proposalDocument) {
        proposalDocumentUrl = await uploadDocument(proposalDocument, updatedItem.id, 'proposal');
      }

      if (invoiceDocument) {
        invoiceDocumentUrl = await uploadDocument(invoiceDocument, updatedItem.id, 'invoice');
      }

      const itemToSave = {
        ...updatedItem,
        po_document_url: poDocumentUrl,
        proposal_document_url: proposalDocumentUrl,
        invoice_document_url: invoiceDocumentUrl,
      };

      await updateBillableItem(itemToSave.id, itemToSave);
      setBillableItems(billableItems.map(i => i.id === itemToSave.id ? itemToSave : i));
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update billable item:', error);
    }
  };

  const handleItemDelete = async (itemId: number) => {
    try {
      await deleteBillableItem(itemId);
      setBillableItems(billableItems.filter(i => i.id !== itemId));
      setDeletingItemId(null);
    } catch (error) {
      console.error('Failed to delete billable item:', error);
    }
  };

  const formatType = (type: BillableType) => {
    return type.replace('_', ' ').charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
  };

  const getStatusColor = (status: BillableItem['status']) => {
    switch (status) {
      case 'NOT_APPROVED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'RAISED': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateOneTimeAmounts = (items: BillableItem[]) => {
    const oneTimeItems = items.filter(item => item.type === 'ONE_TIME');
    return {
      raised: oneTimeItems
        .filter(item => item.status === 'RAISED')
        .reduce((total, item) => total + item.amount, 0),
      received: oneTimeItems
        .filter(item => item.status === 'RECEIVED')
        .reduce((total, item) => total + item.amount, 0),
      total: oneTimeItems
        .filter(item => item.status === 'RAISED' || item.status === 'RECEIVED')
        .reduce((total, item) => total + item.amount, 0)
    };
  };

  const calculateLicenseDetails = (items: BillableItem[]) => {
    const licenseItems = items.filter(item => item.type === 'LICENSE');
    const activeItems = licenseItems.filter(item => 
      item.status === 'RAISED' || item.status === 'RECEIVED'
    );
    
    if (activeItems.length === 0) return { 
      raised: 0,
      received: 0,
      total: 0,
      startDate: null, 
      endDate: null 
    };

    const startDate = new Date(Math.min(...activeItems.map(item => new Date(item.start_date).getTime())));
    const endDate = new Date(Math.max(...activeItems.map(item => new Date(item.end_date).getTime())));
    
    return { 
      raised: licenseItems
        .filter(item => item.status === 'RAISED')
        .reduce((total, item) => total + item.amount, 0),
      received: licenseItems
        .filter(item => item.status === 'RECEIVED')
        .reduce((total, item) => total + item.amount, 0),
      total: activeItems.reduce((total, item) => total + item.amount, 0),
      startDate: formatMonthYear(startDate),
      endDate: formatMonthYear(endDate)
    };
  };

  const formatMonthYear = (date: Date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]}${date.getFullYear()}`;
  };

  if (loading || !project || !client) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/invoices')} 
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Project Details
          </h1>
        </div>
      </div>

      <div className="mt-8 bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
            <dl className="mt-4 space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
                <dd className="text-sm text-gray-900">{client.legal_name}</dd>
              </div>
              {client.gst_number && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">GST Number</dt>
                  <dd className="text-sm text-gray-900">{client.gst_number}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className={`text-sm ${client.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {client.is_active ? 'Active' : 'Inactive'}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <ProjectInfo project={project} onSave={handleProjectSave} client={client} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex-auto">
            <h2 className="text-xl font-semibold text-gray-900">Billable Items</h2>
          </div>
          <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="type-filter" className="text-sm font-medium text-gray-700">
                Filter by Type:
              </label>
              <select
                id="type-filter"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as BillableType | 'ALL')}
                className="form-select text-sm"
              >
                <option value="ALL">All Types</option>
                {['LICENSE', 'ONE_TIME', 'OTHERS'].map(type => (
                  <option key={type} value={type}>
                    {formatType(type as BillableType)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => navigate(`/invoices/project/${project.id}/items/new`)}
              className={`btn btn-primary ${!client.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!client.is_active}
              title={client.is_active ? 'Add Item' : 'Cannot add items to inactive client projects'}
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">One-Time Revenue</h3>
              {(() => {
                const { raised, received, total } = calculateOneTimeAmounts(billableItems);
                return (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-600">
                      ₹{total.toLocaleString()}
                    </div>
                    <div className="mt-1 space-y-1 text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500">Raised:</span>
                        <span className="font-medium text-blue-600">₹{raised.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500">Received:</span>
                        <span className="font-medium text-green-600">₹{received.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">License Revenue</h3>
                {(() => {
                  const { startDate, endDate } = calculateLicenseDetails(billableItems);
                  return (
                    <p className="text-xs text-gray-400 mt-1">
                      {startDate && endDate
                        ? `${startDate} - ${endDate}`
                        : 'No active license items'}
                    </p>
                  );
                })()}
              </div>
              {(() => {
                const { raised, received, total } = calculateLicenseDetails(billableItems);
                return (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-600">
                      ₹{total.toLocaleString()}
                    </div>
                    <div className="mt-1 space-y-1 text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500">Raised:</span>
                        <span className="font-medium text-blue-600">₹{raised.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500">Received:</span>
                        <span className="font-medium text-green-600">₹{received.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="mt-6">
          {billableItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      PO Number
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      PO End Date
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Period
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Invoice Number
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Invoice Date
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {billableItems
                    .filter(item => selectedType === 'ALL' || item.type === selectedType)
                    .map(item => (
                    editingItem === item ? (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="inline-block min-w-[8rem]">
                            <span className="block w-full py-2 px-3 text-sm font-medium text-gray-700">
                              {formatType(item.type)}
                            </span>
                          </div>
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
                          {item.po_end_date ? new Date(item.po_end_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900 text-right">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {item.invoice_document_url ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDocumentClick(item.invoice_document_url!);
                              }}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              {item.invoice_number}
                            </a>
                          ) : (
                            item.invoice_number || '-'
                          )}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
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
                            <button
                              onClick={() => client.is_active ? setEditingItem(item) : null}
                              className={`text-gray-600 hover:text-gray-900 ${!client.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={!client.is_active}
                              title={client.is_active ? 'Edit Item' : 'Cannot edit items of inactive client'}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingItemId(item.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="inline-block min-w-[8rem]">
                            <span className="block w-full py-2 px-3 text-sm font-medium text-gray-700">
                              {formatType(item.type)}
                            </span>
                          </div>
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
                          {item.po_end_date ? new Date(item.po_end_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900 text-right">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {item.invoice_document_url ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDocumentClick(item.invoice_document_url!);
                              }}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              {item.invoice_number}
                            </a>
                          ) : (
                            item.invoice_number || '-'
                          )}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
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
                            <button
                              onClick={() => client.is_active ? setEditingItem(item) : null}
                              className={`text-gray-600 hover:text-gray-900 ${!client.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={!client.is_active}
                              title={client.is_active ? 'Edit Item' : 'Cannot edit items of inactive client'}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingItemId(item.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No billable items yet.</p>
              <div className="mt-4">
                <button
                  onClick={() => navigate(`/invoices/project/${project.id}/items/new`)}
                  className={`btn btn-primary ${!client.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!client.is_active}
                  title={client.is_active ? 'Add Item' : 'Cannot add items to inactive client projects'}
                >
                  <Plus className="h-4 w-4" />
                  Add your first item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          client={client}
          project={project}
          onSave={handleItemSave}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingItemId && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delete Billable Item
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete this billable item? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingItemId(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleItemDelete(deletingItemId)}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails; 
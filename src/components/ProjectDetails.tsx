import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Pencil, Save, X, Trash2, Download, Edit2 } from 'lucide-react';
import type { Project, Client, BillableItem, BillableType, BillableStatus, PurchaseOrder, PurchaseOrderFormData } from '../types';
import { getProjects, getBillableItems, saveProject, updateBillableItem, deleteBillableItem, uploadDocument } from '../lib/storage';
import { getClients } from '../lib/clients';
import { getPurchaseOrders, savePurchaseOrder, deletePurchaseOrder, updatePurchaseOrder } from '../lib/purchaseOrders';
import { handleDocumentClick } from '../utils/documentUtils';
import POUploadModal from './POUploadModal';
import EditPOModal from './EditPOModal';

interface ProjectInfoProps {
  project: Project;
  onSave: (updatedProject: Project) => Promise<void>;
  client: Client | null;
}

const formatType = (type: BillableType) => {
  return type.replace('_', ' ').charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
};

const getStatusColor = (status: BillableStatus) => {
  switch (status) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'RAISED': return 'bg-blue-100 text-blue-800';
    case 'RECEIVED': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

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
  onSave: (updatedItem: BillableItem, poDocument?: File, proposalDocument?: File, invoiceDocument?: File) => Promise<void>;
  onClose: () => void;
  purchaseOrders: PurchaseOrder[];
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, onSave, onClose, purchaseOrders }) => {
  const [formData, setFormData] = useState(item);
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null);
  const [invoiceDocument, setInvoiceDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize selectedPOId based on the item's PO
  useEffect(() => {
    if (item.po_number) {
      const matchingPO = purchaseOrders.find(po => po.po_number === item.po_number);
      if (matchingPO) {
        setSelectedPOId(matchingPO.id);
      }
    }
  }, [item, purchaseOrders]);

  const handlePOSelection = (poId: number) => {
    const selectedPO = purchaseOrders.find(po => po.id === poId);
    if (selectedPO) {
      setSelectedPOId(poId);
      setFormData(prev => ({
        ...prev,
        po_number: selectedPO.po_number,
        po_end_date: selectedPO.end_date
      }));
    } else {
      setSelectedPOId(null);
      setFormData(prev => ({
        ...prev,
        po_number: '',
        po_end_date: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOId) {
      alert('Please select a Purchase Order');
        return;
      }

    // Validate invoice fields if status is RAISED or RECEIVED
    if (formData.status === 'RAISED' || formData.status === 'RECEIVED') {
      if (!formData.invoice_number) {
        alert('Invoice number is required when status is Raised or Received');
        return;
      }
      if (!formData.invoice_date) {
        alert('Invoice date is required when status is Raised or Received');
        return;
      }
      if (!formData.invoice_document_url && !invoiceDocument) {
        alert('Invoice document is required when status is Raised or Received');
        return;
      }
    }

    if (formData.invoice_date && formData.po_end_date) {
      if (new Date(formData.invoice_date) > new Date(formData.po_end_date)) {
        alert('Invoice date cannot be after PO end date');
        return;
      }
    }

    setLoading(true);
    try {
      await onSave(formData, undefined, undefined, invoiceDocument || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Edit Invoice
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
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
          </div>

          {/* PO Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Purchase Order Details</h3>
            
            {purchaseOrders.length > 0 ? (
              <>
                <div>
                  <label htmlFor="po_name" className="block text-sm font-medium text-gray-700">
                    PO Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="po_name"
                    value={selectedPOId || ''}
                    onChange={(e) => handlePOSelection(Number(e.target.value))}
                    className="form-select mt-1 w-full"
                    required
                  >
                    <option value="">Select a Purchase Order</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>{po.name}</option>
                    ))}
                  </select>
                </div>

            <div>
              <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
                PO Number
              </label>
              <input
                type="text"
                id="po_number"
                value={formData.po_number || ''}
                    className="form-input mt-1 w-full bg-gray-50"
                    readOnly
              />
            </div>

            <div>
              <label htmlFor="po_end_date" className="block text-sm font-medium text-gray-700">
                PO End Date
              </label>
              <input
                    type="text"
                id="po_end_date"
                    value={formData.po_end_date ? new Date(formData.po_end_date).toLocaleDateString() : ''}
                    className="form-input mt-1 w-full bg-gray-50"
                    readOnly
              />
            </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-md">
                No purchase orders available. Please add a PO first.
          </div>
            )}

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
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Invoice Details</h3>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as BillableStatus }))}
                className="form-select mt-1 w-full"
              required
            >
              {['PENDING', 'RAISED', 'RECEIVED'].map(status => (
                <option key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
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
              <label className="block text-sm font-medium text-gray-700">
                Proposal Document
              </label>
              <div className="mt-1">
                {formData.proposal_document_url && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentClick(formData.proposal_document_url!);
                    }}
                    className="text-primary-600 hover:text-primary-900 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    View Proposal Document
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice Document {(formData.status === 'RAISED' || formData.status === 'RECEIVED') && <span className="text-red-500">*</span>}
              </label>
              <div className="mt-1 flex items-center gap-4">
                {formData.invoice_document_url && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentClick(formData.invoice_document_url!);
                    }}
                    className="text-primary-600 hover:text-primary-900 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Current Invoice
                  </a>
                )}
                <input
                  type="file"
                  onChange={(e) => setInvoiceDocument(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="form-input"
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
            <button
              type="submit"
              disabled={loading || purchaseOrders.length === 0}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const calculatePOUtilization = (po: PurchaseOrder, billableItems: BillableItem[]) => {
  const itemsWithThisPO = billableItems.filter(item => item.po_number === po.po_number);
  const totalUtilized = itemsWithThisPO.reduce((sum, item) => sum + item.amount, 0);
  const utilizationPercentage = (totalUtilized / po.amount) * 100;
  return {
    percentage: Math.min(utilizationPercentage, 100),
    utilized: totalUtilized,
    remaining: po.amount - totalUtilized
  };
};

const getUtilizationColor = (percentage: number) => {
  if (percentage < 50) return 'bg-green-500';
  if (percentage < 80) return 'bg-yellow-500';
  return 'bg-red-500';
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
  const [activeTab, setActiveTab] = useState<'po' | 'invoices'>('po');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [showPOModal, setShowPOModal] = useState(false);
  const [deletingPOId, setDeletingPOId] = useState<number | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

  const loadData = async () => {
    try {
      const projectId = parseInt(projectIdParam || '0', 10);
      console.log('Loading project with ID:', projectId);
      
      const [projects, billableItems, clients, pos] = await Promise.all([
        getProjects(),
        getBillableItems(),
        getClients(),
        getPurchaseOrders(projectId)
      ]);
      
      console.log('Loaded projects:', projects);
      console.log('Loaded billable items:', billableItems);
      console.log('Loaded clients:', clients);
      console.log('Loaded purchase orders:', pos);

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
      setPurchaseOrders(pos);
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

  const handlePOUpload = async (formData: PurchaseOrderFormData) => {
    try {
      const newPO = await savePurchaseOrder(formData);
      setPurchaseOrders(prev => [...prev, newPO]);
      setShowPOModal(false);
    } catch (error) {
      console.error('Failed to save purchase order:', error);
    }
  };

  const handlePODelete = async (poId: number) => {
    try {
      await deletePurchaseOrder(poId);
      setPurchaseOrders(prev => prev.filter(po => po.id !== poId));
      setDeletingPOId(null);
    } catch (error) {
      console.error('Failed to delete purchase order:', error);
    }
  };

  const handleEditPO = async (id: number, updates: Partial<PurchaseOrder>, newDocument?: File) => {
    try {
      let updatedPO: PurchaseOrder;
      
      if (newDocument) {
        // If there's a new document, create a new blob URL
        const documentUrl = URL.createObjectURL(new Blob([newDocument], { type: newDocument.type }));
        updatedPO = await updatePurchaseOrder(id, { ...updates, document_url: documentUrl });
      } else {
        updatedPO = await updatePurchaseOrder(id, updates);
      }

      // Update the POs list
      setPurchaseOrders(prev => prev.map(po => po.id === id ? updatedPO : po));
    } catch (error) {
      console.error('Failed to update PO:', error);
    }
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

      <div className="mt-6">
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:p-6">
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

          {/* Tab Navigation */}
          <div className="mt-8 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('po')}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'po'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                PO
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'invoices'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                Invoices
              </button>
            </nav>
      </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'po' && (
              <div>
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
                    <h2 className="text-xl font-semibold text-gray-900">Purchase Orders</h2>
                    <p className="mt-2 text-sm text-gray-700">
                      Manage all purchase orders for this project.
                    </p>
                  </div>
                  <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <button
                      onClick={() => setShowPOModal(true)}
                      className={`btn btn-primary ${!client?.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!client?.is_active}
                      title={client?.is_active ? 'Add PO' : 'Cannot add PO to inactive client projects'}
                    >
                      <Plus className="h-4 w-4" />
                      Add PO
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  {purchaseOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              PO Name
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              PO Number
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              End Date
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                              Amount
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Utilization
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {purchaseOrders.map((po) => {
                            const utilization = calculatePOUtilization(po, billableItems);
                            return (
                              <tr key={po.id} className="hover:bg-gray-50">
                                <td className="px-3 py-4 text-sm text-gray-900">
                                  {po.name}
                                </td>
                                <td className="px-3 py-4 text-sm text-gray-500">
                                  <button
                                    onClick={() => handleDocumentClick(po.document_url)}
                                    className="text-primary-600 hover:text-primary-900"
                                  >
                                    {po.po_number}
                                  </button>
                                </td>
                                <td className="px-3 py-4 text-sm text-gray-500">
                                  {new Date(po.end_date).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-4 text-sm text-gray-900 text-right">
                                  ₹{po.amount.toLocaleString()}
                                </td>
                                <td className="px-3 py-4 text-sm text-gray-500">
                                  <div className="relative group">
                                    <div className="flex items-center">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                        <div
                                          className={`${getUtilizationColor(utilization.percentage)} h-2 rounded-full transition-all duration-300`}
                                          style={{ width: `${utilization.percentage}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium text-gray-900">
                                        {utilization.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    {/* Tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute z-10 bottom-full left-0 mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                      <div>Total: ₹{po.amount.toLocaleString()}</div>
                                      <div>Used: ₹{utilization.utilized.toLocaleString()}</div>
                                      <div>Remaining: ₹{utilization.remaining.toLocaleString()}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setEditingPO(po)}
                                      className="text-primary-600 hover:text-primary-900 mr-2"
                                      title="Edit PO"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handlePODelete(po.id)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Delete PO"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No purchase orders yet.</p>
                      <div className="mt-4">
                        <button
                          onClick={() => setShowPOModal(true)}
                          className={`btn btn-primary ${!client?.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!client?.is_active}
                          title={client?.is_active ? 'Add PO' : 'Cannot add PO to inactive client projects'}
                        >
                          <Plus className="h-4 w-4" />
                          Add your first PO
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'invoices' && (
              <div>
                <div className="sm:flex sm:items-center">
                  <div className="sm:flex-auto">
                    <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
                    <p className="mt-2 text-sm text-gray-700">
                      Manage all invoices and billable items for this project.
                    </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
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

        <div className="mt-4">
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
                      End Date
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
                          {billableItems.map(item => (
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
            )}
          </div>
        </div>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={handleItemSave}
          onClose={() => setEditingItem(null)}
          purchaseOrders={purchaseOrders}
        />
      )}

      {showPOModal && (
        <POUploadModal
          isOpen={showPOModal}
          onClose={() => setShowPOModal(false)}
          onUpload={handlePOUpload}
          projectId={project?.id || 0}
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

      {/* Delete PO Confirmation Modal */}
      {deletingPOId && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delete Purchase Order
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete this purchase order? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingPOId(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePODelete(deletingPOId)}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {editingPO && (
        <EditPOModal
          po={editingPO}
          isOpen={true}
          onClose={() => setEditingPO(null)}
          onSave={handleEditPO}
        />
      )}
    </div>
  );
};

export default ProjectDetails; 
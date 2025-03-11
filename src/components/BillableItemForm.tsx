import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import type { BillableItem, BillableType, BillableStatus, PurchaseOrder, Project, Client, BillableItemFormData } from '../types';
import { getProjects, getBillableItems, saveBillableItem } from '../lib/storage';
import { getClients } from '../lib/clients';
import { getPurchaseOrders } from '../lib/purchaseOrders';

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

const BillableItemForm: React.FC = () => {
  const { projectId: projectIdParam } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null);
  const [proposalDocument, setProposalDocument] = useState<File | null>(null);
  const [invoiceDocument, setInvoiceDocument] = useState<File | null>(null);

  const [formData, setFormData] = useState<Partial<BillableItemFormData>>({
    type: 'ONE_TIME',
    status: 'PENDING',
    amount: 0,
  });

  const loadData = async () => {
    try {
      const projectId = parseInt(projectIdParam || '0', 10);
      
      const [projects, clients, pos] = await Promise.all([
        getProjects(),
        getClients(),
        getPurchaseOrders(projectId)
      ]);

      const project = projects.find(p => p.id === projectId);
      if (!project) {
        console.error('Project not found');
        navigate('/invoices');
        return;
      }

      const client = clients.find(c => c.id === project.client_id);
      if (!client) {
        console.error('Client not found');
        navigate('/invoices');
        return;
      }

      setProject(project);
      setClient(client);
      setPurchaseOrders(pos);
      setFormData(prev => ({ ...prev, project_id: projectId }));
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
      if (!invoiceDocument) {
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

    setSaving(true);
    try {
      const itemToSave: BillableItemFormData = {
        project_id: parseInt(projectIdParam || '0', 10),
        name: formData.name || '',
        type: formData.type as BillableType,
        po_number: formData.po_number || null,
        po_end_date: formData.po_end_date || null,
        po_document: null,
        proposal_document: proposalDocument,
        invoice_number: formData.invoice_number || null,
        invoice_document: invoiceDocument,
        start_date: formData.start_date || '',
        end_date: formData.end_date || '',
        amount: formData.amount || 0,
        invoice_date: formData.invoice_date || null,
        status: formData.status as BillableStatus
      };

      await saveBillableItem(itemToSave);
      navigate(`/invoices/project/${projectIdParam}`);
    } catch (error) {
      console.error('Failed to save billable item:', error);
    } finally {
      setSaving(false);
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
            onClick={() => navigate(`/invoices/project/${projectIdParam}`)} 
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Add Invoice
          </h1>
        </div>
      </div>

      <div className="mt-6">
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:p-6">
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
                  value={formData.name || ''}
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

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Proposal Document <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    onChange={(e) => setProposalDocument(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                    className="form-input"
                    required
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
                    value={formData.start_date || ''}
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
                    value={formData.end_date || ''}
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
                    value={formData.amount || ''}
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
                  Invoice Document {(formData.status === 'RAISED' || formData.status === 'RECEIVED') && <span className="text-red-500">*</span>}
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    onChange={(e) => setInvoiceDocument(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                    className="form-input"
                    required={formData.status === 'RAISED' || formData.status === 'RECEIVED'}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(`/invoices/project/${projectIdParam}`)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || purchaseOrders.length === 0}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BillableItemForm; 
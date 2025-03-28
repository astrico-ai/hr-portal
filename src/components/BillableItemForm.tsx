import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BillableItemFormData, BillableType, PurchaseOrder, BillableItem, Project } from '../types';
import { saveBillableItem, getPurchaseOrders, getBillableItems, getProjects } from '../lib/storage';

const BILLABLE_TYPES: BillableType[] = ['LICENSE', 'ONE_TIME', 'OTHERS'];
const adminUsers = ['Vraj Sheth', 'Sanuj Philip'];

const BillableItemForm = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<BillableItemFormData>({
    project_id: parseInt(projectId || '0'),
    name: '',
    type: 'LICENSE',
    po_number: null,
    po_end_date: null,
    po_document: null,
    proposal_document: null,
    start_date: '',
    end_date: '',
    amount: 0,
    invoice_number: null,
    invoice_document: null,
    invoice_date: null,
    payment_date: null,
    status: 'NOT_APPROVED',
    sales_manager: '',
    project_manager: '',
    cx_manager: '',
    invoice_raised_by: null
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pos, items, projects] = await Promise.all([
          getPurchaseOrders(parseInt(projectId || '0')),
          getBillableItems(),
          getProjects()
        ]);
        console.log('Loaded POs:', pos);
        console.log('Project ID:', projectId);
        setPurchaseOrders(pos);
        setBillableItems(items);
        
        const currentProject = projects.find(p => p.id === parseInt(projectId || '0'));
        if (currentProject) {
          setProject(currentProject);
          setFormData(prev => ({
            ...prev,
            sales_manager: currentProject.sales_manager,
            project_manager: currentProject.project_manager,
            cx_manager: currentProject.cx_manager
          }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, [projectId]);

  // Calculate available POs with utilization left
  const availablePOs = purchaseOrders.filter(po => {
    const utilizedAmount = billableItems
      .filter(item => item.po_number === po.po_number)
      .reduce((sum, item) => sum + item.amount, 0);
    console.log(`PO ${po.po_number} utilized amount:`, utilizedAmount, 'of total:', po.po_value);
    return utilizedAmount < po.po_value;
  }).map(po => {
    const utilizedAmount = billableItems
      .filter(item => item.po_number === po.po_number)
      .reduce((sum, item) => sum + item.amount, 0);
    const remainingAmount = po.po_value - utilizedAmount;
    return {
      ...po,
      remainingAmount
    };
  });

  console.log('Available POs:', availablePOs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const form = e.target as HTMLFormElement;
      const proposalDocumentInput = form.querySelector<HTMLInputElement>('#proposal_document');
      
      const submitData: BillableItemFormData = {
        ...formData,
        proposal_document: proposalDocumentInput?.files?.[0] || null,
        // Don't include a PO document since we're using an existing PO
        po_document: null
      };

      await saveBillableItem(submitData);
      navigate(`/invoices/project/${projectId}`);
    } catch (error) {
      console.error('Failed to save billable item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-8">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(`/invoices/project/${projectId}`)} 
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Add Billable Item
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="form-input mt-1 w-full"
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
                  required
                  className="form-select mt-1 w-full"
                >
                  {BILLABLE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
                    Purchase Order <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="po_number"
                    value={formData.po_number || ''}
                    onChange={(e) => {
                      const selectedPO = purchaseOrders.find(po => po.po_number === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        po_number: e.target.value || null,
                        po_end_date: selectedPO?.po_end_date || null,
                        po_document_url: selectedPO?.po_document_url || null
                      }));
                    }}
                    required
                    className="form-select mt-1 w-full"
                  >
                    <option value="">Select a PO</option>
                    <option value="NO_PO_REQUIRED">No PO Required</option>
                    {availablePOs.map(po => (
                      <option key={po.id} value={po.po_number}>
                        {po.name} - ₹{po.remainingAmount.toLocaleString()} available
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₹</span>
                    </div>
                    <input
                      type="number"
                      id="amount"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                      required
                      min="0"
                      step="0.01"
                      className="form-input pl-7 w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="sales_manager" className="block text-sm font-medium text-gray-700">
                    Sales Manager <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="sales_manager"
                    value={formData.sales_manager}
                    onChange={(e) => setFormData(prev => ({ ...prev, sales_manager: e.target.value }))}
                    required
                    className="form-select mt-1 w-full"
                  >
                    <option value="">Select Sales Manager</option>
                    {adminUsers.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="project_manager" className="block text-sm font-medium text-gray-700">
                    Project Manager <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="project_manager"
                    value={formData.project_manager}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_manager: e.target.value }))}
                    required
                    className="form-select mt-1 w-full"
                  >
                    <option value="">Select Project Manager</option>
                    {adminUsers.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cx_manager" className="block text-sm font-medium text-gray-700">
                    CX Manager <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="cx_manager"
                    value={formData.cx_manager}
                    onChange={(e) => setFormData(prev => ({ ...prev, cx_manager: e.target.value }))}
                    required
                    className="form-select mt-1 w-full"
                  >
                    <option value="">Select CX Manager</option>
                    {adminUsers.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="proposal_document" className="block text-sm font-medium text-gray-700">
                  Proposal Document
                </label>
                <input
                  type="file"
                  id="proposal_document"
                  name="proposal_document"
                  accept=".pdf,.doc,.docx"
                  className="form-input mt-1 w-full"
                />
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
                    required
                    className="form-input mt-1 w-full"
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
                    required
                    className="form-input mt-1 w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/invoices/project/${projectId}`)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillableItemForm; 
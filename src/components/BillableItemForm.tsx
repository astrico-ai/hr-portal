import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BillableItemFormData, BillableType, BillableStatus } from '../types';
import { saveBillableItem } from '../lib/storage';

const BILLABLE_TYPES: BillableType[] = ['LICENSE', 'ONE_TIME', 'OTHERS'];
const BILLABLE_STATUSES: BillableStatus[] = ['PENDING', 'RAISED', 'RECEIVED'];

const BillableItemForm = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BillableItemFormData>({
    project_id: parseInt(projectId || '0'),
    name: '',
    type: 'LICENSE',
    po_number: '',
    po_end_date: '',
    start_date: '',
    end_date: '',
    amount: 0,
    status: 'PENDING'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const form = e.target as HTMLFormElement;
      const poDocumentInput = form.querySelector<HTMLInputElement>('#po_document');
      const proposalDocumentInput = form.querySelector<HTMLInputElement>('#proposal_document');

      const submitData: BillableItemFormData = {
        ...formData,
        po_document: poDocumentInput?.files?.[0],
        proposal_document: proposalDocumentInput?.files?.[0]
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex items-center gap-4">
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
      </div>

      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl">
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
                className="form-input mt-1"
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
                className="form-input mt-1"
              >
                {BILLABLE_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
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
                value={formData.po_number}
                onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                className="form-input mt-1"
              />
            </div>

            <div>
              <label htmlFor="po_end_date" className="block text-sm font-medium text-gray-700">
                PO End Date
              </label>
              <input
                type="date"
                id="po_end_date"
                value={formData.po_end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, po_end_date: e.target.value }))}
                className="form-input mt-1"
              />
            </div>

            <div>
              <label htmlFor="po_document" className="block text-sm font-medium text-gray-700">
                PO Document
              </label>
              <input
                type="file"
                id="po_document"
                name="po_document"
                accept=".pdf,.doc,.docx"
                className="form-input mt-1"
              />
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
                className="form-input mt-1"
              />
            </div>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
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
                  className="form-input mt-1"
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
                  className="form-input mt-1"
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
                  required
                  min="0"
                  step="0.01"
                  className="form-input pl-7"
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
  );
};

export default BillableItemForm; 
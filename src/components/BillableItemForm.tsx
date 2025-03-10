import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BillableItemFormData, Project } from '../types';
import { saveBillableItem, saveFile } from '../lib/storage';

interface BillableItemFormProps {
  project: Project;
  onSuccess: () => void;
}

const BillableItemForm: React.FC<BillableItemFormProps> = ({ project, onSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<BillableItemFormData>({
    project_id: project.id,
    name: '',
    po_number: '',
    start_date: '',
    end_date: '',
    amount: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Handle file uploads
      const [poDocumentUrl, proposalDocumentUrl] = await Promise.all([
        formData.po_document ? saveFile(formData.po_document) : Promise.resolve(''),
        formData.proposal_document ? saveFile(formData.proposal_document) : Promise.resolve('')
      ]);

      // Save billable item
      await saveBillableItem({
        ...formData,
        po_document_url: poDocumentUrl,
        proposal_document_url: proposalDocumentUrl,
        status: 'PENDING'
      });

      onSuccess();
      navigate('/invoices');
    } catch (error) {
      console.error('Failed to save billable item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'po_document' | 'proposal_document') => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, [field]: file }));
    }
  };

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
            Add Billable Item
          </h1>
        </div>
      </div>

      <div className="mt-8">
        <form onSubmit={handleSubmit} className="bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="space-y-8 divide-y divide-gray-200">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
                  PO Number <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="po_number"
                    name="po_number"
                    value={formData.po_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="po_document" className="block text-sm font-medium text-gray-700">
                  PO Document
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    id="po_document"
                    name="po_document"
                    onChange={(e) => handleFileChange(e, 'po_document')}
                    accept=".pdf,.doc,.docx"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="proposal_document" className="block text-sm font-medium text-gray-700">
                  Proposal Document
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    id="proposal_document"
                    name="proposal_document"
                    onChange={(e) => handleFileChange(e, 'proposal_document')}
                    accept=".pdf,.doc,.docx"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                  End Date <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    required
                    min="0"
                    step="0.01"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillableItemForm; 
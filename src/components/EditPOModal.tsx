import React, { useState } from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import type { PurchaseOrder } from '../types';
import { handleDocumentClick } from '../utils/documentUtils';

interface EditPOModalProps {
  po: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, updates: Partial<PurchaseOrder>, newDocument?: File) => Promise<void>;
}

const EditPOModal: React.FC<EditPOModalProps> = ({ po, isOpen, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: po.name,
    po_number: po.po_number,
    po_value: po.po_value,
    po_end_date: po.po_end_date,
  });
  const [document, setDocument] = useState<File | null>(null);
  const [keepExistingDocument, setKeepExistingDocument] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(
        po.id,
        {
          ...formData,
          po_document_url: keepExistingDocument ? po.po_document_url : '',
        },
        !keepExistingDocument && document ? document : undefined
      );
      onClose();
    } catch (error) {
      console.error('Failed to update PO:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Edit Purchase Order
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                PO Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="form-input mt-1 block w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
                PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="po_number"
                value={formData.po_number}
                onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                className="form-input mt-1 block w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="po_end_date" className="block text-sm font-medium text-gray-700">
                PO End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="po_end_date"
                value={formData.po_end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, po_end_date: e.target.value }))}
                className="form-input mt-1 block w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="po_value" className="block text-sm font-medium text-gray-700">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <input
                  type="number"
                  id="po_value"
                  value={formData.po_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, po_value: parseFloat(e.target.value) }))}
                  className="form-input block w-full pl-7"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Document
              </label>
              {keepExistingDocument && po.po_document_url ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDocumentClick(po.po_document_url);
                      }}
                      className="text-primary-600 hover:text-primary-900 flex items-center"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      View Current Document
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeepExistingDocument(false)}
                    className="text-red-600 hover:text-red-900"
                    title="Remove Document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    onChange={(e) => setDocument(e.target.files?.[0] || null)}
                    accept=".pdf"
                    className="form-input w-full"
                    required={!keepExistingDocument}
                  />
                  {po.po_document_url && (
                    <button
                      type="button"
                      onClick={() => setKeepExistingDocument(true)}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-900"
                    >
                      Keep existing document instead
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 sm:mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
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
    </div>
  );
};

export default EditPOModal; 
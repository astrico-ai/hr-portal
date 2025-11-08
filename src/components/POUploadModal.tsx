import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import type { PurchaseOrderFormData } from '../types';

interface POUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (formData: PurchaseOrderFormData) => Promise<void>;
  projectId: number;
}

const POUploadModal: React.FC<POUploadModalProps> = ({ isOpen, onClose, onUpload, projectId }) => {
  const [step, setStep] = useState<'upload' | 'form'>('upload');
  const [document, setDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<PurchaseOrderFormData, 'po_document' | 'project_id'>>({
    name: '',
    po_number: '',
    po_value: 0,
    po_end_date: '',
  });

  const handleDocumentSelect = (file: File) => {
    setDocument(file);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setLoading(true);
    try {
      await onUpload({
        ...formData,
        project_id: projectId,
        po_document: document,
      });
      onClose();
      // Reset form
      setDocument(null);
      setStep('upload');
      setFormData({
        name: '',
        po_number: '',
        po_value: 0,
        po_end_date: '',
      });
    } catch (error) {
      console.error('Failed to upload PO:', error);
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
              {step === 'upload' ? 'Upload PO Document' : 'Enter PO Details'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {step === 'upload' ? (
            <div className="mt-2">
              <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="po-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="po-upload"
                        name="po-upload"
                        type="file"
                        className="sr-only"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentSelect(file);
                        }}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PDF up to 10MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
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
                  PO Value <span className="text-red-500">*</span>
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

              <div className="mt-5 sm:mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setStep('upload');
                    setDocument(null);
                  }}
                  className="btn btn-secondary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Saving...' : 'Save PO'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default POUploadModal; 
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Pencil, Trash2, Upload, Download } from 'lucide-react';
import type { Client, Document } from '../types';
import { getClients, saveDocument, deleteDocument } from '../lib/clients';
import { handleDocumentClick } from '../utils/documentUtils';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (type: Document['type'], name: string | undefined, file: File) => Promise<void>;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [type, setType] = useState<Document['type']>('MSA');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    try {
      await onUpload(type, type === 'OTHER' ? name : undefined, file);
      onClose();
      setType('MSA');
      setName('');
      setFile(null);
    } catch (error) {
      console.error('Failed to upload document:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Upload Document
          </h3>
          
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as Document['type']);
                  if (e.target.value !== 'OTHER') setName('');
                }}
                className="form-input mt-1"
                required
              >
                <option value="MSA">MSA</option>
                <option value="NDA">NDA</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {type === 'OTHER' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input mt-1"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="file" className="block text-sm font-medium text-gray-700">
                File <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                id="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="form-input mt-1"
                accept=".pdf,.doc,.docx"
                required
              />
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
                disabled={loading || !file}
                className="btn btn-primary"
              >
                {loading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const ClientDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    loadClient();
  }, [id]);

  async function loadClient() {
    if (!id) {
      navigate('/clients');
      return;
    }

    try {
      const clients = await getClients();
      const client = clients.find(c => c.id === parseInt(id));
      
      if (!client) {
        navigate('/clients');
        return;
      }

      setClient(client);
    } catch (error) {
      console.error('Failed to load client:', error);
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  }

  const handleDocumentUpload = async (type: Document['type'], name: string | undefined, file: File) => {
    if (!client) return;
    try {
      await saveDocument(client.id, type, name, file);
      await loadClient();
    } catch (error) {
      console.error('Failed to upload document:', error);
    }
  };

  const handleDocumentDelete = async (documentId: number) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await deleteDocument(documentId);
      await loadClient();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  if (loading || !client) {
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
            onClick={() => navigate('/clients')} 
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Client Details
          </h1>
        </div>
        <div className="mt-4 md:mt-0">
          <Link
            to={`/clients/${client.id}/edit`}
            className="btn btn-secondary"
          >
            <Pencil className="h-4 w-4" />
            Edit Client
          </Link>
        </div>
      </div>

      <div className="mt-8 bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
            <dl className="mt-4 space-y-4">
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
              {client.billing_address && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Billing Address</dt>
                  <dd className="text-sm text-gray-900">{client.billing_address}</dd>
                </div>
              )}
              {client.pincode && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Pincode</dt>
                  <dd className="text-sm text-gray-900">{client.pincode}</dd>
                </div>
              )}
              {client.state && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">State</dt>
                  <dd className="text-sm text-gray-900">{client.state}</dd>
                </div>
              )}
              {client.country && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Country</dt>
                  <dd className="text-sm text-gray-900">{client.country}</dd>
                </div>
              )}
            </dl>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Documents</h3>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="btn btn-primary"
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>
            <div className="mt-4">
              <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Name
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Uploaded At
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {client.documents && client.documents.length > 0 ? (
                        client.documents.map(doc => (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                              {doc.type === 'OTHER' ? doc.name : doc.type}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleDocumentClick(doc.file_url)}
                                  className="text-primary-600 hover:text-primary-900"
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDocumentDelete(doc.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-sm text-gray-500 text-center">
                            No documents uploaded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isUploadModalOpen && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={handleDocumentUpload}
        />
      )}
    </div>
  );
};

export default ClientDetails; 
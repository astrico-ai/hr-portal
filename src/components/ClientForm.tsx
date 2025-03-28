import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Client, ClientFormData } from '../types';
import { getClients, saveClient } from '../lib/clients';
import { useAuth } from '../contexts/AuthContext';

// List of Indian states
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// List of countries (showing a few major ones, you can expand this list)
const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 
  'Japan', 'China', 'Singapore', 'United Arab Emirates'
];

const ClientForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    legal_name: '',
    gst_number: '',
    billing_address: '',
    pincode: '',
    state: '',
    country: '',
    created_by_email: userEmail || '',
  });
  const [msaDocument, setMsaDocument] = useState<File | null>(null);
  const [ndaDocument, setNdaDocument] = useState<File | null>(null);
  const [otherDocuments, setOtherDocuments] = useState<Array<{ name: string; file: File }>>([]);

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  async function loadClient() {
    try {
      const clients = await getClients();
      const client = clients.find(c => c.id === parseInt(id!));
      
      if (!client) {
        navigate('/clients');
        return;
      }

      // Redirect if client is inactive
      if (!client.is_active) {
        alert('Cannot edit an inactive client');
        navigate('/clients');
        return;
      }

      setFormData({
        legal_name: client.legal_name,
        gst_number: client.gst_number || '',
        billing_address: client.billing_address || '',
        pincode: client.pincode || '',
        state: client.state || '',
        country: client.country || '',
        created_by_email: client.created_by_email,
      });
    } catch (error) {
      console.error('Failed to load client:', error);
      navigate('/clients');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalFormData = {
        ...formData,
        msa_document: msaDocument || undefined,
        nda_document: ndaDocument || undefined,
        other_documents: otherDocuments.map(doc => ({
          name: doc.name,
          file: doc.file || undefined
        })),
      };
      await saveClient(id ? parseInt(id) : undefined, finalFormData);
      navigate('/clients');
    } catch (error) {
      console.error('Failed to save client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOtherDocumentAdd = () => {
    setOtherDocuments([...otherDocuments, { name: '', file: null as unknown as File }]);
  };

  const handleOtherDocumentChange = (index: number, field: 'name' | 'file', value: string | File) => {
    const newDocs = [...otherDocuments];
    if (field === 'name') {
      newDocs[index].name = value as string;
    } else {
      newDocs[index].file = value as File;
    }
    setOtherDocuments(newDocs);
  };

  const handleOtherDocumentRemove = (index: number) => {
    setOtherDocuments(otherDocuments.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/clients')} 
          className="btn btn-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">
          {id ? 'Edit Client' : 'New Client'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <label htmlFor="legal_name" className="block text-sm font-medium text-gray-700">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="legal_name"
                    value={formData.legal_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, legal_name: e.target.value }))}
                    required
                    className="form-input mt-1"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label htmlFor="gst_number" className="block text-sm font-medium text-gray-700">
                    GST Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, gst_number: e.target.value }))}
                    required
                    className="form-input mt-1"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="billing_address" className="block text-sm font-medium text-gray-700">
                    Billing Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="billing_address"
                    rows={3}
                    value={formData.billing_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_address: e.target.value }))}
                    required
                    className="form-input mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="pincode" className="block text-sm font-medium text-gray-700">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                    required
                    className="form-input mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    required
                    className="form-input mt-1"
                  >
                    <option value="">Select a state</option>
                    {INDIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    required
                    className="form-input mt-1"
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {!id && (
              <div>
                <h3 className="text-lg font-medium text-gray-900">Documents</h3>
                <div className="mt-6 space-y-6">
                  <div>
                    <label htmlFor="msa_document" className="block text-sm font-medium text-gray-700">
                      MSA Document
                    </label>
                    <input
                      type="file"
                      id="msa_document"
                      onChange={(e) => setMsaDocument(e.target.files?.[0] || null)}
                      className="form-input mt-1"
                      accept=".pdf,.doc,.docx"
                    />
                  </div>

                  <div>
                    <label htmlFor="nda_document" className="block text-sm font-medium text-gray-700">
                      NDA Document
                    </label>
                    <input
                      type="file"
                      id="nda_document"
                      onChange={(e) => setNdaDocument(e.target.files?.[0] || null)}
                      className="form-input mt-1"
                      accept=".pdf,.doc,.docx"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Other Documents
                      </label>
                      <button
                        type="button"
                        onClick={handleOtherDocumentAdd}
                        className="btn btn-secondary btn-sm"
                      >
                        Add Document
                      </button>
                    </div>
                    <div className="mt-2 space-y-4">
                      {otherDocuments.map((doc, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="Document Name"
                              value={doc.name}
                              onChange={(e) => handleOtherDocumentChange(index, 'name', e.target.value)}
                              className="form-input mb-2"
                              required
                            />
                            <input
                              type="file"
                              onChange={(e) => handleOtherDocumentChange(index, 'file', e.target.files?.[0] || null)}
                              className="form-input"
                              accept=".pdf,.doc,.docx"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOtherDocumentRemove(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/clients')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Saving...' : id ? 'Update Client' : 'Create Client'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;
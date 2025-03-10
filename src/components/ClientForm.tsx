import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { createClient, updateClient, getClientById } from '../lib/clients';
import { useAuth } from '../contexts/AuthContext';
import type { ClientFormData } from '../types';

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
  const navigate = useNavigate();
  const { id } = useParams();
  const { userEmail } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<ClientFormData>({
    legal_name: '',
    gst_number: '',
    billing_address: '',
    pincode: '',
    state: 'Maharashtra', // Default state
    country: 'India', // Default country
    created_by_email: userEmail || '', // Set from authenticated user
  });

  React.useEffect(() => {
    if (id) {
      loadClient(parseInt(id));
    }
  }, [id]);

  async function loadClient(clientId: number) {
    try {
      const client = await getClientById(clientId);
      if (client) {
        setFormData({
          legal_name: client.legal_name,
          gst_number: client.gst_number || '',
          billing_address: client.billing_address || '',
          pincode: client.pincode || '',
          state: client.state || 'Maharashtra',
          country: client.country || 'India',
          created_by_email: client.created_by_email || userEmail || '',
        });
      }
    } catch (error) {
      console.error('Failed to load client:', error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSubmit = {
        ...formData,
        created_by_email: userEmail || '', // Ensure we always use the authenticated user's email
      };

      if (id) {
        await updateClient(parseInt(id), dataToSubmit);
      } else {
        await createClient(dataToSubmit);
      }
      navigate('/clients');
    } catch (error) {
      console.error('Failed to save client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
            {id ? 'Edit Client' : 'Add New Client'}
          </h1>
        </div>
      </div>

      <div className="mt-8">
        <form onSubmit={handleSubmit} className="bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="space-y-8 divide-y divide-gray-200">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="legal_name" className="block text-sm font-medium text-gray-700">
                  Legal Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="legal_name"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleChange}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="gst_number" className="block text-sm font-medium text-gray-700">
                  GST Number
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="gst_number"
                    name="gst_number"
                    value={formData.gst_number}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="billing_address" className="block text-sm font-medium text-gray-700">
                  Billing Address
                </label>
                <div className="mt-1">
                  <textarea
                    id="billing_address"
                    name="billing_address"
                    value={formData.billing_address}
                    onChange={handleChange}
                    rows={3}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="pincode" className="block text-sm font-medium text-gray-700">
                  Pincode
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="pincode"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <div className="mt-1">
                  <select
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="form-input"
                  >
                    {INDIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <div className="mt-1">
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="form-input"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
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
    </div>
  );
};

export default ClientForm;
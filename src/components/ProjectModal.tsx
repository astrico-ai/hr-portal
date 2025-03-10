import React from 'react';
import type { Client, ProjectFormData } from '../types';
import { saveProject } from '../lib/storage';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clients: Client[];
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSuccess, clients }) => {
  const [formData, setFormData] = React.useState<ProjectFormData>({
    client_id: 0,
    name: '',
    spoc_name: '',
    spoc_mobile: '',
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveProject(formData);
      onSuccess();
      onClose();
      setFormData({ client_id: 0, name: '', spoc_name: '', spoc_mobile: '' });
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Create New Project
          </h3>
          
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                id="client_id"
                name="client_id"
                value={formData.client_id}
                onChange={(e) => setFormData(prev => ({ ...prev, client_id: Number(e.target.value) }))}
                required
                className="form-input mt-1"
              >
                <option value="">Select a client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.legal_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="form-input mt-1"
              />
            </div>

            <div>
              <label htmlFor="spoc_name" className="block text-sm font-medium text-gray-700">
                Client SPOC Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="spoc_name"
                name="spoc_name"
                value={formData.spoc_name}
                onChange={(e) => setFormData(prev => ({ ...prev, spoc_name: e.target.value }))}
                required
                className="form-input mt-1"
              />
            </div>

            <div>
              <label htmlFor="spoc_mobile" className="block text-sm font-medium text-gray-700">
                SPOC Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="spoc_mobile"
                name="spoc_mobile"
                value={formData.spoc_mobile}
                onChange={(e) => setFormData(prev => ({ ...prev, spoc_mobile: e.target.value }))}
                required
                pattern="[0-9]{10}"
                title="Please enter a valid 10-digit mobile number"
                className="form-input mt-1"
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
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal; 
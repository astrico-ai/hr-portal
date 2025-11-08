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
    sales_manager: '',
    project_manager: '',
    cx_manager: ''
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveProject(formData as any);
      onSuccess();
      onClose();
      setFormData({ client_id: 0, name: '', spoc_name: '', spoc_mobile: '', sales_manager: '', project_manager: '', cx_manager: '' });
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter out inactive clients
  const activeClients = clients.filter(client => client.is_active);

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
                {activeClients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.legal_name}
                  </option>
                ))}
              </select>
              {clients.length > activeClients.length && (
                <p className="mt-1 text-sm text-gray-500">
                  Note: Inactive clients are not shown in the list as new projects cannot be created for them.
                </p>
              )}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="sales_manager" className="block text-sm font-medium text-gray-700">
                  Sales Manager <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="sales_manager"
                  name="sales_manager"
                  value={formData.sales_manager}
                  onChange={(e) => setFormData(prev => ({ ...prev, sales_manager: e.target.value }))}
                  required
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label htmlFor="project_manager" className="block text-sm font-medium text-gray-700">
                  Project Manager <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="project_manager"
                  name="project_manager"
                  value={formData.project_manager}
                  onChange={(e) => setFormData(prev => ({ ...prev, project_manager: e.target.value }))}
                  required
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label htmlFor="cx_manager" className="block text-sm font-medium text-gray-700">
                  CX Manager <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="cx_manager"
                  name="cx_manager"
                  value={formData.cx_manager}
                  onChange={(e) => setFormData(prev => ({ ...prev, cx_manager: e.target.value }))}
                  required
                  className="form-input mt-1"
                />
              </div>
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
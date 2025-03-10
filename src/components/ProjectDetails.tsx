import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Pencil, Save, X, Trash2, Download } from 'lucide-react';
import type { Project, Client, BillableItem, BillableType, BillableStatus } from '../types';
import { getProjects, getBillableItems, saveProject, updateBillableItem, deleteBillableItem, uploadDocument } from '../lib/storage';
import { getClients } from '../lib/clients';

interface ProjectInfoProps {
  project: Project;
  onSave: (updatedProject: Project) => Promise<void>;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({ project, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(project);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary btn-sm"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary btn-sm"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Project Name</dt>
            <dd className="mt-1">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                required
              />
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">SPOC Name</dt>
            <dd className="mt-1">
              <input
                type="text"
                value={formData.spoc_name}
                onChange={(e) => setFormData(prev => ({ ...prev, spoc_name: e.target.value }))}
                className="form-input"
                required
              />
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">SPOC Mobile</dt>
            <dd className="mt-1">
              <input
                type="tel"
                value={formData.spoc_mobile}
                onChange={(e) => setFormData(prev => ({ ...prev, spoc_mobile: e.target.value }))}
                className="form-input"
                pattern="[0-9]{10}"
                title="Please enter a valid 10-digit mobile number"
                required
              />
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
        <button
          onClick={() => setIsEditing(true)}
          className="btn btn-secondary btn-sm"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">Project Name</dt>
          <dd className="text-sm text-gray-900">{project.name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">SPOC Name</dt>
          <dd className="text-sm text-gray-900">{project.spoc_name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">SPOC Mobile</dt>
          <dd className="text-sm text-gray-900">{project.spoc_mobile}</dd>
        </div>
      </dl>
    </div>
  );
};

interface EditItemModalProps {
  item: BillableItem;
  onSave: (updatedItem: BillableItem, poDocument?: File, proposalDocument?: File) => Promise<void>;
  onClose: () => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, onSave, onClose }) => {
  const [formData, setFormData] = useState(item);
  const [poDocument, setPoDocument] = useState<File | null>(null);
  const [proposalDocument, setProposalDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const formatType = (type: BillableType) => {
    return type.replace('_', ' ').charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
  };

  const getStatusColor = (status: BillableStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'RAISED': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData, poDocument || undefined, proposalDocument || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Edit Billable Item
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="form-input mt-1 w-full"
              required
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
              className="form-select mt-1 w-full"
              required
            >
              {['LICENSE', 'ONE_TIME', 'OTHERS'].map(type => (
                <option key={type} value={type}>
                  {formatType(type as BillableType)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
                PO Number
              </label>
              <input
                type="text"
                id="po_number"
                value={formData.po_number || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                className="form-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="po_end_date" className="block text-sm font-medium text-gray-700">
                PO End Date
              </label>
              <input
                type="date"
                id="po_end_date"
                value={formData.po_end_date || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, po_end_date: e.target.value }))}
                className="form-input mt-1 w-full"
              />
            </div>
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
                className="form-input mt-1 w-full"
                required
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
                className="form-input mt-1 w-full"
                required
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
                className="form-input pl-7 w-full"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as BillableStatus }))}
              className={`form-select mt-1 w-full text-sm font-medium ${getStatusColor(formData.status)}`}
              required
            >
              {['PENDING', 'RAISED', 'RECEIVED'].map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                PO Document
              </label>
              <div className="mt-1 flex items-center gap-4">
                {item.po_document_url && (
                  <a
                    href={item.po_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-900"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Current PO Document
                  </a>
                )}
                <input
                  type="file"
                  onChange={(e) => setPoDocument(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Proposal Document
              </label>
              <div className="mt-1 flex items-center gap-4">
                {item.proposal_document_url && (
                  <a
                    href={item.proposal_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-900"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Current Proposal Document
                  </a>
                )}
                <input
                  type="file"
                  onChange={(e) => setProposalDocument(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
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
  );
};

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<BillableItem[]>([]);
  const [editingItem, setEditingItem] = useState<BillableItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const projects = getProjects();
      const project = projects.find(p => p.id === parseInt(projectId || ''));
      if (!project) {
        navigate('/invoices');
        return;
      }

      const clients = await getClients();
      const client = clients.find((c: Client) => c.id === project.client_id);
      if (!client) {
        navigate('/invoices');
        return;
      }

      const allItems = getBillableItems();
      const projectItems = allItems.filter(item => item.project_id === project.id);

      setProject(project);
      setClient(client);
      setItems(projectItems);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      navigate('/invoices');
    }
  };

  const handleProjectSave = async (updatedProject: Project) => {
    try {
      await saveProject(updatedProject);
      setProject(updatedProject);
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const handleItemSave = async (updatedItem: BillableItem, poDocument?: File, proposalDocument?: File) => {
    try {
      // Handle file uploads if provided
      let poDocumentUrl = updatedItem.po_document_url;
      let proposalDocumentUrl = updatedItem.proposal_document_url;

      if (poDocument) {
        poDocumentUrl = await uploadDocument(poDocument, updatedItem.id, 'po');
      }

      if (proposalDocument) {
        proposalDocumentUrl = await uploadDocument(proposalDocument, updatedItem.id, 'proposal');
      }

      const itemToSave = {
        ...updatedItem,
        po_document_url: poDocumentUrl,
        proposal_document_url: proposalDocumentUrl,
      };

      await updateBillableItem(itemToSave.id, itemToSave);
      setItems(items.map(i => i.id === itemToSave.id ? itemToSave : i));
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update billable item:', error);
    }
  };

  const handleItemDelete = async (itemId: number) => {
    try {
      await deleteBillableItem(itemId);
      setItems(items.filter(i => i.id !== itemId));
      setDeletingItemId(null);
    } catch (error) {
      console.error('Failed to delete billable item:', error);
    }
  };

  const formatType = (type: BillableType) => {
    return type.replace('_', ' ').charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
  };

  const getStatusColor = (status: BillableItem['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'RAISED': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !project || !client) {
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
            onClick={() => navigate('/invoices')} 
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Project Details
          </h1>
        </div>
      </div>

      <div className="mt-8 bg-white shadow-sm ring-1 ring-gray-200 px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
            <dl className="mt-4 space-y-2">
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
            </dl>
          </div>
          <div>
            <ProjectInfo project={project} onSave={handleProjectSave} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-xl font-semibold text-gray-900">Billable Items</h2>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => navigate(`/invoices/project/${project.id}/items/new`)}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
        </div>

        <div className="mt-4">
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      PO Number
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      PO End Date
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Period
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map(item => (
                    editingItem === item ? (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="inline-block min-w-[8rem]">
                            <span className="block w-full py-2 px-3 text-sm font-medium text-gray-700">
                              {formatType(item.type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {item.po_document_url ? (
                            <a
                              href={item.po_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-900"
                            >
                              {item.po_number}
                            </a>
                          ) : (
                            item.po_number || '-'
                          )}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {item.po_end_date ? new Date(item.po_end_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900 text-right">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            {item.proposal_document_url && (
                              <a
                                href={item.proposal_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-900"
                                title="View Proposal"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              onClick={() => setEditingItem(item)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Edit Item"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingItemId(item.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="inline-block min-w-[8rem]">
                            <span className="block w-full py-2 px-3 text-sm font-medium text-gray-700">
                              {formatType(item.type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {item.po_document_url ? (
                            <a
                              href={item.po_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-900"
                            >
                              {item.po_number}
                            </a>
                          ) : (
                            item.po_number || '-'
                          )}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {item.po_end_date ? new Date(item.po_end_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900 text-right">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            {item.proposal_document_url && (
                              <a
                                href={item.proposal_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-900"
                                title="View Proposal"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              onClick={() => setEditingItem(item)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Edit Item"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingItemId(item.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No billable items yet.</p>
              <div className="mt-4">
                <button
                  onClick={() => navigate(`/invoices/project/${project.id}/items/new`)}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4" />
                  Add your first item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={handleItemSave}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingItemId && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delete Billable Item
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete this billable item? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingItemId(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleItemDelete(deletingItemId)}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails; 
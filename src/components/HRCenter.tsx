import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, X, Pencil } from 'lucide-react';
import { getEmployees, saveEmployee, updateEmployee, setEmployeeActive, deleteEmployee, type Employee } from '../lib/employees';

const emptyForm = { employee_id: '', name: '', email: '', phone: '' };

const HRCenter: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setEmployees(await getEmployees());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (e: Employee) => {
    setEditingId(e.id!);
    setForm({ employee_id: e.employee_id || '', name: e.name || '', email: e.email || '', phone: e.phone || '' });
    setShowForm(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name.trim()) { alert('Name is required.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateEmployee(editingId, {
          employee_id: form.employee_id.trim() || null,
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        });
      } else {
        await saveEmployee({ ...form, salary: 0, ifsc: '', account_number: '' } as Employee);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert('Failed to save: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (e: Employee) => { await setEmployeeActive(e.id!, e.is_active === false); await load(); };
  const handleDelete = async (e: Employee) => {
    if (!window.confirm(`Remove ${e.name}? This deletes their record (including salary/bank details).`)) return;
    await deleteEmployee(e.id!);
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">HR Center</h1>
          <p className="mt-1 text-sm text-gray-500">Employee directory & profiles</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-6 py-4">
          <Users className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Employees {employees.length > 0 && <span className="text-sm font-normal text-gray-400">({employees.length})</span>}
          </h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No employees yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">Employee ID</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((e) => {
                  const isActive = e.is_active !== false;
                  return (
                    <tr key={e.id} className={isActive ? '' : 'opacity-50'}>
                      <td className="px-6 py-3 font-mono text-xs text-gray-500">{e.employee_id || '—'}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900">{e.name}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{e.email || '—'}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{e.phone || '—'}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleToggle(e)}
                          className={`badge ${isActive ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' : 'bg-gray-100 ring-gray-200 text-gray-500'}`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => openEdit(e)} className="btn btn-ghost btn-sm text-gray-400 hover:text-primary-600" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(e)} className="btn btn-ghost btn-sm text-gray-400 hover:text-red-600" title="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Employee' : 'Add Employee'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Employee ID</label>
                <input className="form-input font-mono" value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="e.g. astrico_1" />
              </div>
              <div>
                <label className="form-label">Name</label>
                <input className="form-input" value={form.name} autoFocus
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nayan Jain" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. nayan@astrico.ai" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="optional" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : editingId ? 'Save' : 'Add Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRCenter;

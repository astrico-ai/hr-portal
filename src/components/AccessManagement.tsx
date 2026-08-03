import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserPlus, Trash2, X, Check, Pencil } from 'lucide-react';
import {
  getAppUsers, addAppUser, updateAppUserPermissions, setAppUserActive, deleteAppUser, type AppUser,
} from '../lib/access';
import { CAPABILITY_GROUPS, ALL_CAPS } from '../lib/permissions';

const AccessManagement: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '' });
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<AppUser | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());

  const load = async () => { setLoading(true); setUsers(await getAppUsers()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email.endsWith('@astrico.ai')) { alert('Only @astrico.ai email addresses can be added.'); return; }
    setSaving(true);
    try {
      await addAppUser(email, form.name);
      setForm({ email: '', name: '' });
      setAddOpen(false);
      await load();
    } catch (err: any) {
      alert('Failed to add user: ' + (err?.message || err));
    } finally { setSaving(false); }
  };

  const openEdit = (u: AppUser) => { setEditing(u); setDraftPerms(new Set(u.permissions || [])); };
  const toggleCap = (key: string) => {
    setDraftPerms((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };
  const toggleGroup = (keys: string[], on: boolean) => {
    setDraftPerms((prev) => { const n = new Set(prev); keys.forEach((k) => (on ? n.add(k) : n.delete(k))); return n; });
  };
  const savePerms = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateAppUserPermissions(editing.email, Array.from(draftPerms).filter((k) => ALL_CAPS.includes(k)));
      setEditing(null);
      await load();
    } catch (err: any) {
      alert('Failed to save: ' + (err?.message || err));
    } finally { setSaving(false); }
  };

  const toggleActive = async (u: AppUser) => { await setAppUserActive(u.email, u.is_active === false); await load(); };
  const remove = async (u: AppUser) => {
    if (!window.confirm(`Remove ${u.email}? They will lose all access immediately.`)) return;
    await deleteAppUser(u.email);
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Access Management</h1>
          <p className="mt-1 text-sm text-gray-500">Who can log in, and exactly what they can do</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn btn-primary btn-sm">
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">User</th>
                <th className="px-3 py-3">Access</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const isActive = u.is_active !== false;
                const count = (u.permissions || []).length;
                return (
                  <tr key={u.email} className={isActive ? '' : 'opacity-50'}>
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-gray-900">{u.name || u.email.split('@')[0]}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      {u.is_admin ? (
                        <span className="badge bg-primary-50 ring-primary-200 text-primary-700">
                          <ShieldCheck className="mr-1 h-3 w-3" /> Admin · full access
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">{count} {count === 1 ? 'permission' : 'permissions'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {u.is_admin ? (
                        <span className="badge bg-emerald-50 ring-emerald-200 text-emerald-700">Active</span>
                      ) : (
                        <button
                          onClick={() => toggleActive(u)}
                          className={`badge ${isActive ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' : 'bg-gray-100 ring-gray-200 text-gray-500'}`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {!u.is_admin && (
                        <>
                          <button onClick={() => openEdit(u)} className="btn btn-ghost btn-sm text-gray-400 hover:text-primary-600" title="Edit permissions">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove(u)} className="btn btn-ghost btn-sm text-gray-400 hover:text-red-600" title="Remove user">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Only <span className="font-medium text-gray-600">@astrico.ai</span> addresses can be added. Invoice approval
        &amp; bank selection are reserved for the admin and can't be granted.
      </p>

      {/* Add user */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add user</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="form-label">Work email</label>
                <input className="form-input" type="email" value={form.email} autoFocus
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@astrico.ai" />
              </div>
              <div>
                <label className="form-label">Name</label>
                <input className="form-input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="optional" />
              </div>
              <p className="text-xs text-gray-400">They'll be added with no permissions — grant them next.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Adding…' : 'Add user'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit permissions */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Permissions</h3>
                <p className="text-xs text-gray-400">{editing.name || editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {CAPABILITY_GROUPS.map((g) => {
                const keys = g.caps.map((c) => c.key);
                const allOn = keys.every((k) => draftPerms.has(k));
                return (
                  <div key={g.module}>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">{g.label}</h4>
                      <button onClick={() => toggleGroup(keys, !allOn)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                        {allOn ? 'Clear' : 'All'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {g.caps.map((c) => {
                        const on = draftPerms.has(c.key);
                        return (
                          <button key={c.key} onClick={() => toggleCap(c.key)}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50">
                            <span className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'}`}>
                              {on && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                            <span>
                              <span className="block text-sm text-gray-700">{c.label}</span>
                              {c.hint && <span className="block text-xs text-gray-400">{c.hint}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={savePerms} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save permissions'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessManagement;

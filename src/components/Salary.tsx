import React, { useEffect, useRef, useState } from 'react';
import { Wallet, Download, Upload, Pencil, X, FileSpreadsheet, Lock } from 'lucide-react';
import {
  getEmployees, updateEmployee, updateEmployeeSalary, bulkUpdateSalaries, type Employee,
} from '../lib/employees';
import { downloadSalarySheet, downloadSalaryTemplate, parseSalaryTemplate } from '../lib/salarySheet';
import { useAuth } from '../contexts/AuthContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const bankType = (ifsc?: string | null) => ((ifsc || '').trim().toUpperCase().startsWith('KKBK') ? 'IFT' : 'NEFT');
const maskAccount = (acc?: string | null) => { const s = String(acc || ''); return s.length > 4 ? `•••• ${s.slice(-4)}` : '••••'; };

const Salary: React.FC = () => {
  const { can } = useAuth();
  const canEdit = can('salary.edit');
  const canExport = can('salary.export');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSalaryId, setEditingSalaryId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [bankForm, setBankForm] = useState({ ifsc: '', account_number: '', salary: '' });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [month, setMonth] = useState(prev.getMonth());
  const [year, setYear] = useState(prev.getFullYear());

  const load = async () => { setLoading(true); setEmployees(await getEmployees()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const active = employees.filter((e) => e.is_active !== false);
  const totalPayout = active.reduce((s, e) => s + (Number(e.salary) || 0), 0);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const handleSalaryChange = async (emp: Employee, value: string) => {
    const salary = Number(value) || 0;
    if (salary === Number(emp.salary)) return;
    try {
      await updateEmployeeSalary(emp.id!, salary);
      setEmployees((prev) => prev.map((x) => (x.id === emp.id ? { ...x, salary } : x)));
    } catch (err: any) { alert('Failed to update salary: ' + (err?.message || err)); }
  };

  const openBankEdit = (e: Employee) => {
    setEditing(e);
    setBankForm({ ifsc: e.ifsc || '', account_number: e.account_number || '', salary: String(e.salary ?? '') });
  };
  const saveBank = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await updateEmployee(editing.id!, {
        ifsc: bankForm.ifsc.trim().toUpperCase() || null,
        account_number: bankForm.account_number.trim() || null,
        salary: Number(bankForm.salary) || 0,
      });
      setEditing(null);
      await load();
    } catch (err: any) { alert('Failed to save: ' + (err?.message || err)); }
    finally { setSaving(false); }
  };

  const handleDownloadSheet = () => {
    if (active.length === 0) { alert('No active employees to pay.'); return; }
    downloadSalarySheet(employees, month, year);
  };

  const handleUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const rows = parseSalaryTemplate(await file.arrayBuffer());
      if (rows.length === 0) { alert('No rows found in the template.'); return; }
      const { updated, unmatched } = await bulkUpdateSalaries(rows);
      await load();
      alert(`Salaries updated: ${updated}.` + (unmatched.length ? `\nNot matched: ${unmatched.join(', ')}` : ''));
    } catch (err: any) {
      alert('Failed to import template: ' + (err?.message || err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Salary</h1>
          <p className="mt-1 text-sm text-gray-500">Bank details, salaries & payout sheet</p>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem('salaryUnlocked'); window.location.reload(); }}
          className="btn btn-secondary btn-sm"
          title="Lock this page"
        >
          <Lock className="h-4 w-4" /> Lock
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Bank salary sheet */}
        <div className="card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Wallet className="h-5 w-5 text-primary-600" />
            <h3 className="text-base font-semibold text-gray-900">Bank salary sheet</h3>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="form-label">Month</label>
              <select className="form-select w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Year</label>
              <select className="form-select w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {canExport && (
              <button onClick={handleDownloadSheet} className="btn btn-primary">
                <Download className="h-4 w-4" /> Download sheet
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {active.length} employees · total {formatCurrency(totalPayout)}. Bank-format Excel,
            today's date, numbers as plain text.
          </p>
        </div>

        {/* Bulk edit via template */}
        <div className="card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <FileSpreadsheet className="h-5 w-5 text-primary-600" />
            <h3 className="text-base font-semibold text-gray-900">Bulk-edit salaries</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Download a simple <span className="font-medium text-gray-700">Name · ID · Salary</span> sheet, edit the
            amounts in Excel, then upload it back to update everyone at once.
          </p>
          <div className="flex flex-wrap gap-3">
            {canExport && (
              <button onClick={() => downloadSalaryTemplate(employees)} className="btn btn-secondary">
                <Download className="h-4 w-4" /> Download template
              </button>
            )}
            {canEdit && (
              <button onClick={() => fileRef.current?.click()} className="btn btn-secondary">
                <Upload className="h-4 w-4" /> Upload template
              </button>
            )}
            {!canExport && !canEdit && <p className="text-sm text-gray-400">View-only access.</p>}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          </div>
        </div>
      </div>

      {/* Employees + bank details */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            Employee bank details {employees.length > 0 && <span className="text-sm font-normal text-gray-400">({employees.length})</span>}
          </h3>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">No employees yet — add them in HR Center.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-3 py-3">Bank (IFSC)</th>
                  <th className="px-3 py-3">Account No.</th>
                  <th className="px-3 py-3 text-right">Monthly salary</th>
                  <th className="px-3 py-3 text-center">Mode</th>
                  <th className="px-6 py-3 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => {
                  const isActive = emp.is_active !== false;
                  return (
                    <tr key={emp.id} className={isActive ? '' : 'opacity-50'}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{emp.name}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">{emp.ifsc || '—'}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">{maskAccount(emp.account_number)}</td>
                      <td className="px-3 py-3 text-right">
                        {canEdit && editingSalaryId === emp.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-gray-400">₹</span>
                            <input
                              type="number"
                              autoFocus
                              defaultValue={Number(emp.salary) || 0}
                              onBlur={(e) => { handleSalaryChange(emp, e.target.value); setEditingSalaryId(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              className="form-input w-28 py-1 text-right text-sm font-semibold"
                            />
                          </div>
                        ) : canEdit ? (
                          <button
                            onClick={() => setEditingSalaryId(emp.id!)}
                            className="text-sm font-semibold tracking-widest text-gray-400 hover:text-primary-600"
                            title="Click to edit salary"
                          >
                            ••••••
                          </button>
                        ) : (
                          <span className="text-sm font-semibold tracking-widest text-gray-400">••••••</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="badge bg-white ring-gray-200 text-gray-500">{bankType(emp.ifsc)}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {canEdit && (
                          <button onClick={() => openBankEdit(emp)} className="btn btn-ghost btn-sm text-gray-400 hover:text-primary-600" title="Edit bank details">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit bank details modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit bank details — {editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={saveBank} className="space-y-4">
              <div>
                <label className="form-label">Bank IFSC</label>
                <input className="form-input font-mono" value={bankForm.ifsc}
                  onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })} placeholder="e.g. ICIC0001243" />
                <p className="mt-1 text-xs text-gray-400">Transfer type: <span className="font-semibold">{bankType(bankForm.ifsc)}</span></p>
              </div>
              <div>
                <label className="form-label">Beneficiary account number</label>
                <input className="form-input font-mono" value={bankForm.account_number}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="e.g. 124301505807" />
              </div>
              <div>
                <label className="form-label">Monthly salary (₹)</label>
                <input className="form-input" type="number" value={bankForm.salary}
                  onChange={(e) => setBankForm({ ...bankForm, salary: e.target.value })} placeholder="e.g. 99800" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salary;

import React, { useEffect, useState } from 'react';
import { Wallet, Plus, Download, Trash2, X, Users } from 'lucide-react';
import { getEmployees, saveEmployee, setEmployeeActive, deleteEmployee, type Employee } from '../lib/employees';
import { downloadSalarySheet } from '../lib/salarySheet';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const bankType = (ifsc?: string) =>
  (ifsc || '').trim().toUpperCase().startsWith('KKBK') ? 'IFT' : 'NEFT';

const emptyForm = { name: '', salary: '', ifsc: '', account_number: '' };

const Disbursement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Salary period defaults to the previous month (salary is paid in arrears).
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [month, setMonth] = useState(prev.getMonth());
  const [year, setYear] = useState(prev.getFullYear());

  const load = async () => {
    setLoading(true);
    setEmployees(await getEmployees());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const active = employees.filter((e) => e.is_active !== false);
  const totalPayout = active.reduce((s, e) => s + (Number(e.salary) || 0), 0);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ifsc.trim() || !form.account_number.trim()) {
      alert('Name, IFSC and account number are required.');
      return;
    }
    setSaving(true);
    try {
      await saveEmployee({
        name: form.name,
        salary: Number(form.salary) || 0,
        ifsc: form.ifsc,
        account_number: form.account_number,
      });
      setForm(emptyForm);
      setShowAdd(false);
      await load();
    } catch (err: any) {
      alert('Failed to add employee: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (emp: Employee) => {
    await setEmployeeActive(emp.id!, emp.is_active === false);
    await load();
  };

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Remove ${emp.name} from the payroll? This can't be undone.`)) return;
    await deleteEmployee(emp.id!);
    await load();
  };

  const handleDownload = () => {
    if (active.length === 0) {
      alert('No active employees to pay.');
      return;
    }
    downloadSalarySheet(employees, month, year);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Disbursement</h1>
          <p className="mt-1 text-sm text-gray-500">Employee payroll & bank salary sheet</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Generate salary sheet */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Wallet className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">Generate salary sheet</h3>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="form-label">Salary for month</label>
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
          <div className="flex-1 min-w-[200px]">
            <div className="rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{active.length}</span> employees ·
              total <span className="font-semibold text-gray-900">{formatCurrency(totalPayout)}</span>
            </div>
          </div>
          <button onClick={handleDownload} className="btn btn-primary">
            <Download className="h-4 w-4" />
            Download salary sheet
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          The sheet uses today's date as the payment date, {MONTHS[month]} {year} as the narration, and all
          numbers as plain text. Only active employees are included.
        </p>
      </div>

      {/* Employees */}
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
            <p className="mt-3 text-sm text-gray-500">No employees yet. Add one to build the salary sheet.</p>
          </div>
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
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => {
                  const isActive = emp.is_active !== false;
                  return (
                    <tr key={emp.id} className={isActive ? '' : 'opacity-50'}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{emp.name}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">{emp.ifsc}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">{emp.account_number}</td>
                      <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(Number(emp.salary) || 0)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="badge bg-white ring-gray-200 text-gray-500">{bankType(emp.ifsc)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleToggle(emp)}
                          className={`badge ${isActive ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' : 'bg-gray-100 ring-gray-200 text-gray-500'}`}
                          title="Toggle active"
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => handleDelete(emp)} className="btn btn-ghost btn-sm text-gray-400 hover:text-red-600" title="Remove">
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

      {/* Add employee modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Employee</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="form-label">Name</label>
                <input className="form-input" value={form.name} autoFocus
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nayan" />
              </div>
              <div>
                <label className="form-label">Monthly salary (₹)</label>
                <input className="form-input" type="number" value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. 99800" />
              </div>
              <div>
                <label className="form-label">Bank IFSC</label>
                <input className="form-input font-mono" value={form.ifsc}
                  onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} placeholder="e.g. ICIC0001243" />
                <p className="mt-1 text-xs text-gray-400">
                  Transfer type auto-detected: <span className="font-semibold">{bankType(form.ifsc)}</span> (KKBK → IFT, else NEFT)
                </p>
              </div>
              <div>
                <label className="form-label">Beneficiary account number</label>
                <input className="form-input font-mono" value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="e.g. 124301505807" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving…' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Disbursement;

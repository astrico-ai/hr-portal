import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import type { BillableItem, Client, Project } from '../types';
import { invoiceMonths, buildGstRows, exportGstExcel } from '../lib/gstExport';

interface GstExportProps {
  projects: Project[] | { id: number; client_id: number; name: string }[];
  clients: Client[];
  billableItems: BillableItem[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (key: string) => {
  if (key === 'ALL') return 'All time';
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
};
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const GstExport: React.FC<GstExportProps> = ({ projects, clients, billableItems }) => {
  const months = useMemo(() => invoiceMonths(billableItems), [billableItems]);
  const [month, setMonth] = useState<string>(months[0] || 'ALL');

  const rows = useMemo(
    () => buildGstRows(billableItems, projects as Project[], clients, month),
    [billableItems, projects, clients, month]
  );
  const taxable = rows.reduce((s, r) => s + r.taxable, 0);
  const tax = rows.reduce((s, r) => s + r.cgstAmt + r.sgstAmt + r.igstAmt, 0);

  const handleExport = () => {
    if (rows.length === 0) return;
    exportGstExcel(rows, `GST-${month === 'ALL' ? 'all' : month}.xlsx`);
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">GST Export</h3>
            <p className="text-xs text-gray-500">Excel of issued invoices for your CA / GSTR filing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="form-select inline-block w-auto rounded-lg border-gray-300 py-1.5 pl-3 pr-9 text-sm font-medium text-gray-700"
          >
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
            <option value="ALL">All time</option>
          </select>
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download Excel
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6 border-t border-gray-100 pt-4 text-sm">
        <div>
          <p className="text-gray-400">Invoices</p>
          <p className="font-semibold text-gray-900">{rows.length}</p>
        </div>
        <div>
          <p className="text-gray-400">Taxable value</p>
          <p className="font-semibold text-gray-900">{formatCurrency(taxable)}</p>
        </div>
        <div>
          <p className="text-gray-400">Tax (CGST+SGST / IGST)</p>
          <p className="font-semibold text-gray-900">{formatCurrency(tax)}</p>
        </div>
        <div>
          <p className="text-gray-400">Total</p>
          <p className="font-semibold text-gray-900">{formatCurrency(taxable + tax)}</p>
        </div>
      </div>
    </div>
  );
};

export default GstExport;

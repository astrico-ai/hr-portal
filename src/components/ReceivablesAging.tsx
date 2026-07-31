import React, { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import type { BillableItem, Client, Project } from '../types';

interface AgingProject {
  id: number;
  client_id: number;
  name: string;
}
interface ReceivablesAgingProps {
  projects: AgingProject[] | Project[];
  clients: Client[];
  billableItems: BillableItem[];
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const BUCKETS = [
  { key: '0-30', label: 'Current (0–30d)', ring: 'ring-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { key: '31-60', label: '31–60 days', ring: 'ring-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  { key: '61-90', label: '61–90 days', ring: 'ring-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  { key: '90+', label: '90+ days', ring: 'ring-red-200', text: 'text-red-700', dot: 'bg-red-500' },
] as const;

const bucketOf = (days: number) => (days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+');

const ReceivablesAging: React.FC<ReceivablesAgingProps> = ({ projects, clients, billableItems }) => {
  const { rows, totals, grandTotal } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clientName = (projectId: number) => {
      const project = (projects as AgingProject[]).find((p) => p.id === projectId);
      const client = clients.find((c) => c.id === project?.client_id);
      return { client: client?.legal_name ?? '—', project: project?.name ?? '—' };
    };

    // Outstanding = invoiced (RAISED) but not yet received.
    const rows = billableItems
      .filter((i) => i.status === 'RAISED')
      .map((i) => {
        const base = i.invoice_date || i.start_date;
        const dt = base ? new Date(base) : today;
        const days = Math.max(0, Math.round((today.getTime() - dt.getTime()) / 86400000));
        return { ...clientName(i.project_id), invoice: i.invoice_number || `#${i.id}`, amount: i.amount, days, bucket: bucketOf(days) };
      })
      .sort((a, b) => b.days - a.days);

    const totals: Record<string, { count: number; amount: number }> = {};
    BUCKETS.forEach((b) => (totals[b.key] = { count: 0, amount: 0 }));
    rows.forEach((r) => {
      totals[r.bucket].count += 1;
      totals[r.bucket].amount += r.amount;
    });
    const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

    return { rows, totals, grandTotal };
  }, [billableItems, projects, clients]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">Accounts Receivable — Aging</h3>
        </div>
        <span className="text-sm text-gray-500">
          Outstanding <span className="font-semibold text-gray-900">{formatCurrency(grandTotal)}</span>
        </span>
      </div>

      {/* Bucket summary */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {BUCKETS.map((b) => (
          <div key={b.key} className={`rounded-xl bg-white p-4 ring-1 ${b.ring}`}>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${b.dot}`} />
              <span className="text-xs font-medium text-gray-500">{b.label}</span>
            </div>
            <p className="mt-1.5 text-xl font-semibold text-gray-900">{formatCurrency(totals[b.key].amount)}</p>
            <p className="text-xs text-gray-400">{totals[b.key].count} invoice{totals[b.key].count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Detail table */}
      {rows.length === 0 ? (
        <div className="px-6 pb-8 pt-2 text-center text-sm text-gray-500">
          Nothing outstanding — all invoiced amounts are collected. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto px-2 pb-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Age</th>
                <th className="px-4 py-2">Bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => {
                const b = BUCKETS.find((x) => x.key === r.bucket)!;
                return (
                  <tr key={i} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 text-gray-900">{r.client}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.project}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{r.invoice}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.days}d</td>
                    <td className="px-4 py-2.5">
                      <span className={`badge bg-white ${b.ring} ${b.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
                        {b.key}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReceivablesAging;

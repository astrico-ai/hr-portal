import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import type { BillableItem, Client } from '../types';

interface DueProject {
  id: number;
  client_id: number;
  name: string;
  is_active?: boolean;
}
interface NextDueInvoicesProps {
  projects: DueProject[];
  clients: Client[];
  billableItems: BillableItem[];
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const parseYMD = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const toYMD = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const addDays = (dt: Date, n: number) => { const d = new Date(dt); d.setDate(d.getDate() + n); return d; };
const addMonths = (dt: Date, n: number) => { const d = new Date(dt); d.setMonth(d.getMonth() + n); return d; };
const niceDate = (dt: Date) => dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

const FREQ_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
const freqLabel = (f?: string) => (f ? f.replace('_', '-').toLowerCase() : 'recurring');

const NextDueInvoices: React.FC<NextDueInvoicesProps> = ({ projects, clients, billableItems }) => {
  const navigate = useNavigate();

  const due = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeClientIds = new Set(clients.filter((c) => c.is_active !== false).map((c) => c.id));

    // Group license items by project.
    const byProject: Record<number, BillableItem[]> = {};
    billableItems
      .filter((b) => b.type === 'LICENSE')
      .forEach((b) => { (byProject[b.project_id] ||= []).push(b); });

    const rows = Object.entries(byProject).map(([pid, items]) => {
      const project = projects.find((p) => p.id === Number(pid));
      // Skip deactivated projects and projects under deactivated clients.
      if (!project || project.is_active === false || !activeClientIds.has(project.client_id)) return null;

      // Latest license period for this project.
      const latest = [...items].sort((a, b) => {
        const ea = parseYMD(a.end_date)?.getTime() ?? parseYMD(a.start_date)?.getTime() ?? 0;
        const eb = parseYMD(b.end_date)?.getTime() ?? parseYMD(b.start_date)?.getTime() ?? 0;
        return eb - ea;
      })[0];
      const lastStart = parseYMD(latest.start_date);
      const lastEnd = parseYMD(latest.end_date) || lastStart;
      if (!lastEnd) return null;

      // Next period begins the day after the last one ends.
      const nextStart = addDays(lastEnd, 1);
      let nextEnd: Date;
      if (latest.billing_frequency && FREQ_MONTHS[latest.billing_frequency]) {
        nextEnd = addDays(addMonths(nextStart, FREQ_MONTHS[latest.billing_frequency]), -1);
      } else if (latest.billing_frequency === 'CUSTOM' && latest.custom_interval_days) {
        nextEnd = addDays(nextStart, latest.custom_interval_days - 1);
      } else if (lastStart) {
        const spanDays = Math.round((lastEnd.getTime() - lastStart.getTime()) / 86400000);
        nextEnd = addDays(nextStart, spanDays);
      } else {
        nextEnd = addDays(nextStart, 29);
      }

      const daysFromToday = Math.round((nextStart.getTime() - today.getTime()) / 86400000);
      // Show recently-due (≤92d overdue) + upcoming (≤31d out); skip ancient/churned.
      if (daysFromToday > 31 || daysFromToday < -92) return null;

      const client = clients.find((c) => c.id === project.client_id);
      return {
        projectId: project.id,
        projectName: project.name,
        clientName: client?.legal_name ?? '—',
        frequency: latest.billing_frequency,
        value: latest.amount,
        nextStart,
        nextEnd,
        daysFromToday,
        isDue: daysFromToday <= 0,
        // Pre-fill payload for the billable-item form.
        prefill: {
          name: latest.name,
          type: 'LICENSE' as const,
          billing_frequency: latest.billing_frequency,
          custom_interval_days: latest.custom_interval_days ?? null,
          amount: latest.amount,
          po_number: latest.po_number,
          start_date: toYMD(nextStart),
          end_date: toYMD(nextEnd),
        },
      };
    });

    return rows.filter(Boolean).sort((a, b) => a!.daysFromToday - b!.daysFromToday) as NonNullable<typeof rows[number]>[];
  }, [billableItems, projects, clients]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">Next Due Invoices</h3>
        </div>
        <span className="text-sm text-gray-500">
          {due.filter((d) => d.isDue).length} due · {due.filter((d) => !d.isDue).length} upcoming
        </span>
      </div>

      {due.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500">
          No license invoices due right now. 🎉
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {due.map((d) => (
            <li key={d.projectId} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">{d.projectName}</p>
                  <span className="badge bg-white ring-gray-200 text-gray-500 capitalize">{freqLabel(d.frequency)}</span>
                  {d.isDue ? (
                    <span className="badge bg-red-50 ring-red-200 text-red-700">
                      {d.daysFromToday === 0 ? 'Due today' : `${Math.abs(d.daysFromToday)}d overdue`}
                    </span>
                  ) : (
                    <span className="badge bg-amber-50 ring-amber-200 text-amber-700">in {d.daysFromToday}d</span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-400">
                  {d.clientName} · {niceDate(d.nextStart)} – {niceDate(d.nextEnd)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(d.value)}</p>
                <p className="text-[11px] text-gray-400">expected</p>
              </div>
              <button
                onClick={() => navigate(`/invoices/project/${d.projectId}/items/new`, { state: d.prefill })}
                className="btn btn-primary btn-sm group"
              >
                Go
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NextDueInvoices;

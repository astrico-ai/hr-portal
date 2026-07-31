import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, Check, FolderKanban } from 'lucide-react';
import type { BillableItem, Client } from '../types';

interface GanttProject {
  id: number;
  client_id: number;
  name: string;
}

interface LicenseGanttProps {
  projects: GanttProject[];
  clients: Client[];
  billableItems: BillableItem[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Month index helpers (year*12 + monthIndex0).
const ymOf = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const [y, m] = dateStr.split('-').map(Number);
  if (!y || !m) return null;
  return y * 12 + (m - 1);
};
const labelOf = (ym: number) => `${MONTHS[ym % 12]} '${String(Math.floor(ym / 12) % 100).padStart(2, '0')}`;

// Number of months a license covers — SAME day-span rule the dashboard uses for
// MRR, so the Gantt highlights exactly as many months as MRR counts (a mid-month
// 15 Jul → 14 Oct license = 3 months, not the 4 calendar months it touches).
const monthsCovered = (start?: string | null, end?: string | null): number => {
  if (!start) return 1;
  const s = new Date(start);
  const e = new Date(end || start);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(1, Math.round(days / 30.44));
};
// Inclusive [startYM, endYM] a license highlights: anchored at the start month,
// extended by its month-count. Returns null if the start date is unparseable.
const coveredRange = (it: { start_date?: string | null; end_date?: string | null }) => {
  const s = ymOf(it.start_date);
  if (s == null) return null;
  return { start: s, end: s + monthsCovered(it.start_date, it.end_date) - 1 };
};

// Indian financial year (Apr–Mar). FY start year for a given month index.
const fyStartOfYM = (ym: number) => {
  const y = Math.floor(ym / 12);
  const m0 = ym % 12; // 0=Jan ... 2=Mar belong to the previous FY
  return m0 <= 2 ? y - 1 : y;
};
const fyLabel = (start: number) => `FY ${start}-${String(start + 1).slice(2)}`;

// Visual treatment per status (most-advanced state wins for a covered month).
const STATUS_STYLE: Record<string, { cell: string; label: string }> = {
  RECEIVED: { cell: 'bg-emerald-500', label: 'Paid' },
  RAISED: { cell: 'bg-blue-500', label: 'Invoiced' },
  APPROVED: { cell: 'bg-indigo-400', label: 'Approved' },
  PENDING: { cell: 'bg-amber-400', label: 'Pending' },
  NOT_APPROVED: { cell: 'bg-amber-400', label: 'Pending' },
};
const STATUS_RANK: Record<string, number> = {
  RECEIVED: 5, RAISED: 4, APPROVED: 3, PENDING: 2, NOT_APPROVED: 1,
};
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

// Current FY start year (Apr–Mar), recomputed each mount so it always defaults to "now".
const currentFYStart = (() => {
  const now = new Date();
  return now.getMonth() <= 2 ? now.getFullYear() - 1 : now.getFullYear();
})();

const LicenseGantt: React.FC<LicenseGanttProps> = ({ projects, clients, billableItems }) => {
  const [selectedFY, setSelectedFY] = useState<number | 'ALL'>(currentFYStart);
  // Projects the user has REMOVED from the chart. Checked in the menu = hidden.
  // Persisted to localStorage so the curated view survives a refresh.
  const [hiddenProjects, setHiddenProjects] = useState<number[]>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('licenseGantt.hiddenProjects') || '[]');
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'number') : [];
    } catch {
      return [];
    }
  });
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('licenseGantt.hiddenProjects', JSON.stringify(hiddenProjects));
    } catch {
      /* ignore storage errors (private mode / quota) */
    }
  }, [hiddenProjects]);

  const licenseItems = useMemo(
    () => billableItems.filter((b) => b.type === 'LICENSE'),
    [billableItems]
  );

  // All projects that have any license activity — the filter's option list.
  const licenseProjects = useMemo(() => {
    const ids = new Set(licenseItems.map((i) => i.project_id));
    return projects
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [licenseItems, projects]);

  // FY options available from the data (plus the current FY, always selectable).
  const fyOptions = useMemo(() => {
    const set = new Set<number>([currentFYStart]);
    for (const it of licenseItems) {
      const s = ymOf(it.start_date);
      const e = ymOf(it.end_date) ?? s;
      if (s != null) set.add(fyStartOfYM(s));
      if (e != null) set.add(fyStartOfYM(e));
    }
    return Array.from(set).sort((a, b) => b - a); // most recent first
  }, [licenseItems]);

  const toggleHidden = (id: number) =>
    setHiddenProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const projectLabel =
    hiddenProjects.length === 0 ? 'All projects' : `${hiddenProjects.length} hidden`;

  const { rows, months } = useMemo(() => {
    if (licenseItems.length === 0) return { rows: [], months: [] as number[] };

    // Month window: a single FY (Apr–Mar), or the full data span for "ALL".
    let startYM: number;
    let endYM: number;
    if (selectedFY === 'ALL') {
      let minYM = Infinity;
      let maxYM = -Infinity;
      for (const it of licenseItems) {
        const s = ymOf(it.start_date);
        const e = ymOf(it.end_date) ?? s;
        if (s != null) { minYM = Math.min(minYM, s); maxYM = Math.max(maxYM, e ?? s); }
      }
      startYM = minYM;
      endYM = Math.min(maxYM, minYM + 35);
    } else {
      startYM = selectedFY * 12 + 3; // April
      endYM = (selectedFY + 1) * 12 + 2; // March
    }

    const months: number[] = [];
    for (let ym = startYM; ym <= endYM; ym++) months.push(ym);

    const clientName = (id: number) => clients.find((c) => c.id === id)?.legal_name ?? '—';

    // Pick which projects to show:
    //  - explicit selection → show exactly those (even if empty this FY)
    //  - no selection → show license projects with activity in the window
    // Every project with activity in the window, minus the ones the user removed.
    const visibleProjects = licenseProjects
      .filter((p) => !hiddenProjects.includes(p.id))
      .filter((p) =>
        licenseItems.some((it) => {
          if (it.project_id !== p.id) return false;
          const r = coveredRange(it);
          return r != null && r.start <= endYM && r.end >= startYM;
        })
      );

    const rows = visibleProjects.map((p) => {
      const items = licenseItems.filter((it) => it.project_id === p.id);
      const cells = months.map((ym) => {
        const covering = items.filter((it) => {
          const r = coveredRange(it);
          return r != null && r.start <= ym && ym <= r.end;
        });
        if (covering.length === 0) return null;
        return covering.reduce((a, b) =>
          (STATUS_RANK[b.status] ?? 0) > (STATUS_RANK[a.status] ?? 0) ? b : a
        );
      });
      return { project: p, client: clientName(p.client_id), cells };
    });

    return { rows, months };
  }, [licenseItems, licenseProjects, clients, selectedFY, hiddenProjects]);

  const legend = [
    { label: 'Paid', dot: 'bg-emerald-500' },
    { label: 'Invoiced', dot: 'bg-blue-500' },
    { label: 'Approved', dot: 'bg-indigo-400' },
    { label: 'Pending', dot: 'bg-amber-400' },
    { label: 'No invoice', dot: 'bg-gray-200' },
  ];

  return (
    <div className="card">
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <CalendarRange className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">
            License Invoicing &amp; Payments
            {rows.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({rows.length})</span>
            )}
          </h3>

          {/* FY filter */}
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="form-select inline-block w-auto rounded-lg border-gray-300 py-1.5 pl-3 pr-9 text-sm font-medium text-gray-700"
          >
            {fyOptions.map((fy) => (
              <option key={fy} value={fy}>
                {fyLabel(fy)}
              </option>
            ))}
            <option value="ALL">All time</option>
          </select>

          {/* Project filter (multi-select) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectMenuOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-2.5 text-sm font-medium text-gray-700 shadow-xs transition hover:bg-gray-50"
            >
              <FolderKanban className="h-4 w-4 text-gray-400" />
              <span className="max-w-[160px] truncate">{projectLabel}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {projectMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setProjectMenuOpen(false)} />
                <div className="absolute left-0 z-30 mt-2 w-64 origin-top-left animate-scale-in rounded-xl border border-gray-200 bg-white p-1.5 shadow-elevated">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Remove from chart
                    </span>
                    {hiddenProjects.length > 0 && (
                      <button
                        onClick={() => setHiddenProjects([])}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="px-2 pb-1.5 text-[11px] leading-tight text-gray-400">
                    Checked projects are hidden from the chart.
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {licenseProjects.map((p) => {
                      const hidden = hiddenProjects.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleHidden(p.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span
                            className={`flex h-4 w-4 flex-none items-center justify-center rounded border transition ${
                              hidden ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
                            }`}
                          >
                            {hidden && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span className={`truncate ${hidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {p.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`h-2.5 w-2.5 rounded-sm ${l.dot}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center">
          <CalendarRange className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No license invoicing in {selectedFY === 'ALL' ? 'this range' : fyLabel(selectedFY)}.
          </p>
        </div>
      ) : (
        <div className="max-h-[30rem] overflow-auto rounded-b-2xl">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-gray-100 bg-white px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Project
                </th>
                {months.map((ym) => (
                  <th
                    key={ym}
                    className={`sticky top-0 z-20 border-b border-gray-100 bg-white px-1.5 py-3 text-center text-[11px] font-medium ${
                      ym % 12 === 3 ? 'text-primary-600' : 'text-gray-400'
                    }`}
                    title={ym % 12 === 3 ? 'Financial year start (April)' : undefined}
                  >
                    {labelOf(ym)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, client, cells }) => (
                <tr key={project.id} className="group">
                  <td className="sticky left-0 z-10 bg-white px-6 py-2.5 group-hover:bg-gray-50/70">
                    <div className="min-w-[180px]">
                      <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="truncate text-xs text-gray-400">{client}</p>
                    </div>
                  </td>
                  {cells.map((cell, i) => {
                    const style = cell ? STATUS_STYLE[cell.status] : null;
                    const tip = cell
                      ? `${project.name} · ${labelOf(months[i])}\n${cell.invoice_number ?? cell.name} · ${formatCurrency(
                          cell.amount
                        )}\nStatus: ${style?.label ?? cell.status}${
                          cell.payment_date ? `\nPaid: ${cell.payment_date}` : ''
                        }`
                      : `${project.name} · ${labelOf(months[i])}\nNo invoice`;
                    return (
                      <td key={i} className="px-0.5 py-2.5 align-middle">
                        <div
                          title={tip}
                          className={`mx-auto h-6 w-7 rounded-md transition-transform duration-150 hover:scale-110 hover:ring-2 hover:ring-gray-300 ${
                            style ? style.cell : 'bg-gray-100'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LicenseGantt;

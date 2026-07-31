import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Check, FolderKanban } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { BillableItem, Client } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChartProject {
  id: number;
  client_id: number;
  name: string;
}
interface OneTimeChartProps {
  projects: ChartProject[];
  clients: Client[];
  billableItems: BillableItem[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymOf = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const [y, m] = dateStr.split('-').map(Number);
  if (!y || !m) return null;
  return y * 12 + (m - 1);
};
const labelOf = (ym: number) => `${MONTHS[ym % 12]} '${String(Math.floor(ym / 12) % 100).padStart(2, '0')}`;
const fyStartOfYM = (ym: number) => {
  const m0 = ym % 12;
  return m0 <= 2 ? Math.floor(ym / 12) - 1 : Math.floor(ym / 12);
};
const fyLabel = (start: number) => `FY ${start}-${String(start + 1).slice(2)}`;
const formatINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const currentFYStart = (() => {
  const now = new Date();
  return now.getMonth() <= 2 ? now.getFullYear() - 1 : now.getFullYear();
})();

const OneTimeChart: React.FC<OneTimeChartProps> = ({ projects, clients, billableItems }) => {
  const [selectedFY, setSelectedFY] = useState<number | 'ALL'>(currentFYStart);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  // One-time items, dated by invoice date (falling back to start date).
  const oneTimeItems = useMemo(
    () =>
      billableItems
        .filter((b) => b.type === 'ONE_TIME')
        .map((b) => ({ ...b, ym: ymOf(b.invoice_date) ?? ymOf(b.start_date) }))
        .filter((b) => b.ym != null) as (BillableItem & { ym: number })[],
    [billableItems]
  );

  const oneTimeProjects = useMemo(() => {
    const ids = new Set(oneTimeItems.map((i) => i.project_id));
    return projects.filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [oneTimeItems, projects]);

  const fyOptions = useMemo(() => {
    const set = new Set<number>([currentFYStart]);
    for (const it of oneTimeItems) set.add(fyStartOfYM(it.ym));
    return Array.from(set).sort((a, b) => b - a);
  }, [oneTimeItems]);

  const toggleProject = (id: number) =>
    setSelectedProjects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const projectLabel =
    selectedProjects.length === 0
      ? 'All projects'
      : selectedProjects.length === 1
      ? oneTimeProjects.find((p) => p.id === selectedProjects[0])?.name ?? '1 project'
      : `${selectedProjects.length} projects`;

  const { labels, received, raised, pending, total } = useMemo(() => {
    const inScope = oneTimeItems.filter(
      (it) => selectedProjects.length === 0 || selectedProjects.includes(it.project_id)
    );

    let startYM: number;
    let endYM: number;
    if (selectedFY === 'ALL') {
      if (inScope.length === 0) return { labels: [], received: [], raised: [], pending: [], total: 0 };
      startYM = Math.min(...inScope.map((i) => i.ym));
      endYM = Math.min(Math.max(...inScope.map((i) => i.ym)), startYM + 35);
    } else {
      startYM = selectedFY * 12 + 3;
      endYM = (selectedFY + 1) * 12 + 2;
    }

    const months: number[] = [];
    for (let ym = startYM; ym <= endYM; ym++) months.push(ym);

    const sumFor = (ym: number, pred: (s: string) => boolean) =>
      inScope.filter((i) => i.ym === ym && pred(i.status)).reduce((s, i) => s + i.amount, 0);

    const received = months.map((ym) => sumFor(ym, (s) => s === 'RECEIVED'));
    const raised = months.map((ym) => sumFor(ym, (s) => s === 'RAISED'));
    const pending = months.map((ym) =>
      sumFor(ym, (s) => s === 'PENDING' || s === 'APPROVED' || s === 'NOT_APPROVED')
    );
    const total =
      received.reduce((a, b) => a + b, 0) +
      raised.reduce((a, b) => a + b, 0) +
      pending.reduce((a, b) => a + b, 0);

    return { labels: months.map(labelOf), received, raised, pending, total };
  }, [oneTimeItems, selectedFY, selectedProjects]);

  const data = {
    labels,
    datasets: [
      { label: 'Paid', data: received, backgroundColor: '#10b981', stack: 'one-time', borderRadius: 3 },
      { label: 'Invoiced', data: raised, backgroundColor: '#3b82f6', stack: 'one-time', borderRadius: 3 },
      { label: 'Pending', data: pending, backgroundColor: '#f59e0b', stack: 'one-time', borderRadius: 3 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { callback: (v: any) => formatINR(v as number) },
        grid: { color: '#f1f5f9' },
      },
    },
    plugins: {
      legend: { position: 'bottom' as const, labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`,
        },
      },
    },
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">One-Time Invoicing &amp; Payments</h3>

          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="form-select inline-block w-auto rounded-lg border-gray-300 py-1.5 pl-3 pr-9 text-sm font-medium text-gray-700"
          >
            {fyOptions.map((fy) => (
              <option key={fy} value={fy}>{fyLabel(fy)}</option>
            ))}
            <option value="ALL">All time</option>
          </select>

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
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Projects</span>
                    {selectedProjects.length > 0 && (
                      <button
                        onClick={() => setSelectedProjects([])}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {oneTimeProjects.map((p) => {
                      const checked = selectedProjects.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleProject(p.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span
                            className={`flex h-4 w-4 flex-none items-center justify-center rounded border transition ${
                              checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span className="truncate text-gray-700">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <span className="text-sm text-gray-500">
          Total <span className="font-semibold text-gray-900">{formatINR(total)}</span>
        </span>
      </div>

      {labels.length === 0 || total === 0 ? (
        <div className="p-10 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No one-time invoicing in {selectedFY === 'ALL' ? 'this range' : fyLabel(selectedFY)}.
          </p>
        </div>
      ) : (
        <div className="p-5">
          <div className="h-80">
            <Bar data={data} options={options} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OneTimeChart;

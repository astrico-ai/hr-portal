import React, { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { getRecentAudit, AuditEntry } from '../lib/audit';

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const actionColor = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes('approv')) return 'bg-green-500';
  if (a.includes('reject')) return 'bg-red-500';
  if (a.includes('generat') || a.includes('download')) return 'bg-blue-500';
  if (a.includes('status')) return 'bg-amber-500';
  return 'bg-gray-400';
};

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setEntries(await getRecentAudit(30));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">Activity Log</h3>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          No activity recorded yet. Approvals and invoice generation will show here.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((e, i) => (
            <li key={i} className="flex items-start gap-3 px-6 py-3">
              <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${actionColor(e.action)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{e.action}</span>
                  {e.summary ? <span className="text-gray-500"> — {e.summary}</span> : null}
                </p>
                <p className="text-xs text-gray-400">
                  {e.user} · {relativeTime(e.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AuditLog;

import React, { useEffect, useState, useCallback } from 'react';
import { History, RefreshCw, Filter, X } from 'lucide-react';
import { getAuditPage, getAuditActions, AuditEntry } from '../lib/audit';

const PAGE_SIZE = 25;

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
  const a = (action || '').toLowerCase();
  if (a.includes('approv')) return 'bg-green-500';
  if (a.includes('reject')) return 'bg-red-500';
  if (a.includes('generat') || a.includes('download')) return 'bg-blue-500';
  if (a.includes('status')) return 'bg-amber-500';
  return 'bg-gray-400';
};

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actions, setActions] = useState<string[]>([]);

  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filterArgs = useCallback(() => ({
    action: action || undefined,
    from: from ? `${from}T00:00:00` : undefined,
    to: to ? `${to}T23:59:59.999` : undefined,
  }), [action, from, to]);

  // (Re)load the first page whenever filters change.
  const loadFirst = useCallback(async () => {
    setLoading(true);
    const { entries, total } = await getAuditPage({ ...filterArgs(), limit: PAGE_SIZE, offset: 0 });
    setEntries(entries);
    setTotal(total);
    setLoading(false);
  }, [filterArgs]);

  useEffect(() => { loadFirst(); }, [loadFirst]);
  useEffect(() => { getAuditActions().then(setActions); }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    const { entries: more } = await getAuditPage({ ...filterArgs(), limit: PAGE_SIZE, offset: entries.length });
    setEntries((prev) => [...prev, ...more]);
    setLoadingMore(false);
  };

  const hasFilters = action || from || to;
  const clearFilters = () => { setAction(''); setFrom(''); setTo(''); };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">Activity Log</h3>
          {!loading && <span className="text-sm text-gray-400">{total}</span>}
        </div>
        <button onClick={loadFirst} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="form-select w-auto py-1.5 text-sm">
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input w-auto py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input w-auto py-1.5 text-sm" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        {hasFilters && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400">
            <Filter className="h-3 w-3" /> filtered
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          {hasFilters ? 'No activity matches these filters.' : 'No activity recorded yet.'}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {entries.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-6 py-3">
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${actionColor(e.action)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{e.action}</span>
                    {e.summary ? <span className="text-gray-500"> — {e.summary}</span> : null}
                  </p>
                  <p className="text-xs text-gray-400">{e.user} · {relativeTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ul>
          {entries.length < total && (
            <div className="border-t border-gray-100 p-4 text-center">
              <button onClick={loadMore} disabled={loadingMore} className="btn btn-secondary btn-sm">
                {loadingMore ? 'Loading…' : `Load more (${total - entries.length} left)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLog;

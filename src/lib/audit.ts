import { db } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { supabase } from './supabaseClient';

export interface AuditEntry {
  action: string;   // e.g. "Invoice approved"
  summary: string;  // human-readable detail
  user: string;     // who did it (signed-in email)
  at: string;       // ISO timestamp
  entityId?: number | string;
}

// Backend switch (mirrors dataService). Firestore column names differ from the
// Postgres ones: user -> user_email, entityId -> entity_id.
const useSupabase = (process.env.REACT_APP_DATA_BACKEND || 'firebase').toLowerCase() === 'supabase';
const currentUser = () => localStorage.getItem('userEmail') || 'unknown';

// Record an action. Fire-and-forget — never blocks or breaks the caller.
export const logAudit = async (action: string, summary: string, entityId?: number | string) => {
  try {
    if (useSupabase) {
      await supabase.from('audit_log').insert({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        action,
        summary,
        user_email: currentUser(),
        at: new Date().toISOString(),
        entity_id: entityId != null && !isNaN(Number(entityId)) ? Number(entityId) : null,
      });
    } else {
      await addDoc(collection(db, 'auditLog'), {
        action,
        summary,
        user: currentUser(),
        at: new Date().toISOString(),
        ...(entityId != null ? { entityId } : {}),
      });
    }
  } catch (e) {
    console.error('Audit log failed:', e);
  }
};

const mapRow = (r: any): AuditEntry => ({
  action: r.action,
  summary: r.summary,
  user: r.user_email,
  at: r.at,
  entityId: r.entity_id ?? undefined,
});

export interface AuditQuery {
  limit?: number;
  offset?: number;
  action?: string;   // exact action filter
  from?: string;     // ISO date (>=)
  to?: string;       // ISO date (<=)
}
export interface AuditPage { entries: AuditEntry[]; total: number }

// Paginated + filtered audit fetch (Supabase). Only pulls the requested page,
// so it stays fast no matter how large the log grows.
export const getAuditPage = async (q: AuditQuery = {}): Promise<AuditPage> => {
  const limitN = q.limit ?? 25;
  const offset = q.offset ?? 0;
  if (!useSupabase) {
    // Firebase fallback: no server-side paging — return the recent slice.
    const recent = await getRecentAudit(offset + limitN);
    return { entries: recent.slice(offset, offset + limitN), total: recent.length };
  }
  try {
    let query = supabase.from('audit_log').select('*', { count: 'exact' }).order('at', { ascending: false });
    if (q.action) query = query.eq('action', q.action);
    if (q.from) query = query.gte('at', q.from);
    if (q.to) query = query.lte('at', q.to);
    const { data, count, error } = await query.range(offset, offset + limitN - 1);
    if (error) throw error;
    return { entries: (data ?? []).map(mapRow), total: count ?? 0 };
  } catch (e) {
    console.error('Failed to load audit page:', e);
    return { entries: [], total: 0 };
  }
};

// Distinct action names for the filter dropdown (small — action column only).
export const getAuditActions = async (): Promise<string[]> => {
  if (!useSupabase) return [];
  try {
    const { data, error } = await supabase.from('audit_log').select('action');
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r: any) => r.action).filter(Boolean))).sort();
  } catch {
    return [];
  }
};

export const getRecentAudit = async (n = 30): Promise<AuditEntry[]> => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('at', { ascending: false })
        .limit(n);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        action: r.action,
        summary: r.summary,
        user: r.user_email,
        at: r.at,
        entityId: r.entity_id ?? undefined,
      }));
    }
    const q = query(collection(db, 'auditLog'), orderBy('at', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AuditEntry);
  } catch (e) {
    console.error('Failed to load audit log:', e);
    return [];
  }
};

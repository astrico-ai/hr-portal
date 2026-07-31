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

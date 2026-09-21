import { supabase } from './supabaseClient';

export interface CreditNote {
  id?: number;
  invoice_id: number;
  invoice_number?: string | null;
  credit_note_number: string;
  cn_date: string;      // YYYY-MM-DD
  amount: number;       // taxable value credited
  reason?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export const getCreditNotes = async (): Promise<CreditNote[]> => {
  const { data, error } = await supabase.from('credit_notes').select('*').order('cn_date', { ascending: false });
  if (error) { console.error('Error loading credit notes:', error); return []; }
  return (data ?? []) as CreditNote[];
};

export const saveCreditNote = async (cn: CreditNote): Promise<CreditNote> => {
  const row = {
    invoice_id: cn.invoice_id,
    invoice_number: cn.invoice_number ?? null,
    credit_note_number: cn.credit_note_number,
    cn_date: cn.cn_date,
    amount: Number(cn.amount) || 0,
    reason: cn.reason?.trim() || null,
    created_by: localStorage.getItem('userEmail') || null,
  };
  const { data, error } = await supabase.from('credit_notes').insert(row).select().single();
  if (error) throw error;
  return data as CreditNote;
};

export const deleteCreditNote = async (id: number): Promise<void> => {
  const { error } = await supabase.from('credit_notes').delete().eq('id', id);
  if (error) throw error;
};

// Auto number: CN-YYYY-MMM-NNN, continuing the month's series (any spelling).
const MONTH_TOKEN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const generateCreditNoteNumber = (iso: string, existing: CreditNote[]): string => {
  const [y, m] = (iso || '').split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIdx = (m || 1) - 1;
  const token = MONTH_TOKEN[monthIdx];
  let max = 0;
  for (const cn of existing) {
    const match = String(cn.credit_note_number || '').trim().match(/^CN-(\d{4})-([A-Za-z]+)-(\d+)$/);
    if (!match) continue;
    if (parseInt(match[1], 10) !== year) continue;
    if (MON3.findIndex((mm) => match[2].toUpperCase().startsWith(mm)) !== monthIdx) continue;
    const n = parseInt(match[3], 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `CN-${year}-${token}-${String(max + 1).padStart(3, '0')}`;
};

import * as XLSX from 'xlsx';
import type { BillableItem, Client, Project } from '../types';
import type { CreditNote } from './creditNotes';
import { SELLER } from './invoiceConfig';

// A GST register row for one invoice. Tax is state-aware:
// intra-state (same state as seller) → CGST+SGST; inter-state → IGST.
export interface GstRow {
  type: 'Invoice' | 'Credit Note';
  invoiceNo: string;
  invoiceDate: string;
  client: string;
  gstin: string;
  placeOfSupply: string;
  hsn: string;
  taxable: number;
  cgstRate: number;
  cgstAmt: number;
  sgstRate: number;
  sgstAmt: number;
  igstRate: number;
  igstAmt: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Tax split for a taxable value given the buyer's GSTIN. Signed: a negative
// taxable (credit note) yields negative tax.
const taxFor = (gstin: string, taxable: number) => {
  const isExport = !gstin;
  const intrastate = (gstin ? gstin.slice(0, 2) : '') === SELLER.stateCode;
  let cgst = 0, sgst = 0, igst = 0, cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (!isExport) {
    if (intrastate) { cgst = round2(taxable * 0.09); sgst = cgst; cgstRate = 9; sgstRate = 9; }
    else { igst = round2(taxable * 0.18); igstRate = 18; }
  }
  return { cgst, sgst, igst, cgstRate, sgstRate, igstRate };
};

const gstinOf = (client?: Client) =>
  client?.gst_number && client.gst_number !== 'N.A' ? client.gst_number : '';

export const invoiceMonths = (items: BillableItem[], creditNotes: CreditNote[] = []): string[] => {
  const set = new Set<string>();
  for (const it of items) {
    if (!it.invoice_number) continue;
    if (!['APPROVED', 'RAISED', 'RECEIVED'].includes(it.status)) continue;
    const key = (it.invoice_date || '').slice(0, 7);
    if (key) set.add(key);
  }
  for (const cn of creditNotes) {
    const key = (cn.cn_date || '').slice(0, 7);
    if (key) set.add(key);
  }
  return Array.from(set).sort().reverse();
};

export const buildGstRows = (
  items: BillableItem[],
  projects: Project[],
  clients: Client[],
  monthKey: string | 'ALL',
  creditNotes: CreditNote[] = []
): GstRow[] => {
  const projById = new Map(projects.map((p) => [p.id, p]));
  const cliById = new Map(clients.map((c) => [c.id, c]));
  const itemById = new Map(items.map((it) => [it.id, it]));
  const clientFor = (it?: BillableItem) => {
    const project = it ? projById.get(it.project_id) : undefined;
    return project ? cliById.get(project.client_id) : undefined;
  };

  const invoiceRows: GstRow[] = items
    .filter((it) => it.invoice_number && ['APPROVED', 'RAISED', 'RECEIVED'].includes(it.status))
    .filter((it) => monthKey === 'ALL' || (it.invoice_date || '').slice(0, 7) === monthKey)
    .sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''))
    .map((it) => {
      const client = clientFor(it);
      const gstin = gstinOf(client);
      const taxable = it.amount;
      const t = taxFor(gstin, taxable);
      return {
        type: 'Invoice' as const,
        invoiceNo: it.invoice_number!, invoiceDate: it.invoice_date || '',
        client: client?.legal_name || '—', gstin, placeOfSupply: client?.state || '', hsn: SELLER.hsnSac,
        taxable, cgstRate: t.cgstRate, cgstAmt: t.cgst, sgstRate: t.sgstRate, sgstAmt: t.sgst,
        igstRate: t.igstRate, igstAmt: t.igst, total: Math.round(taxable + t.cgst + t.sgst + t.igst),
      };
    });

  // Credit notes listed separately (positive values), NOT netted against invoices.
  const cnRows: GstRow[] = creditNotes
    .filter((cn) => monthKey === 'ALL' || (cn.cn_date || '').slice(0, 7) === monthKey)
    .sort((a, b) => (a.credit_note_number || '').localeCompare(b.credit_note_number || ''))
    .map((cn) => {
      const client = clientFor(itemById.get(cn.invoice_id));
      const gstin = gstinOf(client);
      const taxable = Math.abs(Number(cn.amount) || 0);
      const t = taxFor(gstin, taxable);
      return {
        type: 'Credit Note' as const,
        invoiceNo: cn.credit_note_number, invoiceDate: cn.cn_date || '',
        client: client?.legal_name || '—', gstin, placeOfSupply: client?.state || '', hsn: SELLER.hsnSac,
        taxable, cgstRate: t.cgstRate, cgstAmt: t.cgst, sgstRate: t.sgstRate, sgstAmt: t.sgst,
        igstRate: t.igstRate, igstAmt: t.igst, total: Math.round(taxable + t.cgst + t.sgst + t.igst),
      };
    });

  return [...invoiceRows, ...cnRows];
};

// Build and download an .xlsx GST register.
export const exportGstExcel = (rows: GstRow[], filename: string) => {
  const header = [
    'Type', 'Document No', 'Date', 'Customer', 'Customer GSTIN', 'Place of Supply', 'HSN/SAC',
    'Taxable Value', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'IGST %', 'IGST Amt', 'Total',
  ];
  const body = rows.map((r) => [
    r.type, r.invoiceNo, r.invoiceDate, r.client, r.gstin, r.placeOfSupply, r.hsn,
    r.taxable, r.cgstRate || '', r.cgstAmt || '', r.sgstRate || '', r.sgstAmt || '',
    r.igstRate || '', r.igstAmt || '', r.total,
  ]);

  // Separate subtotals — invoices and credit notes are NOT netted together.
  const subtotal = (label: string, rs: GstRow[]) => {
    const sum = (sel: (r: GstRow) => number) => round2(rs.reduce((s, r) => s + sel(r), 0));
    return [
      '', label, '', '', '', '', '',
      sum((r) => r.taxable), '', sum((r) => r.cgstAmt), '', sum((r) => r.sgstAmt), '', sum((r) => r.igstAmt), sum((r) => r.total),
    ];
  };
  const invRows = rows.filter((r) => r.type === 'Invoice');
  const cnRows = rows.filter((r) => r.type === 'Credit Note');

  const sheet: any[][] = [header, ...body, subtotal('Total Invoices', invRows)];
  if (cnRows.length) sheet.push(subtotal('Total Credit Notes', cnRows));

  const ws = XLSX.utils.aoa_to_sheet(sheet);
  ws['!cols'] = header.map((h, i) => ({ wch: i === 3 ? 34 : i === 4 ? 18 : i === 0 ? 12 : 13 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GST Register');
  XLSX.writeFile(wb, filename);
};

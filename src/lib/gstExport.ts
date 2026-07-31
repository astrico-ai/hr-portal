import * as XLSX from 'xlsx';
import type { BillableItem, Client, Project } from '../types';
import { SELLER } from './invoiceConfig';

// A GST register row for one invoice. Tax is state-aware:
// intra-state (same state as seller) → CGST+SGST; inter-state → IGST.
export interface GstRow {
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

export const invoiceMonths = (items: BillableItem[]): string[] => {
  const set = new Set<string>();
  for (const it of items) {
    if (!it.invoice_number) continue;
    if (!['APPROVED', 'RAISED', 'RECEIVED'].includes(it.status)) continue;
    const key = (it.invoice_date || '').slice(0, 7);
    if (key) set.add(key);
  }
  return Array.from(set).sort().reverse();
};

export const buildGstRows = (
  items: BillableItem[],
  projects: Project[],
  clients: Client[],
  monthKey: string | 'ALL'
): GstRow[] => {
  const projById = new Map(projects.map((p) => [p.id, p]));
  const cliById = new Map(clients.map((c) => [c.id, c]));

  return items
    .filter((it) => it.invoice_number && ['APPROVED', 'RAISED', 'RECEIVED'].includes(it.status))
    .filter((it) => monthKey === 'ALL' || (it.invoice_date || '').slice(0, 7) === monthKey)
    .sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''))
    .map((it) => {
      const project = projById.get(it.project_id);
      const client = project ? cliById.get(project.client_id) : undefined;
      const gstin = client?.gst_number && client.gst_number !== 'N.A' ? client.gst_number : '';
      const stateCode = gstin ? gstin.slice(0, 2) : '';
      const isExport = !gstin;
      const intrastate = stateCode === SELLER.stateCode;

      const taxable = it.amount;
      let cgst = 0, sgst = 0, igst = 0, cgstRate = 0, sgstRate = 0, igstRate = 0;
      if (!isExport) {
        if (intrastate) {
          cgst = round2(taxable * 0.09);
          sgst = cgst;
          cgstRate = 9;
          sgstRate = 9;
        } else {
          igst = round2(taxable * 0.18);
          igstRate = 18;
        }
      }
      return {
        invoiceNo: it.invoice_number!,
        invoiceDate: it.invoice_date || '',
        client: client?.legal_name || '—',
        gstin,
        placeOfSupply: client?.state || '',
        hsn: SELLER.hsnSac,
        taxable,
        cgstRate, cgstAmt: cgst,
        sgstRate, sgstAmt: sgst,
        igstRate, igstAmt: igst,
        total: Math.round(taxable + cgst + sgst + igst),
      };
    });
};

// Build and download an .xlsx GST register.
export const exportGstExcel = (rows: GstRow[], filename: string) => {
  const header = [
    'Invoice No', 'Invoice Date', 'Customer', 'Customer GSTIN', 'Place of Supply', 'HSN/SAC',
    'Taxable Value', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'IGST %', 'IGST Amt', 'Invoice Total',
  ];
  const body = rows.map((r) => [
    r.invoiceNo, r.invoiceDate, r.client, r.gstin, r.placeOfSupply, r.hsn,
    r.taxable, r.cgstRate || '', r.cgstAmt || '', r.sgstRate || '', r.sgstAmt || '',
    r.igstRate || '', r.igstAmt || '', r.total,
  ]);
  const sum = (sel: (r: GstRow) => number) => round2(rows.reduce((s, r) => s + sel(r), 0));
  const totals = [
    'TOTAL', '', '', '', '', '',
    sum((r) => r.taxable), '', sum((r) => r.cgstAmt), '', sum((r) => r.sgstAmt), '', sum((r) => r.igstAmt), sum((r) => r.total),
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, ...body, totals]);
  ws['!cols'] = header.map((h, i) => ({ wch: i === 2 ? 34 : i === 3 ? 18 : 13 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GST Register');
  XLSX.writeFile(wb, filename);
};

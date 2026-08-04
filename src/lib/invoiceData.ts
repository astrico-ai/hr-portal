import type { BillableItem, Project, Client, BillableLineItem } from '../types';
import { SELLER, BankAccount } from './invoiceConfig';

// ---- number → Indian words ----
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string =>
  n < 10 ? ONES[n] : n < 20 ? TEENS[n - 10] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
const threeDigits = (n: number): string => {
  let r = '';
  if (n >= 100) { r += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100; }
  if (n > 0) r += twoDigits(n);
  return r.trim();
};

export const numberToWords = (value: number): string => {
  let num = Math.floor(value);
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (num) parts.push(threeDigits(num));
  return parts.join(' ').trim();
};

const inrInWords = (amount: number) => `INR ${numberToWords(amount)} Only`;
const taxInWords = (amount: number) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (amount === 0) return 'NIL';
  return paise > 0
    ? `INR ${numberToWords(rupees)} and ${twoDigits(paise)} paise Only`
    : `INR ${numberToWords(rupees)} Only`;
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatInvoiceDate = (iso?: string | null): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d}-${MON[m - 1]}-${String(y).slice(2)}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Month tokens as actually used in NV360's invoice numbers: June & July are
// spelled out, every other month is the 3-letter abbreviation.
const MONTH_TOKEN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Resolve a month token from an existing number to its index — tolerant of both
// spellings (JUN/JUNE, JUL/JULY) so old and new numbers count as the same month.
const monthIndexFromToken = (tok: string): number =>
  MON3.findIndex((m) => tok.toUpperCase().startsWith(m));

// Next invoice number for a date — continues the month's chronology across ALL
// invoices (any project, any spelling/padding). e.g. 2026-JUNE-002.
// Only the standard "YYYY-MMM-NNN" series is considered; the EX- export series
// is numbered separately and ignored here.
export const generateInvoiceNumber = (iso: string, allItems: BillableItem[]): string => {
  const [y, m] = (iso || '').split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIdx = (m || 1) - 1;
  const token = MONTH_TOKEN[monthIdx];

  let max = 0;
  for (const it of allItems) {
    const n = it.invoice_number;
    if (!n) continue;
    const match = String(n).trim().match(/^(\d{4})-([A-Za-z]+)-(\d+)$/);
    if (!match) continue; // skips EX-... and any non-standard numbers
    if (parseInt(match[1], 10) !== year) continue;
    if (monthIndexFromToken(match[2]) !== monthIdx) continue;
    const counter = parseInt(match[3], 10);
    if (!isNaN(counter) && counter > max) max = counter;
  }
  return `${year}-${token}-${String(max + 1).padStart(3, '0')}`;
};

// ---- structured invoice ----
export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  signedOn: string; // e.g. "2026.06.26" — caption under the signature stamp
  buyerOrderNo: string;
  buyerOrderDate: string;
  seller: typeof SELLER;
  buyer: { name: string; address: string; gstin: string; stateName: string; stateCode: string };
  isExport: boolean;
  intrastate: boolean;
  lines: Array<{
    description: string;
    subDescription: string;
    hsn: string;
    quantity?: number | null;
    rate?: number | null;
    unit?: string | null;
    amount: number;
  }>;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxRate: number; // % per component (9 for CGST/SGST, 18 for IGST)
  taxAmount: number;
  roundOff: number;
  total: number;
  amountInWords: string;
  taxAmountInWords: string;
  bank: BankAccount;
}

export const buildInvoiceData = (
  item: BillableItem,
  project: Project,
  client: Client,
  bank: BankAccount,
  invoiceNo: string
): InvoiceData => {
  const gstin = client.gst_number && client.gst_number !== 'N.A' ? client.gst_number : '';
  const stateCode = gstin ? gstin.slice(0, 2) : '';
  const isExport = !gstin; // no Indian GSTIN → treated as zero-rated export
  // Smart GST: same state as seller (Maharashtra/27) → CGST+SGST; else IGST.
  const intrastate = stateCode === SELLER.stateCode;

  // One row per line item (fall back to the single name/amount for old records).
  const lineSource: BillableLineItem[] = item.line_items?.length
    ? item.line_items
    : [{ description: item.name, amount: item.amount }];
  const lines = lineSource.map(li => ({
    description: li.description,
    subDescription: '',
    hsn: SELLER.hsnSac,
    quantity: li.quantity ?? null,
    rate: li.rate ?? null,
    unit: li.unit ?? null,
    amount: li.quantity && li.rate ? round2(Number(li.quantity) * Number(li.rate)) : li.amount,
  }));
  const taxable = lines.reduce((s, l) => s + l.amount, 0);
  let cgst = 0, sgst = 0, igst = 0, taxRate = 0;
  if (!isExport) {
    if (intrastate) {
      cgst = round2(taxable * 0.09);
      sgst = cgst;
      taxRate = 9;
    } else {
      igst = round2(taxable * 0.18);
      taxRate = 18;
    }
  }
  const taxAmount = round2(cgst + sgst + igst);
  const raw = taxable + taxAmount;
  const total = Math.round(raw);
  const roundOff = round2(total - raw);

  // Signature caption date+time — the moment the PDF is generated/signed (today),
  // e.g. "2026.08.04 17:08:10".
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const datePart = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const signedOn = `${datePart} ${timePart}`;

  return {
    invoiceNo,
    invoiceDate: formatInvoiceDate(item.invoice_date),
    signedOn,
    buyerOrderNo: item.po_number && item.po_number !== 'NO_PO_REQUIRED' ? item.po_number : '',
    buyerOrderDate: '',
    seller: SELLER,
    buyer: {
      name: client.legal_name,
      address: client.billing_address || '',
      gstin,
      stateName: client.state || (gstin ? '' : ''),
      stateCode,
    },
    isExport,
    intrastate,
    lines,
    taxable,
    cgst,
    sgst,
    igst,
    taxRate,
    taxAmount,
    roundOff,
    total,
    amountInWords: inrInWords(total),
    taxAmountInWords: taxInWords(taxAmount),
    bank,
  };
};

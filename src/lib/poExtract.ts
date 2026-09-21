// Best-effort extraction of purchase-order fields from an uploaded PDF.
// Everything here is heuristic: the PO form stays fully editable and nothing
// is required. If parsing fails or finds nothing, the user just types it in.

export interface ExtractedPO {
  po_number?: string;
  po_value?: number;
  po_end_date?: string; // YYYY-MM-DD
  name?: string;
}

// Lazy-load pdf.js only when a document is actually uploaded, so it never
// weighs on the initial bundle. The worker is pointed at the bundled asset.
let pdfjsPromise: Promise<any> | null = null;
const loadPdfjs = async (): Promise<any> => {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs: any = await import('pdfjs-dist');
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch {
        /* leave default worker resolution */
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
};

// Concatenate all text on the page(s) into one string.
const readPdfText = async (file: File): Promise<string> => {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => (typeof it.str === 'string' ? it.str : '')).join(' ') + '\n';
    if (p >= 5) break; // POs are short; cap work
  }
  return out;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9,
  sept: 9, oct: 10, nov: 11, dec: 12,
};

// Normalise a matched date string to YYYY-MM-DD; returns '' if not parseable.
const toISO = (raw: string): string => {
  const s = raw.trim();
  // 12/08/2026 or 12-08-2026 or 12.08.2026 (assume DD/MM/YYYY, common in India)
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    const yy = y.length === 2 ? '20' + y : y;
    const dd = Number(d), mm = Number(mo);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  // 12 Aug 2026 / 12-Aug-2026 / August 12, 2026
  m = s.match(/(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-,]+(\d{4})/);
  if (m) {
    const mm = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mm) return `${m[3]}-${String(mm).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  m = s.match(/([A-Za-z]{3,9})[\s\-]+(\d{1,2})[\s\-,]+(\d{4})/);
  if (m) {
    const mm = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mm) return `${m[3]}-${String(mm).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
  }
  return '';
};

const DATE_RE = '(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|\\d{1,2}[\\s\\-][A-Za-z]{3,9}[\\s\\-,]+\\d{4}|[A-Za-z]{3,9}[\\s\\-]+\\d{1,2}[\\s\\-,]+\\d{4})';

const num = (s: string): number => Number(s.replace(/[,\s]/g, ''));

// Heuristic field parse from the extracted text.
export const parsePO = (text: string): ExtractedPO => {
  const t = text.replace(/\s+/g, ' ').trim();
  const out: ExtractedPO = {};

  // PO number: "PO No: ABC-123", "Purchase Order Number 4500012345", "PO # 12/34"
  const poNo = t.match(/\b(?:P\.?\s*O\.?|purchase\s+order)\s*(?:no\.?|number|#|:)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\/_-]{2,})/i);
  // Require a digit — real PO numbers have one, and it rejects prose like "no PO fields".
  if (poNo && /\d/.test(poNo[1]) && !/^number$/i.test(poNo[1])) out.po_number = poNo[1].replace(/[.,;]$/, '');

  // Value: prefer an explicit "Total / Grand Total / PO Value / Net Amount" label;
  // else fall back to the largest money-like figure in the doc.
  const labelled = t.match(/(?:grand\s+total|total\s+value|po\s+value|net\s+amount|total\s+amount|order\s+value|total)\s*[:\-]?\s*(?:INR|Rs\.?|USD|EUR|GBP|AED|₹|\$|£|€)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (labelled) {
    out.po_value = num(labelled[1]);
  } else {
    const money = Array.from(t.matchAll(/(?:INR|Rs\.?|USD|EUR|GBP|AED|₹|\$|£|€)\s*([0-9][0-9,]{2,}(?:\.\d{1,2})?)/gi)).map(mm => num(mm[1]));
    if (money.length) out.po_value = Math.max(...money);
  }
  if (out.po_value !== undefined && !(out.po_value > 0)) delete out.po_value;

  // End date: prefer a labelled end/valid-till/expiry date; else the latest date.
  const endLabelled = t.match(new RegExp(`(?:valid\\s*(?:till|until|upto|up\\s*to)|end\\s*date|expiry|expires?|completion\\s*date|delivery\\s*date)\\s*[:\\-]?\\s*${DATE_RE}`, 'i'));
  if (endLabelled) {
    const iso = toISO(endLabelled[1]);
    if (iso) out.po_end_date = iso;
  }

  return out;
};

export const extractPOFields = async (file: File): Promise<ExtractedPO> => {
  if (!/\.pdf$/i.test(file.name)) return {}; // only PDFs are parsed
  try {
    const text = await readPdfText(file);
    return parsePO(text);
  } catch (e) {
    console.warn('[poExtract] failed; manual entry.', e);
    return {};
  }
};

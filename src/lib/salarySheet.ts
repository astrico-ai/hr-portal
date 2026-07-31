import * as XLSX from 'xlsx';
import type { Employee } from './employees';

// Reproduces NV360's bank bulk-salary upload sheet (the "June Sal 3" format).
// Column layout (0-indexed A..Y):
//   A NV360 | B RPAY | C IFT/NEFT | E date | G debit a/c | H amount | I M
//   K name | M IFSC | N beneficiary a/c | X,Y narration
// Every cell is written as TEXT so account numbers & amounts never get mangled
// into scientific notation or reformatted by Excel.

const COMPANY = 'NV360';
const PRODUCT = 'RPAY';
const MODE = 'M';
const DEBIT_ACCOUNT = '8879552668'; // Kotak Fort — the account salaries are paid from

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const ddmmyyyy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

// Narration like "June 2026 Salary" for a given month index (0-11) + year.
export const salaryNarration = (monthIndex: number, year: number) =>
  `${MONTHS[monthIndex]} ${year} Salary`;

// Transfer type: intra-Kotak beneficiaries (IFSC starting KKBK) = IFT, else NEFT.
const transferType = (ifsc: string) =>
  (ifsc || '').trim().toUpperCase().startsWith('KKBK') ? 'IFT' : 'NEFT';

export const buildSalaryWorkbook = (
  employees: Employee[],
  narration: string,
  date: Date = new Date()
): XLSX.WorkBook => {
  const dateStr = ddmmyyyy(date); // download date
  const rows = employees
    .filter((e) => e.is_active !== false)
    .map((e) => {
      const row: string[] = new Array(25).fill('');
      row[0] = COMPANY;                                   // A
      row[1] = PRODUCT;                                   // B
      row[2] = transferType(e.ifsc);                      // C
      row[4] = dateStr;                                   // E
      row[6] = DEBIT_ACCOUNT;                             // G
      row[7] = String(Math.round(Number(e.salary) || 0));// H — amount as text
      row[8] = MODE;                                      // I
      row[10] = e.name || '';                             // K
      row[12] = (e.ifsc || '').trim().toUpperCase();      // M
      row[13] = String(e.account_number || '').trim();    // N — account as text
      row[23] = narration;                                // X
      row[24] = narration;                                // Y
      return row;
    });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Force every populated cell to string type (belt-and-suspenders for "plain text").
  Object.keys(ws).forEach((addr) => {
    if (addr.startsWith('!')) return;
    const cell = ws[addr];
    if (cell && cell.v !== '' && cell.v != null) {
      cell.t = 's';
      cell.v = String(cell.v);
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
};

export const downloadSalarySheet = (
  employees: Employee[],
  monthIndex: number,
  year: number
): void => {
  const narration = salaryNarration(monthIndex, year);
  const wb = buildSalaryWorkbook(employees, narration);
  const fileName = `NV360 Salary ${MONTHS[monthIndex]} ${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

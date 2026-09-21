// Static issuer details + the bank accounts an approver can pick from.
// Sourced directly from NV360's existing tax invoices.

export const SELLER = {
  name: 'NV360 TECHNOLOGY PRIVATE LIMITED',
  addressLines: [
    'First Floor, Office No.08,',
    'Shahviri Building, 37/41 Picket Road,',
    'Near Round Building, Off. Kalbadevi',
  ],
  gstin: '27AAJCN7187M1ZL',
  stateName: 'Maharashtra',
  stateCode: '27',
  cin: 'U62090MH2024PTC427799',
  pan: 'AAJCN7187M',
  hsnSac: '998314',
};

export interface BankAccount {
  id: string;
  label: string; // shown in the approver's dropdown
  accountHolder: string;
  bankName: string;
  accountNo: string;
  branchAndIfsc: string;
}

export const BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'kotak-fort',
    label: 'Kotak Mahindra Bank — Fort (…2668)',
    accountHolder: SELLER.name,
    bankName: 'Kotak Mahindra Bank # Fort',
    accountNo: '8879552668',
    branchAndIfsc: 'Fort, Mumbai & KKBK0001379',
  },
  {
    id: 'kotak-kalbadevi',
    label: 'Kotak Mahindra Bank — Kalbadevi (…6897)',
    accountHolder: SELLER.name,
    bankName: 'Kotak Mahindra Bank # Kalbadevi',
    accountNo: '1049996897',
    branchAndIfsc: 'Kalbadevi & KKBK0000961',
  },
  {
    id: 'icici',
    label: 'ICICI Bank Ltd. (…5173)',
    accountHolder: SELLER.name,
    bankName: 'ICICI Bank Ltd.',
    accountNo: '103205005173',
    branchAndIfsc: 'Mumbai-Kandivili Lokhandwala Branch & ICIC0001032',
  },
];

export const getBank = (id?: string | null): BankAccount | undefined =>
  BANK_ACCOUNTS.find((b) => b.id === id);

// ---- Foreign-currency (export) invoices -------------------------------------
// Top currencies we raise export invoices in. `symbol` is what we print on the
// PDF — we use the 3-letter code (or a plain ASCII sign) to stay within
// Helvetica's glyph set (@react-pdf/renderer can't render ₹/€/£ reliably).
export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string; // printed prefix on the invoice
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', label: 'Indian Rupee (INR)', symbol: 'Rs.' },
  { code: 'USD', label: 'US Dollar (USD)', symbol: 'USD' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: 'EUR' },
  { code: 'GBP', label: 'British Pound (GBP)', symbol: 'GBP' },
  { code: 'AED', label: 'UAE Dirham (AED)', symbol: 'AED' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)', symbol: 'SGD' },
  { code: 'AUD', label: 'Australian Dollar (AUD)', symbol: 'AUD' },
  { code: 'CAD', label: 'Canadian Dollar (CAD)', symbol: 'CAD' },
  { code: 'JPY', label: 'Japanese Yen (JPY)', symbol: 'JPY' },
  { code: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)', symbol: 'SAR' },
];

// True for any non-INR currency (i.e. an export invoice — zero-rated, EX- number).
export const isExportCurrency = (code?: string | null): boolean =>
  !!code && code.toUpperCase() !== 'INR';

export const currencySymbol = (code?: string | null): string =>
  CURRENCIES.find((c) => c.code === (code || 'INR'))?.symbol || (code || 'Rs.');

// INR value of an amount, given the item's currency and stored exchange rate
// (INR per 1 unit). Used for dashboard/GST — never printed on the invoice.
export const inrValue = (
  amount: number,
  currency?: string | null,
  rate?: number | null
): number =>
  isExportCurrency(currency) ? Number(amount || 0) * Number(rate || 0) : Number(amount || 0);

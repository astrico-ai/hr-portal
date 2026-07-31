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

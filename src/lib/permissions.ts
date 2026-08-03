// Fine-grained capability catalog (no roles). Each key is an independent
// permission granted per user. Admin holds all of them implicitly.
// NOTE: invoice approval + bank selection are admin-only and intentionally NOT
// listed here — they can never be granted to anyone else.

export interface CapDef { key: string; label: string; hint?: string }
export interface CapGroup { module: string; label: string; caps: CapDef[] }

export const CAPABILITY_GROUPS: CapGroup[] = [
  {
    module: 'dashboard', label: 'Dashboard', caps: [
      { key: 'dashboard.page', label: 'Open the Dashboard' },
      { key: 'dashboard.revenue', label: 'Revenue & MRR', hint: 'Total revenue, one-time, MRR, ARR, projected' },
      { key: 'dashboard.receivables', label: 'Receivables & collections', hint: 'Outstanding, AR aging, next due' },
      { key: 'dashboard.licenses', label: 'License Gantt & pipeline' },
    ],
  },
  {
    module: 'clients', label: 'Clients', caps: [
      { key: 'clients.view', label: 'View clients' },
      { key: 'clients.create', label: 'Create clients' },
      { key: 'clients.edit', label: 'Edit clients' },
      { key: 'clients.delete', label: 'Delete clients' },
    ],
  },
  {
    module: 'invoices', label: 'Invoices', caps: [
      { key: 'invoices.view', label: 'View invoices' },
      { key: 'invoices.create', label: 'Create invoices / bills' },
      { key: 'invoices.edit', label: 'Edit invoices' },
      { key: 'invoices.delete', label: 'Delete invoices' },
      { key: 'invoices.export', label: 'Export GST' },
    ],
  },
  {
    module: 'pos', label: 'Purchase Orders', caps: [
      { key: 'pos.view', label: 'View POs' },
      { key: 'pos.create', label: 'Create POs' },
      { key: 'pos.edit', label: 'Edit POs' },
      { key: 'pos.delete', label: 'Delete POs' },
    ],
  },
  {
    module: 'hr', label: 'HR Center', caps: [
      { key: 'hr.view', label: 'View employees' },
      { key: 'hr.create', label: 'Add employees' },
      { key: 'hr.edit', label: 'Edit employees' },
      { key: 'hr.delete', label: 'Remove employees' },
    ],
  },
  {
    module: 'salary', label: 'Salary', caps: [
      { key: 'salary.access', label: 'Open the Salary page', hint: 'Still behind the salary password' },
      { key: 'salary.edit', label: 'Edit salaries & bank details' },
      { key: 'salary.export', label: 'Download salary sheets' },
    ],
  },
  {
    module: 'activity', label: 'Activity', caps: [
      { key: 'activity.view', label: 'View activity log' },
    ],
  },
];

export const ALL_CAPS: string[] = CAPABILITY_GROUPS.flatMap((g) => g.caps.map((c) => c.key));

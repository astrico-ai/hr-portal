import { supabase } from './supabaseClient';

// Employee record. HR profile lives in `employees` (readable by HR users);
// sensitive pay (salary + bank) lives in a SEPARATE, locked `employee_pay`
// table whose RLS only lets salary.access read and salary.edit write. So a
// user without salary rights literally cannot fetch pay from the API — not
// just hidden in the UI. The pay fields below are optional: they're only
// present when the caller was allowed to read them.
export interface Employee {
  id?: number;
  employee_id?: string | null; // human ID e.g. astrico_1
  name: string;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_by_email?: string | null;
  created_at?: string;
  // ---- pay (from employee_pay; absent without salary access) ----
  salary?: number;
  ifsc?: string | null;
  account_number?: string | null;
}

// Profile columns only — never selects pay.
const PROFILE_COLS = 'id, employee_id, name, email, phone, is_active, created_by_email, created_at';

// HR-profile list (no pay). Safe for HR Center / anyone with employee access.
export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase.from('employees').select(PROFILE_COLS).order('name');
  if (error) {
    console.error('Error loading employees:', error);
    return [];
  }
  return (data ?? []) as Employee[];
};

// Profile + pay, merged. Pay comes from the locked table, so it silently
// returns empty for callers without salary access (RLS) — used by the Salary page.
export const getEmployeesWithPay = async (): Promise<Employee[]> => {
  const profiles = await getEmployees();
  const { data: pay, error } = await supabase
    .from('employee_pay')
    .select('employee_id, salary, ifsc, account_number');
  if (error) {
    // No access (or table missing) → just return profiles with no pay.
    console.warn('Could not load pay (no access?):', error.message);
    return profiles;
  }
  const payById = new Map((pay ?? []).map((p: any) => [p.employee_id, p]));
  return profiles.map((e) => {
    const p = payById.get(e.id);
    return p ? { ...e, salary: Number(p.salary) || 0, ifsc: p.ifsc, account_number: p.account_number } : e;
  });
};

// Create an employee (profile only — pay is added later on the Salary page).
export const saveEmployee = async (e: Employee): Promise<Employee> => {
  const row = {
    employee_id: e.employee_id?.trim() || null,
    name: e.name.trim(),
    email: e.email?.trim() || null,
    phone: e.phone?.trim() || null,
    is_active: e.is_active ?? true,
    created_by_email: localStorage.getItem('userEmail') || null,
  };
  const { data, error } = await supabase.from('employees').insert(row).select(PROFILE_COLS).single();
  if (error) throw error;
  return data as Employee;
};

// Update HR-profile fields only. Any pay fields passed in are ignored here —
// pay is written through upsertEmployeePay so it hits the locked table.
export const updateEmployee = async (id: number, updates: Partial<Employee>): Promise<void> => {
  const profile: Record<string, any> = {};
  for (const k of ['employee_id', 'name', 'email', 'phone', 'is_active'] as const) {
    if (k in updates) profile[k] = (updates as any)[k];
  }
  const pay: Partial<Employee> = {};
  for (const k of ['salary', 'ifsc', 'account_number'] as const) {
    if (k in updates) (pay as any)[k] = (updates as any)[k];
  }
  if (Object.keys(profile).length) {
    const { error } = await supabase.from('employees').update(profile).eq('id', id);
    if (error) throw error;
  }
  if (Object.keys(pay).length) await upsertEmployeePay(id, pay);
};

// Write pay to the locked table. Updates in place (preserving untouched fields),
// inserting a row the first time an employee gets pay details.
export const upsertEmployeePay = async (
  employeeId: number,
  patch: { salary?: number; ifsc?: string | null; account_number?: string | null }
): Promise<void> => {
  const stamp = { updated_by: localStorage.getItem('userEmail') || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('employee_pay')
    .update({ ...patch, ...stamp })
    .eq('employee_id', employeeId)
    .select('employee_id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: insErr } = await supabase
      .from('employee_pay')
      .insert({ employee_id: employeeId, salary: 0, ...patch, ...stamp });
    if (insErr) throw insErr;
  }
};

// Bulk-update salaries from an uploaded template. Matches each row to an
// employee by employee_id first, then by name. Returns counts + unmatched.
export const bulkUpdateSalaries = async (
  rows: { name?: string; employee_id?: string; salary: number }[]
): Promise<{ updated: number; unmatched: string[] }> => {
  const all = await getEmployees();
  const byEmpId = new Map(all.filter((e) => e.employee_id).map((e) => [String(e.employee_id).trim().toLowerCase(), e]));
  const byName = new Map(all.map((e) => [e.name.trim().toLowerCase(), e]));
  let updated = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const idKey = (r.employee_id || '').trim().toLowerCase();
    const nameKey = (r.name || '').trim().toLowerCase();
    const emp = (idKey && byEmpId.get(idKey)) || (nameKey && byName.get(nameKey));
    if (!emp) { unmatched.push(r.name || r.employee_id || '?'); continue; }
    try {
      await upsertEmployeePay(emp.id!, { salary: Number(r.salary) || 0 });
      updated++;
    } catch { /* skip failures, report as unmatched-ish via count */ }
  }
  return { updated, unmatched };
};

export const setEmployeeActive = async (id: number, is_active: boolean): Promise<void> => {
  const { error } = await supabase.from('employees').update({ is_active }).eq('id', id);
  if (error) throw error;
};

export const updateEmployeeSalary = async (id: number, salary: number): Promise<void> => {
  await upsertEmployeePay(id, { salary: Number(salary) || 0 });
};

export const deleteEmployee = async (id: number): Promise<void> => {
  // employee_pay row is removed automatically (ON DELETE CASCADE).
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
};

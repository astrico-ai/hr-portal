import { supabase } from './supabaseClient';

// Employee record for salary disbursement. Sensitive (salary + bank account) —
// stored in Supabase, protected by the same allow-list RLS as the rest.
export interface Employee {
  id?: number;
  employee_id?: string | null; // human ID e.g. astrico_1
  name: string;
  email?: string | null;
  phone?: string | null;
  salary: number;
  ifsc?: string | null;
  account_number?: string | null;
  is_active?: boolean;
  created_by_email?: string | null;
  created_at?: string;
}

export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) {
    console.error('Error loading employees:', error);
    return [];
  }
  return (data ?? []) as Employee[];
};

export const saveEmployee = async (e: Employee): Promise<Employee> => {
  const row = {
    employee_id: e.employee_id?.trim() || null,
    name: e.name.trim(),
    email: e.email?.trim() || null,
    phone: e.phone?.trim() || null,
    salary: Number(e.salary) || 0,
    ifsc: (e.ifsc || '').trim().toUpperCase() || null,
    account_number: (e.account_number || '').trim() || null,
    is_active: e.is_active ?? true,
    created_by_email: localStorage.getItem('userEmail') || null,
  };
  const { data, error } = await supabase.from('employees').insert(row).select().single();
  if (error) throw error;
  return data as Employee;
};

// Generic profile / bank-detail update.
export const updateEmployee = async (id: number, updates: Partial<Employee>): Promise<void> => {
  const { error } = await supabase.from('employees').update(updates).eq('id', id);
  if (error) throw error;
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
    const { error } = await supabase.from('employees').update({ salary: Number(r.salary) || 0 }).eq('id', emp.id!);
    if (!error) updated++;
  }
  return { updated, unmatched };
};

export const setEmployeeActive = async (id: number, is_active: boolean): Promise<void> => {
  const { error } = await supabase.from('employees').update({ is_active }).eq('id', id);
  if (error) throw error;
};

export const updateEmployeeSalary = async (id: number, salary: number): Promise<void> => {
  const { error } = await supabase.from('employees').update({ salary: Number(salary) || 0 }).eq('id', id);
  if (error) throw error;
};

export const deleteEmployee = async (id: number): Promise<void> => {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
};

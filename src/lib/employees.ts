import { supabase } from './supabaseClient';

// Employee record for salary disbursement. Sensitive (salary + bank account) —
// stored in Supabase, protected by the same allow-list RLS as the rest.
export interface Employee {
  id?: number;
  name: string;
  salary: number;
  ifsc: string;
  account_number: string;
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
    name: e.name.trim(),
    salary: Number(e.salary) || 0,
    ifsc: (e.ifsc || '').trim().toUpperCase(),
    account_number: (e.account_number || '').trim(),
    is_active: e.is_active ?? true,
    created_by_email: localStorage.getItem('userEmail') || null,
  };
  const { data, error } = await supabase.from('employees').insert(row).select().single();
  if (error) throw error;
  return data as Employee;
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

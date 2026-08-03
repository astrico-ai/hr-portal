import { supabase } from './supabaseClient';

export interface AppUser {
  email: string;
  name?: string | null;
  is_active?: boolean;
  is_admin?: boolean;
  permissions?: string[];
  created_at?: string;
}

export const getAppUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase.from('app_users').select('*').order('name');
  if (error) { console.error('Error loading users:', error); return []; }
  return (data ?? []) as AppUser[];
};

export const addAppUser = async (email: string, name: string): Promise<void> => {
  const { error } = await supabase.from('app_users').insert({
    email: email.trim().toLowerCase(),
    name: name.trim() || null,
    is_active: true,
    is_admin: false,
    permissions: [],
    created_by: localStorage.getItem('userEmail') || null,
  });
  if (error) throw error;
};

export const updateAppUserPermissions = async (email: string, permissions: string[]): Promise<void> => {
  const { error } = await supabase.from('app_users').update({ permissions }).eq('email', email.toLowerCase());
  if (error) throw error;
};

export const setAppUserActive = async (email: string, is_active: boolean): Promise<void> => {
  const { error } = await supabase.from('app_users').update({ is_active }).eq('email', email.toLowerCase());
  if (error) throw error;
};

export const deleteAppUser = async (email: string): Promise<void> => {
  const { error } = await supabase.from('app_users').delete().eq('email', email.toLowerCase());
  if (error) throw error;
};

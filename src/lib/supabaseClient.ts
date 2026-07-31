import { createClient } from '@supabase/supabase-js';

// Supabase connection. URL + publishable key come from .env.local (gitignored).
// The publishable key is safe in the browser — Row Level Security is the real
// access lock, enforced server-side per authenticated user.
const url = process.env.REACT_APP_SUPABASE_URL as string;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Surfaced in the console during dev if the env vars are missing.
  // eslint-disable-next-line no-console
  console.warn('[supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);

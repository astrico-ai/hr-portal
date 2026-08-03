import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  userEmail: string | null;
  isAuthenticated: boolean;
  loading: boolean;      // true until the initial session (incl. OAuth return) resolves
  isAdmin: boolean;      // the single super-admin (vraj@astrico.ai)
  permissions: string[]; // granted capability keys
  can: (cap: string) => boolean; // admin holds all
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// When the app runs on Supabase, auth runs on Supabase too.
const useSupabaseAuth = (process.env.REACT_APP_DATA_BACKEND || 'firebase').toLowerCase() === 'supabase';

// The hardcoded super-admin — always allowed in (failsafe so a bad/missing
// app_users row can never lock the owner out). Mirrors is_app_admin() in SQL.
const ADMIN_EMAIL = 'vraj@astrico.ai';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const clearUser = () => {
      setUserEmail(null);
      setPermissions([]);
      setIsAdmin(false);
      localStorage.removeItem('userEmail');
    };

    if (useSupabaseAuth) {
      // Apply a Supabase session: the user must exist & be active in app_users,
      // otherwise they're signed out. Their permissions come from that row.
      const apply = async (email?: string | null) => {
        if (!email) { clearUser(); return; }
        const { data, error } = await supabase
          .from('app_users')
          .select('is_active, is_admin, permissions')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        if (!error && data && data.is_active) {
          setUserEmail(email);
          localStorage.setItem('userEmail', email); // for the audit log
          setIsAdmin(!!data.is_admin);
          setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        } else if (email.toLowerCase() === ADMIN_EMAIL) {
          // Failsafe: the owner is always admin, even if the row/table is absent.
          setUserEmail(email);
          localStorage.setItem('userEmail', email);
          setIsAdmin(true);
          setPermissions([]);
        } else {
          await supabase.auth.signOut().catch(() => {});
          clearUser();
          alert(`${email} is not authorized to use this app.\nAsk vraj@astrico.ai to grant access.`);
        }
      };
      supabase.auth.getSession().then(({ data }) =>
        apply(data.session?.user?.email).finally(() => setLoading(false))
      );
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        apply(session?.user?.email);
      });
      return () => sub.subscription.unsubscribe();
    }

    // Firebase fallback (emergency, owner-only): full access.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setUserEmail(user.email);
        localStorage.setItem('userEmail', user.email);
        setIsAdmin(true);
      } else {
        clearUser();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    if (useSupabaseAuth) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
      });
      if (error) { alert('Google sign-in failed: ' + error.message); throw error; }
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user?.email) {
        setUserEmail(result.user.email);
        localStorage.setItem('userEmail', result.user.email);
      }
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      if (e?.code === 'auth/operation-not-allowed' || e?.code === 'auth/configuration-not-found') {
        alert('Google sign-in is not enabled yet.');
      } else {
        alert('Google sign-in failed: ' + (e?.message || e));
      }
      throw e;
    }
  };

  const logout = () => {
    localStorage.removeItem('userEmail');
    setUserEmail(null);
    setPermissions([]);
    setIsAdmin(false);
    if (useSupabaseAuth) supabase.auth.signOut().catch(() => {});
    else signOut(auth).catch(() => {});
  };

  const can = (cap: string) => isAdmin || permissions.includes(cap);

  return (
    <AuthContext.Provider value={{
      userEmail,
      isAuthenticated: !!userEmail,
      loading,
      isAdmin,
      permissions,
      can,
      loginWithGoogle,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

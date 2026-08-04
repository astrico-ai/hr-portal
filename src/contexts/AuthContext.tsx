import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

// Hardcoded super-admin — failsafe so a bad/missing app_users row can't lock out
// the owner. Mirrors is_app_admin() in SQL.
const ADMIN_EMAIL = 'vraj@astrico.ai';

// Session policy.
const INACTIVITY_MS = 30 * 60 * 1000;       // log out after 30 min idle
const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // absolute daily logout regardless of activity

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

  const sessionStartRef = useRef(0);
  const lastActivityRef = useRef(0);

  const logout = useCallback(() => {
    sessionStartRef.current = 0;
    localStorage.removeItem('userEmail');
    setUserEmail(null);
    setPermissions([]);
    setIsAdmin(false);
    if (useSupabaseAuth) supabase.auth.signOut().catch(() => {});
    else signOut(auth).catch(() => {});
  }, []);

  useEffect(() => {
    const clearUser = () => {
      setUserEmail(null);
      setPermissions([]);
      setIsAdmin(false);
      localStorage.removeItem('userEmail');
    };

    if (useSupabaseAuth) {
      // Apply a Supabase session: the user must exist & be active in app_users.
      const apply = async (email?: string | null) => {
        if (!email) { clearUser(); return; }
        const { data, error } = await supabase
          .from('app_users')
          .select('is_active, is_admin, permissions')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        if (!error && data && data.is_active) {
          setUserEmail(email);
          localStorage.setItem('userEmail', email);
          setIsAdmin(!!data.is_admin);
          setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        } else if (email.toLowerCase() === ADMIN_EMAIL) {
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

      // Rule: log out on a hard refresh. A persisted session is only honoured when
      // this page load is the OAuth return (fresh sign-in); any other fresh load
      // (refresh / reopen) signs out, so the session never survives a reload.
      const oauthReturn =
        window.location.search.includes('code=') || window.location.hash.includes('access_token');

      const init = async () => {
        const { data } = await supabase.auth.getSession();
        if (oauthReturn) {
          await apply(data.session?.user?.email);
        } else {
          if (data.session) await supabase.auth.signOut().catch(() => {});
          clearUser();
        }
        setLoading(false);
      };
      init();

      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        // Ignore INITIAL_SESSION (handled by init above, and we don't resume on reload).
        if (event === 'SIGNED_OUT') clearUser();
        else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') apply(session?.user?.email);
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

  // Inactivity (30 min) + absolute daily logout, while signed in.
  useEffect(() => {
    if (!userEmail) return;
    if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    lastActivityRef.current = Date.now();

    const bump = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const interval = setInterval(() => {
      const t = Date.now();
      if (t - lastActivityRef.current > INACTIVITY_MS || t - sessionStartRef.current > MAX_SESSION_MS) {
        logout();
      }
    }, 20000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(interval);
    };
  }, [userEmail, logout]);

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

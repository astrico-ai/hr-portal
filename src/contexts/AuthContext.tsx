import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  userEmail: string | null;
  isAuthenticated: boolean;
  loading: boolean; // true until the initial session (incl. OAuth return) resolves
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Same switch as the data layer: when the app runs on Supabase, auth runs on
// Supabase too (its RLS lock only trusts a Supabase session).
const useSupabaseAuth = (process.env.REACT_APP_DATA_BACKEND || 'firebase').toLowerCase() === 'supabase';

// Who may sign in. Anyone at the company domain, plus explicit extra emails.
// (Also enforced in the database via RLS, so this isn't the only gate.)
const ALLOWED_DOMAINS = ['astrico.ai'];
const ALLOWED_EMAILS = ['astricoai@gmail.com'];
const isAllowed = (email?: string | null): boolean => {
  if (!email) return false;
  const e = email.toLowerCase();
  return ALLOWED_DOMAINS.some((d) => e.endsWith(`@${d}`)) || ALLOWED_EMAILS.includes(e);
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (useSupabaseAuth) {
      // Apply a Supabase session: accept only allow-listed emails, else sign out.
      const apply = async (email?: string | null) => {
        if (email && isAllowed(email)) {
          setUserEmail(email);
          localStorage.setItem('userEmail', email); // for the audit log
        } else if (email) {
          await supabase.auth.signOut().catch(() => {});
          setUserEmail(null);
          localStorage.removeItem('userEmail');
          alert(`${email} is not authorized for this app.\nPlease sign in with your @astrico.ai account.`);
        } else {
          setUserEmail(null);
          localStorage.removeItem('userEmail');
        }
      };
      // getSession() resolves only AFTER supabase-js has processed the OAuth
      // ?code= in the URL, so it's the reliable signal that auth is settled.
      supabase.auth.getSession().then(({ data }) =>
        apply(data.session?.user?.email).finally(() => setLoading(false))
      );
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        apply(session?.user?.email);
      });
      return () => sub.subscription.unsubscribe();
    }

    // Firebase path (default): the Firebase session is the source of truth.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setUserEmail(user.email);
        localStorage.setItem('userEmail', user.email);
      } else {
        setUserEmail(null);
        localStorage.removeItem('userEmail');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    if (useSupabaseAuth) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) {
        alert('Google sign-in failed: ' + error.message);
        throw error;
      }
      return; // the browser now redirects to Google; the session is picked up on return
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
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        return; // user dismissed the popup — not an error
      }
      if (e?.code === 'auth/operation-not-allowed' || e?.code === 'auth/configuration-not-found') {
        alert(
          'Google sign-in is not enabled yet.\n\nEnable it in Firebase Console → Authentication → ' +
            'Sign-in method → Google, then try again.'
        );
      } else {
        alert('Google sign-in failed: ' + (e?.message || e));
      }
      throw e;
    }
  };

  const logout = () => {
    localStorage.removeItem('userEmail');
    setUserEmail(null);
    if (useSupabaseAuth) {
      supabase.auth.signOut().catch(() => {});
    } else {
      signOut(auth).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{
      userEmail,
      isAuthenticated: !!userEmail,
      loading,
      loginWithGoogle,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

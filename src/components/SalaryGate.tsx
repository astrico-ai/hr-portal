import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// The only account allowed to set/reset the salary password. Must match
// is_salary_admin() in supabase/salary-password.sql.
const OWNER_EMAIL = 'vraj@astrico.ai';
const SESSION_KEY = 'salaryUnlocked';

const SalaryGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userEmail } = useAuth();
  const isOwner = (userEmail || '').toLowerCase() === OWNER_EMAIL;

  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [pwSet, setPwSet] = useState<boolean | null>(null);
  const [resetting, setResetting] = useState(false); // owner is setting a new password
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('salary_password_is_set').then(({ data, error }) => {
      setPwSet(error ? false : !!data);
    });
  }, []);

  if (unlocked) return <>{children}</>;

  const unlock = async () => {
    setBusy(true); setError('');
    const { data, error } = await supabase.rpc('verify_salary_password', { pw });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data === true) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setUnlocked(true);
    } else {
      setError('Incorrect password.');
      setPw('');
    }
  };

  const savePassword = async () => {
    setBusy(true); setError('');
    const { error } = await supabase.rpc('set_salary_password', { new_pw: pw });
    setBusy(false);
    if (error) { setError(error.message.replace('new row for relation', '').trim()); return; }
    sessionStorage.setItem(SESSION_KEY, '1');
    setUnlocked(true);
  };

  const showSetForm = pwSet === false || resetting; // set (first time) or owner resetting
  const submit = (e: React.FormEvent) => { e.preventDefault(); showSetForm ? savePassword() : unlock(); };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lift">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-gray-900">
            {showSetForm ? 'Set salary password' : 'Salary is protected'}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {showSetForm
              ? 'Choose a password to protect the Salary page.'
              : 'Enter the salary password to view this page.'}
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-elevated ring-1 ring-gray-200/70">
          {pwSet === null ? (
            <p className="text-center text-sm text-gray-400">Loading…</p>
          ) : pwSet === false && !isOwner ? (
            <div className="text-center text-sm text-gray-500">
              <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-gray-300" />
              The salary password hasn't been set yet.<br />
              Please ask <span className="font-medium text-gray-700">{OWNER_EMAIL}</span> to set it.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="form-label">{showSetForm ? 'New password' : 'Password'}</label>
                <input
                  type="password"
                  className="form-input"
                  value={pw}
                  autoFocus
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy || !pw} className="btn btn-primary w-full">
                {busy ? 'Please wait…' : showSetForm ? 'Set password & unlock' : 'Unlock'}
              </button>
            </form>
          )}

          {/* Owner-only: reset the password */}
          {isOwner && pwSet === true && !resetting && (
            <button
              onClick={() => { setResetting(true); setError(''); setPw(''); }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:text-primary-600"
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset salary password
            </button>
          )}
          {isOwner && resetting && (
            <button onClick={() => { setResetting(false); setError(''); setPw(''); }}
              className="mt-4 w-full text-xs font-medium text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">Signed in as {userEmail}</p>
      </div>
    </div>
  );
};

export default SalaryGate;

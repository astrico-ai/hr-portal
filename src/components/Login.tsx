import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const Login = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      navigate('/');
    } catch {
      /* error already surfaced in context */
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-50 px-4 py-12">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary-200/50 via-primary-100/40 to-transparent blur-3xl" />
        <div className="absolute bottom-[-200px] right-[-120px] h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-indigo-200/40 to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lift ring-1 ring-inset ring-white/20">
            <FileText className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Sign in to continue to HR Portal
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl bg-white/90 p-6 shadow-elevated ring-1 ring-gray-200/70 backdrop-blur-sm sm:p-8">
          <button
            type="button"
            onClick={handleGoogle}
            className="btn btn-secondary w-full py-2.5 text-sm"
            autoFocus
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">
            Use your authorized Google account
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          NV360 Technology · Billing &amp; Invoicing
        </p>
      </div>
    </div>
  );
};

export default Login;

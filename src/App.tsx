import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Users, FileInput as FileInvoice, LogOut, LayoutDashboard, History, Wallet, Contact,
  Menu, ChevronLeft, ChevronRight, ShieldCheck,
} from 'lucide-react';
import ClientList from './components/ClientList';
import ClientForm from './components/ClientForm';
import ClientDetails from './components/ClientDetails';
import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import ProjectDetails from './components/ProjectDetails';
import BillableItemFormWrapper from './components/BillableItemFormWrapper';
import Login from './components/Login';
import AuditLog from './components/AuditLog';
import HRCenter from './components/HRCenter';
import Salary from './components/Salary';
import SalaryGate from './components/SalaryGate';
import AccessManagement from './components/AccessManagement';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ApproveInvoices from './components/ApproveInvoices';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
        <p className="text-sm text-gray-400">Signing you in…</p>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function LoginRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return isAuthenticated ? <Navigate to="/" /> : <Login />;
}

type CanFn = (cap: string) => boolean;

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p === '/', anyOf: ['dashboard.page'] },
  { to: '/clients', label: 'Clients', icon: Users, match: (p: string) => p.startsWith('/clients'), anyOf: ['clients.view', 'clients.create'] },
  { to: '/invoices', label: 'Invoices', icon: FileInvoice, match: (p: string) => p.startsWith('/invoices'), anyOf: ['invoices.view', 'invoices.create', 'invoices.export'] },
  { to: '/hr', label: 'HR Center', icon: Contact, match: (p: string) => p.startsWith('/hr'), anyOf: ['hr.view', 'hr.create'] },
  { to: '/salary', label: 'Salary', icon: Wallet, match: (p: string) => p.startsWith('/salary'), anyOf: ['salary.access'] },
  { to: '/activity', label: 'Activity', icon: History, match: (p: string) => p.startsWith('/activity'), anyOf: ['activity.view'] },
];

// First page the user is allowed to see (for redirects). Admin falls back to
// Access Management; a user with nothing lands on a "no access" notice.
function firstAllowedPath(can: CanFn, isAdmin: boolean): string {
  const item = NAV_ITEMS.find((i) => i.anyOf.some((c) => can(c)));
  if (item) return item.to;
  return isAdmin ? '/access' : '/no-access';
}

// Route guard: renders children if the user holds any required capability
// (or is admin); otherwise bounces to their first allowed page.
function Guard({ anyOf, admin, children }: { anyOf?: string[]; admin?: boolean; children: React.ReactNode }) {
  const { can, isAdmin } = useAuth();
  const ok = admin ? isAdmin : anyOf ? anyOf.some((c) => can(c)) : true;
  if (ok) return <>{children}</>;
  return <Navigate to={firstAllowedPath(can, isAdmin)} replace />;
}

function NoAccess() {
  const { userEmail } = useAuth();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <ShieldCheck className="h-10 w-10 text-gray-300" />
      <h1 className="mt-4 text-xl font-bold text-gray-900">No access yet</h1>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500">
        Your account ({userEmail}) doesn't have any permissions yet. Ask <span className="font-medium text-gray-700">vraj@astrico.ai</span> to grant access.
      </p>
    </div>
  );
}

function AppShell() {
  const { userEmail, logout, can, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('nav.collapsed') === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem('nav.collapsed', collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [currentPath]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const initial = (userEmail || '?').trim().charAt(0).toUpperCase();

  // Only show nav items the user can reach; admin also gets Access Management.
  const nav = NAV_ITEMS.filter((i) => i.anyOf.some((c) => can(c)));
  if (isAdmin) {
    nav.push({ to: '/access', label: 'Access', icon: ShieldCheck, match: (p: string) => p.startsWith('/access'), anyOf: [] });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-200
          ${collapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-gray-100 px-3">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm ring-1 ring-inset ring-white/20">
              <FileText className="h-5 w-5" />
            </span>
            {!collapsed && <span className="truncate text-lg font-bold tracking-tight text-gray-900">HR Portal</span>}
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto hidden h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 lg:flex"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {nav.map(({ to, label, icon: Icon, match }) => {
            const active = match(currentPath);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${active ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <Icon className="h-5 w-5 flex-none" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-2">
          <div className={`flex items-center gap-2.5 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-xs font-semibold text-white ring-1 ring-inset ring-white/10" title={userEmail || undefined}>
              {initial}
            </span>
            {!collapsed && userEmail && <span className="truncate text-xs text-gray-500">{userEmail}</span>}
          </div>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 ${collapsed ? 'justify-center' : ''}`}
            title="Sign out"
          >
            <LogOut className="h-5 w-5 flex-none" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={`transition-all duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-bold tracking-tight text-gray-900">HR Portal</span>
        </div>

        <main>
          <Routes>
            <Route path="/" element={<Guard anyOf={['dashboard.page']}><Dashboard /></Guard>} />
            <Route path="/clients" element={<Guard anyOf={['clients.view', 'clients.create']}><ClientList /></Guard>} />
            <Route path="/clients/new" element={<Guard anyOf={['clients.create']}><ClientForm /></Guard>} />
            <Route path="/clients/:id" element={<Guard anyOf={['clients.view']}><ClientDetails /></Guard>} />
            <Route path="/clients/:id/edit" element={<Guard anyOf={['clients.edit']}><ClientForm /></Guard>} />
            <Route path="/invoices" element={<Guard anyOf={['invoices.view', 'invoices.create', 'invoices.export']}><InvoiceList /></Guard>} />
            <Route path="/invoices/project/:projectId" element={<Guard anyOf={['invoices.view', 'invoices.edit', 'pos.view']}><ProjectDetails /></Guard>} />
            <Route path="/invoices/project/:projectId/items/new" element={<Guard anyOf={['invoices.create']}><BillableItemFormWrapper /></Guard>} />
            <Route path="/approve-invoices" element={<Guard admin><ApproveInvoices /></Guard>} />
            <Route path="/hr" element={<Guard anyOf={['hr.view', 'hr.create']}><HRCenter /></Guard>} />
            <Route path="/salary" element={<Guard anyOf={['salary.access']}><SalaryGate><Salary /></SalaryGate></Guard>} />
            <Route
              path="/activity"
              element={
                <Guard anyOf={['activity.view']}>
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Activity Log</h1>
                    <AuditLog />
                  </div>
                </Guard>
              }
            />
            <Route path="/access" element={<Guard admin><AccessManagement /></Guard>} />
            <Route path="/no-access" element={<NoAccess />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<PrivateRoute><AppShell /></PrivateRoute>} />
        </Routes>
        <Analytics />
        <SpeedInsights />
      </Router>
    </AuthProvider>
  );
}

export default App;

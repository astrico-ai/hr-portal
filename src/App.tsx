import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FileText, Users, FileInput as FileInvoice, LogOut, LayoutDashboard, History, Wallet, Contact } from 'lucide-react';
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
  if (loading) return <AuthLoading />; // wait for the session (incl. OAuth return) before deciding
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

// The /login route: while auth is resolving show the loader (so the OAuth
// ?code= isn't stripped by a premature redirect); once resolved, send a
// logged-in user to the dashboard, otherwise show the login screen.
function LoginRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return isAuthenticated ? <Navigate to="/" /> : <Login />;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { to: '/clients', label: 'Clients', icon: Users, match: (p: string) => p.startsWith('/clients') },
  { to: '/invoices', label: 'Invoices', icon: FileInvoice, match: (p: string) => p.startsWith('/invoices') },
  { to: '/hr', label: 'HR Center', icon: Contact, match: (p: string) => p.startsWith('/hr') },
  { to: '/salary', label: 'Salary', icon: Wallet, match: (p: string) => p.startsWith('/salary') },
  { to: '/activity', label: 'Activity', icon: History, match: (p: string) => p.startsWith('/activity') },
];

function Navigation() {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initial = (userEmail || '?').trim().charAt(0).toUpperCase();

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/65">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover:scale-105">
                <FileText className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight text-gray-900">HR Portal</span>
            </Link>
            <div className="hidden sm:flex sm:items-center sm:gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => {
                const active = match(currentPath);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 pl-1">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-xs font-semibold text-white ring-1 ring-inset ring-white/10"
                title={userEmail || undefined}
              >
                {initial}
              </span>
              {userEmail && (
                <span className="hidden lg:block max-w-[160px] truncate text-sm text-gray-500">
                  {userEmail}
                </span>
              )}
            </div>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="Sign out">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <>
                    <Navigation />
                    <main>
                      <Routes>
                        <Route path="/clients" element={<ClientList />} />
                        <Route path="/clients/new" element={<ClientForm />} />
                        <Route path="/clients/:id" element={<ClientDetails />} />
                        <Route path="/clients/:id/edit" element={<ClientForm />} />
                        <Route path="/invoices" element={<InvoiceList />} />
                        <Route path="/hr" element={<HRCenter />} />
                        <Route path="/salary" element={<Salary />} />
                        <Route path="/invoices/project/:projectId" element={<ProjectDetails />} />
                        <Route path="/invoices/project/:projectId/items/new" element={<BillableItemFormWrapper />} />
                        <Route path="/approve-invoices" element={<ApproveInvoices />} />
                        <Route
                          path="/activity"
                          element={
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                              <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Activity Log</h1>
                              <AuditLog />
                            </div>
                          }
                        />
                        <Route path="/" element={<Dashboard />} />
                      </Routes>
                    </main>
                  </>
                </PrivateRoute>
              }
            />
          </Routes>
          <Analytics />
          <SpeedInsights />
        </div>
      </Router>
    </AuthProvider>
  );
}

const Placeholder = ({ title }: { title: string }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
    <p className="text-gray-600">This section will be implemented next.</p>
  </div>
);

export default App;
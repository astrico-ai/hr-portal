import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FileText, Users, FileInput as FileInvoice, LogOut } from 'lucide-react';
import ClientList from './components/ClientList';
import ClientForm from './components/ClientForm';
import ClientDetails from './components/ClientDetails';
import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import ProjectDetails from './components/ProjectDetails';
import BillableItemFormWrapper from './components/BillableItemFormWrapper';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ApproveInvoices from './components/ApproveInvoices';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';



function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function Navigation() {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <FileText className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">HR Portal</span>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPath === '/' 
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/clients"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPath.startsWith('/clients')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                Clients
              </Link>
              <Link
                to="/invoices"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPath.startsWith('/invoices')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <FileInvoice className="h-4 w-4 mr-2" />
                Invoices
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
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
            <Route path="/login" element={<Login />} />
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
                        <Route path="/invoices/project/:projectId" element={<ProjectDetails />} />
                        <Route path="/invoices/project/:projectId/items/new" element={<BillableItemFormWrapper />} />
                        <Route path="/approve-invoices" element={<ApproveInvoices />} />
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
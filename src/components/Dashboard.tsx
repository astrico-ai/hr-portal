import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Receipt, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Welcome to your HR Portal dashboard. Manage your documents, clients, and invoices all in one place.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Documents Card */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:border-primary-500 transition-colors duration-200">
          <Link to="/documents" className="block">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Documents</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage all your legal documents
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm font-medium text-primary-600">
                  View documents
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Clients Card */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:border-primary-500 transition-colors duration-200">
          <Link to="/clients" className="block">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Clients</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    View and manage client information
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm font-medium text-primary-600">
                  Manage clients
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Invoices Card */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:border-primary-500 transition-colors duration-200">
          <Link to="/invoices" className="block">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Receipt className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Invoices</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create and track invoices
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm font-medium text-primary-600">
                  View invoices
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Stats Section */}
      <div className="mt-12">
        <h2 className="text-lg font-medium text-gray-900">Quick Stats</h2>
        <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="px-4 py-5 bg-white shadow-sm rounded-lg overflow-hidden sm:p-6 border border-gray-200">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">12</dd>
          </div>
          <div className="px-4 py-5 bg-white shadow-sm rounded-lg overflow-hidden sm:p-6 border border-gray-200">
            <dt className="text-sm font-medium text-gray-500 truncate">Active Documents</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">25</dd>
          </div>
          <div className="px-4 py-5 bg-white shadow-sm rounded-lg overflow-hidden sm:p-6 border border-gray-200">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending Invoices</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">4</dd>
          </div>
        </dl>
      </div>

      {/* Recent Activity Section */}
      <div className="mt-12">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
            <p className="mt-2 text-sm text-gray-700">
              A list of your recent activities and updates.
            </p>
          </div>
        </div>
        <div className="mt-6 bg-white shadow-sm rounded-lg border border-gray-200">
          <ul role="list" className="divide-y divide-gray-200">
            {[
              { action: 'Added new client', target: 'Tech Solutions Ltd', time: '2 hours ago' },
              { action: 'Updated document', target: 'Q4 Financial Report', time: '4 hours ago' },
              { action: 'Generated invoice', target: 'INV-2024-001', time: '1 day ago' },
            ].map((item, index) => (
              <li key={index} className="px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.action}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{item.target}</p>
                  </div>
                  <div className="flex-shrink-0 text-sm text-gray-500">
                    {item.time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
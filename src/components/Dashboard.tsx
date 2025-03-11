import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Receipt, ArrowRight, CalendarDays, Filter, X } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getBillableItems, getClients, getProjects } from '../lib/storage';
import { getFinancialYearDates, getCurrentQuarter, getLastSixMonths, formatCurrency } from '../utils/dateUtils';
import type { BillableItem, Client, Project } from '../types';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type DateRangePreset = 'last30' | 'last90' | 'last180' | 'ytd' | 'custom';

interface FilterState {
  dateRange: {
    preset: DateRangePreset;
    startDate: Date | null;
    endDate: Date | null;
  };
  clients: {
    selectedClientIds: string[];
    selectedProjectIds: string[];
  };
  invoiceTypes: ('LICENSE' | 'ONE_TIME' | 'OTHERS')[];
}

const Dashboard = () => {
  // Data states
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      preset: 'ytd',
      startDate: null,
      endDate: null
    },
    clients: {
      selectedClientIds: [],
      selectedProjectIds: []
    },
    invoiceTypes: ['LICENSE', 'ONE_TIME', 'OTHERS']
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [items, clientsList, projectsList] = await Promise.all([
        getBillableItems(),
        getClients(),
        getProjects()
      ]);
      setBillableItems(items);
      setClients(clientsList);
      setProjects(projectsList);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate YTD Revenue
  const calculateYTDRevenue = () => {
    const { start, end } = getFinancialYearDates();
    
    return getFilteredBillableItems()
      .filter(item => 
        item.invoice_date &&
        new Date(item.invoice_date) >= start &&
        new Date(item.invoice_date) <= end &&
        ['RAISED', 'RECEIVED'].includes(item.status)
      )
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Calculate Quarterly Revenue
  const calculateQuarterlyRevenue = () => {
    const { start, end } = getCurrentQuarter();
    
    return getFilteredBillableItems()
      .filter(item => 
        item.invoice_date &&
        new Date(item.invoice_date) >= start &&
        new Date(item.invoice_date) <= end &&
        ['RAISED', 'RECEIVED'].includes(item.status)
      )
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Calculate Monthly Revenue
  const calculateMonthlyRevenue = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return getFilteredBillableItems()
      .filter(item => 
        item.invoice_date &&
        new Date(item.invoice_date) >= start &&
        new Date(item.invoice_date) <= end &&
        ['RAISED', 'RECEIVED'].includes(item.status)
      )
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Calculate Outstanding Amount (Pending only)
  const calculateOutstandingAmount = () => {
    return getFilteredBillableItems()
      .filter(item => item.status === 'PENDING')
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Get filtered billable items based on all filters
  const getFilteredBillableItems = () => {
    return billableItems.filter(item => {
      // Date Range Filter
      if (filters.dateRange.preset === 'custom' && filters.dateRange.startDate && filters.dateRange.endDate) {
        const itemDate = new Date(item.invoice_date || '');
        if (itemDate < filters.dateRange.startDate || itemDate > filters.dateRange.endDate) return false;
      }

      // Client & Project Filter
      if (filters.clients.selectedClientIds.length > 0) {
        const project = projects.find(p => p.id === item.project_id);
        if (!project) return false;
        if (!filters.clients.selectedClientIds.includes(project.client_id.toString())) return false;
        
        if (filters.clients.selectedProjectIds.length > 0) {
          if (!filters.clients.selectedProjectIds.includes(item.project_id.toString())) return false;
        }
      }

      // Invoice Type Filter
      if (!filters.invoiceTypes.includes(item.type)) return false;

      return true;
    });
  };

  // Calculate Last 6 Months Revenue by Type
  const calculateLastSixMonthsRevenue = () => {
    const months = getLastSixMonths();
    const revenueByType = {
      LICENSE: months.map(({ start, end }) => 
        getFilteredBillableItems()
          .filter(item => 
            item.invoice_date &&
            new Date(item.invoice_date) >= start &&
            new Date(item.invoice_date) <= end &&
            ['RAISED', 'RECEIVED'].includes(item.status) &&
            item.type === 'LICENSE'
          )
          .reduce((sum, item) => sum + item.amount, 0)
      ),
      ONE_TIME: months.map(({ start, end }) => 
        getFilteredBillableItems()
          .filter(item => 
            item.invoice_date &&
            new Date(item.invoice_date) >= start &&
            new Date(item.invoice_date) <= end &&
            ['RAISED', 'RECEIVED'].includes(item.status) &&
            item.type === 'ONE_TIME'
          )
          .reduce((sum, item) => sum + item.amount, 0)
      ),
      OTHERS: months.map(({ start, end }) => 
        getFilteredBillableItems()
          .filter(item => 
            item.invoice_date &&
            new Date(item.invoice_date) >= start &&
            new Date(item.invoice_date) <= end &&
            ['RAISED', 'RECEIVED'].includes(item.status) &&
            item.type === 'OTHERS'
          )
          .reduce((sum, item) => sum + item.amount, 0)
      )
    };

    return {
      labels: months.map(m => m.label),
      revenueByType
    };
  };

  // Handle date range preset change
  const handleDateRangePresetChange = (preset: DateRangePreset) => {
    const newDateRange = { ...filters.dateRange, preset };
    
    if (preset !== 'custom') {
      const today = new Date();
      switch (preset) {
        case 'last30':
          newDateRange.startDate = new Date(today.setDate(today.getDate() - 30));
          newDateRange.endDate = new Date();
          break;
        case 'last90':
          newDateRange.startDate = new Date(today.setDate(today.getDate() - 90));
          newDateRange.endDate = new Date();
          break;
        case 'last180':
          newDateRange.startDate = new Date(today.setDate(today.getDate() - 180));
          newDateRange.endDate = new Date();
          break;
        case 'ytd':
          const { start, end } = getFinancialYearDates();
          newDateRange.startDate = start;
          newDateRange.endDate = end;
          break;
      }
    }

    setFilters(prev => ({
      ...prev,
      dateRange: newDateRange
    }));
  };

  // Handle client selection
  const handleClientSelection = (clientId: string) => {
    setFilters(prev => {
      const selectedClientIds = prev.clients.selectedClientIds.includes(clientId)
        ? prev.clients.selectedClientIds.filter(id => id !== clientId)
        : [...prev.clients.selectedClientIds, clientId];

      // Clear project selection if client is deselected
      const selectedProjectIds = prev.clients.selectedProjectIds.filter(projectId => {
        const project = projects.find(p => p.id === parseInt(projectId));
        return project && selectedClientIds.includes(project.client_id.toString());
      });

      return {
        ...prev,
        clients: {
          selectedClientIds,
          selectedProjectIds
        }
      };
    });
  };

  // Handle project selection
  const handleProjectSelection = (projectId: string) => {
    setFilters(prev => ({
      ...prev,
      clients: {
        ...prev.clients,
        selectedProjectIds: prev.clients.selectedProjectIds.includes(projectId)
          ? prev.clients.selectedProjectIds.filter(id => id !== projectId)
          : [...prev.clients.selectedProjectIds, projectId]
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const { labels, revenueByType } = calculateLastSixMonthsRevenue();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Filters Toggle */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Financial Overview</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </button>
      </div>

      {/* Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowFilters(false)}></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full sm:p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Range Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CalendarDays className="h-4 w-4 inline-block mr-1" />
                    Date Range
                  </label>
                  <select
                    value={filters.dateRange.preset}
                    onChange={(e) => handleDateRangePresetChange(e.target.value as DateRangePreset)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    <option value="last30">Last 30 Days</option>
                    <option value="last90">Last 90 Days</option>
                    <option value="last180">Last 6 Months</option>
                    <option value="ytd">Year to Date</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {filters.dateRange.preset === 'custom' && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={filters.dateRange.startDate?.toISOString().split('T')[0] || ''}
                          onChange={(e) => setFilters(prev => ({
                            ...prev,
                            dateRange: {
                              ...prev.dateRange,
                              startDate: new Date(e.target.value)
                            }
                          }))}
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">End Date</label>
                        <input
                          type="date"
                          value={filters.dateRange.endDate?.toISOString().split('T')[0] || ''}
                          onChange={(e) => setFilters(prev => ({
                            ...prev,
                            dateRange: {
                              ...prev.dateRange,
                              endDate: new Date(e.target.value)
                            }
                          }))}
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Client Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline-block mr-1" />
                    Clients
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {clients.map(client => (
                      <div key={client.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`client-${client.id}`}
                          checked={filters.clients.selectedClientIds.includes(client.id.toString())}
                          onChange={() => handleClientSelection(client.id.toString())}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`client-${client.id}`} className="ml-2 text-sm text-gray-700">
                          {client.legal_name || `Client ${client.id}`}
                        </label>
              </div>
                    ))}
        </div>
                </div>

                {/* Invoice Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Receipt className="h-4 w-4 inline-block mr-1" />
                    Invoice Types
                  </label>
                  <div className="space-y-2">
                    {['LICENSE', 'ONE_TIME', 'OTHERS'].map(type => (
                      <div key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`type-${type}`}
                          checked={filters.invoiceTypes.includes(type as any)}
                          onChange={() => {
                            setFilters(prev => ({
                              ...prev,
                              invoiceTypes: prev.invoiceTypes.includes(type as any)
                                ? prev.invoiceTypes.filter(t => t !== type)
                                : [...prev.invoiceTypes, type as any]
                            }));
                          }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`type-${type}`} className="ml-2 text-sm text-gray-700">
                          {type.replace('_', ' ')}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* YTD Revenue */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Revenue (YTD)</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateYTDRevenue())}
          </p>
          <p className="mt-2 text-sm text-gray-500">Financial Year {new Date().getFullYear()}</p>
        </div>

        {/* Quarterly Revenue */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Quarterly Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateQuarterlyRevenue())}
          </p>
          <p className="mt-2 text-sm text-gray-500">Current Quarter</p>
                </div>

        {/* Monthly Revenue */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Monthly Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateMonthlyRevenue())}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </p>
                </div>

        {/* Outstanding Amount */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Outstanding Amount</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateOutstandingAmount())}
          </p>
          <p className="mt-2 text-sm text-gray-500">Pending Invoices</p>
                </div>
              </div>

      {/* Revenue Chart */}
      <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Revenue Trend</h3>
        <div className="h-80">
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: 'License/MRR',
                  data: revenueByType.LICENSE,
                  borderColor: 'rgb(59, 130, 246)', // Blue
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  borderWidth: 2,
                  pointHoverRadius: 6,
                  pointHoverBackgroundColor: 'white',
                  pointHoverBorderColor: 'rgb(59, 130, 246)',
                  pointHoverBorderWidth: 2,
                },
                {
                  label: 'One-time',
                  data: revenueByType.ONE_TIME,
                  borderColor: 'rgb(16, 185, 129)', // Green
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  borderWidth: 2,
                  pointHoverRadius: 6,
                  pointHoverBackgroundColor: 'white',
                  pointHoverBorderColor: 'rgb(16, 185, 129)',
                  pointHoverBorderWidth: 2,
                },
                {
                  label: 'Others',
                  data: revenueByType.OTHERS,
                  borderColor: 'rgb(249, 115, 22)', // Orange
                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  borderWidth: 2,
                  pointHoverRadius: 6,
                  pointHoverBackgroundColor: 'white',
                  pointHoverBorderColor: 'rgb(249, 115, 22)',
                  pointHoverBorderWidth: 2,
                }
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  grid: {
                    display: true,
                    color: 'rgba(229, 231, 235, 0.5)', // Very light gray
                  },
                  ticks: {
                    font: {
                      size: 12,
                    },
                    color: 'rgb(107, 114, 128)', // Gray-500
                  }
                },
                y: {
                  beginAtZero: true,
                  grid: {
                    display: true,
                    color: 'rgba(229, 231, 235, 0.5)', // Very light gray
                  },
                  ticks: {
                    font: {
                      size: 12,
                    },
                    color: 'rgb(107, 114, 128)', // Gray-500
                    callback: (value) => formatCurrency(value as number),
                  },
                },
              },
              plugins: {
                legend: {
                  display: true,
                  position: 'top',
                  labels: {
                    usePointStyle: false,
                    boxWidth: 16,
                    padding: 20,
                  }
                },
                tooltip: {
                  enabled: true,
                  mode: 'index',
                  intersect: false,
                  backgroundColor: 'white',
                  titleColor: 'rgb(17, 24, 39)', // Gray-900
                  bodyColor: 'rgb(17, 24, 39)', // Gray-900
                  borderColor: 'rgb(229, 231, 235)', // Gray-200
                  borderWidth: 1,
                  padding: 12,
                  callbacks: {
                    title: (tooltipItems) => {
                      return tooltipItems[0].label;
                    },
                    label: (context) => {
                      return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                    },
                  },
                },
              },
              interaction: {
                intersect: false,
                mode: 'index',
              },
            }}
          />
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
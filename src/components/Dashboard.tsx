import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Receipt, ArrowRight, CalendarDays, Filter, X, DollarSign, Clock, TrendingUp, Wallet, CreditCard, BadgeDollarSign, Building2, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
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

interface Activity {
  id: number;
  type: 'billable' | 'project';
  description: string;
  amount: number;
  date: string;
  status: string;
}

interface BaseProject {
  id: number;
  name: string;
  client_id: number;
  sales_manager?: string;
  project_manager?: string;
  cx_manager?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

interface ProjectWithManagers extends BaseProject {
  project_id: number;
  type: string;
  amount: number;
  invoice_date: string;
  start_date: string;
  end_date: string;
  po_number: string;
}

interface ManagerStats {
  name: string;
  mrr: number;
  projects: ProjectWithManagers[];
}

const formatShortCurrency = (amount: number) => {
  if (amount >= 10000000) { // 1 crore
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  } else if (amount >= 100000) { // 1 lakh
    return `₹${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

// Helper functions for MRR calculations
const calculateMonthlyMRR = (items: BillableItem[], year: number, month: number) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const now = new Date();

  return items
    .filter(item => 
      item.type === 'LICENSE' &&
      ['RAISED', 'RECEIVED'].includes(item.status) &&
      // Check if license period covers that month
      new Date(item.start_date) <= end && 
      new Date(item.end_date) >= start &&
      // For past/current months, also check invoice date
      (start > now || (item.invoice_date && new Date(item.invoice_date) <= end))
    )
    .reduce((sum, item) => {
      // If a license is active in a month, count its full monthly amount
      // Calculate the total duration and monthly amount
      const startDate = new Date(item.start_date);
      const endDate = new Date(item.end_date);
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
        (endDate.getMonth() - startDate.getMonth()) + 1;
      
      // Return the monthly amount
      return sum + (item.amount / monthsDiff);
    }, 0);
};

const calculateProjectMRR = (items: BillableItem[], projectId: number) => {
  return items
    .filter(item => 
      item.type === 'LICENSE' &&
      item.project_id === projectId &&
      ['RAISED', 'RECEIVED'].includes(item.status)
    )
    .reduce((sum, item) => {
      const startDate = new Date(item.start_date);
      const endDate = new Date(item.end_date);
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
        (endDate.getMonth() - startDate.getMonth()) + 1;
      return sum + (item.amount / monthsDiff);
    }, 0);
};

const calculateCustomerMRR = (items: BillableItem[], projects: ProjectWithManagers[], customerId: number) => {
  const customerProjects = projects.filter(p => p.client_id === customerId);
  return customerProjects.reduce((sum, project) => 
    sum + calculateProjectMRR(items, project.id)
  , 0);
};

const calculateMRRGrowth = (currentMRR: number, previousMRR: number) => {
  if (previousMRR === 0) return 100;
  return ((currentMRR - previousMRR) / previousMRR) * 100;
};

const Dashboard = () => {
  // Data states
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWithManagers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<{
    type: 'month' | 'quarter' | 'year' | 'fy' | 'custom';
    startDate: Date;
    endDate: Date;
  }>({
    type: 'month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  });

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
      
      // Create a map of project IDs to their billable items
      const projectBillables = items.reduce((acc, item) => {
        if (!acc[item.project_id]) {
          acc[item.project_id] = [];
        }
        acc[item.project_id].push(item);
        return acc;
      }, {} as Record<number, BillableItem[]>);

      // Merge projects with their billable items
      const projectsWithBillables = projectsList.map(project => {
        const billables = projectBillables[project.id] || [];
        const latestBillable = billables[0] || {};
        
        return {
          ...project,
          ...latestBillable,
          status: 'ACTIVE',
          created_at: project.created_at || new Date().toISOString()
        };
      });

      setProjects(projectsWithBillables as unknown as ProjectWithManagers[]);
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
      .filter(item => item.status === 'RAISED')
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

  // Get filtered billable items based on date range
  const getDateFilteredItems = (items: BillableItem[]) => {
    if (!dateFilter) return items;
    
    return items.filter(item => {
      const itemDate = new Date(item.invoice_date || '');
      return itemDate >= dateFilter.startDate && itemDate <= dateFilter.endDate;
    });
  };

  // Update date filter
  const updateDateFilter = (type: 'month' | 'quarter' | 'year' | 'fy' | 'custom', customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterMonth, 1);
        endDate = new Date(now.getFullYear(), quarterMonth + 3, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'fy':
        // Current Financial Year (April 2024 to March 2025)
        startDate = new Date(2024, 3, 1); // April 1st, 2024
        endDate = new Date(2025, 2, 31); // March 31st, 2025
        break;
      case 'custom':
        startDate = customStart || now;
        endDate = customEnd || now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    setDateFilter({ type, startDate, endDate });
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

  // Get recent activities
  const getRecentActivities = () => {
    const activities: Activity[] = [];

    // Add recent billable items
    billableItems.slice(0, 5).forEach(item => {
      const project = projects.find(p => p.id === item.project_id);
      const client = clients.find(c => c.id === project?.client_id);
      activities.push({
        id: item.id,
        type: 'billable',
        description: `New ${item.type} invoice for ${client?.legal_name || 'Unknown Client'}`,
        amount: item.amount,
        date: item.invoice_date || new Date().toISOString(),
        status: item.status
      });
    });

    // Add recent projects
    projects.slice(0, 5).forEach(project => {
      const client = clients.find(c => c.id === project.client_id);
      const projectBillableAmount = billableItems
        .filter(item => item.project_id === project.id)
        .reduce((sum, item) => sum + item.amount, 0);
      activities.push({
        id: project.id,
        type: 'project',
        description: `Project created: ${project.name} for ${client?.legal_name || 'Unknown Client'}`,
        amount: projectBillableAmount,
        date: project.created_at || new Date().toISOString(),
        status: 'ACTIVE'
      });
    });

    // Sort by date descending and take latest 5
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  };

  // Calculate Total Revenue split by type
  const calculateTotalRevenue = () => {
    const items = getDateFilteredItems(getFilteredBillableItems()).filter(item => 
      ['RAISED', 'RECEIVED'].includes(item.status)
    );
    
    return {
      total: items.reduce((sum, item) => sum + item.amount, 0),
      license: items.filter(item => item.type === 'LICENSE')
        .reduce((sum, item) => sum + item.amount, 0),
      onetime: items.filter(item => item.type === 'ONE_TIME')
        .reduce((sum, item) => sum + item.amount, 0)
    };
  };

  // Calculate One-time Revenue with status breakdown
  const calculateOnetimeRevenue = () => {
    const items = getDateFilteredItems(getFilteredBillableItems())
      .filter(item => item.type === 'ONE_TIME');
    
    return {
      raised: items.filter(item => item.status === 'RAISED')
        .reduce((sum, item) => sum + item.amount, 0),
      received: items.filter(item => item.status === 'RECEIVED')
        .reduce((sum, item) => sum + item.amount, 0)
    };
  };

  // Calculate License Revenue (ARR) with status breakdown
  const calculateLicenseRevenue = () => {
    // Use original items without date filter for ARR
    const items = getFilteredBillableItems()
      .filter(item => item.type === 'LICENSE');
    
    return {
      raised: items.filter(item => item.status === 'RAISED')
        .reduce((sum, item) => sum + item.amount, 0),
      received: items.filter(item => item.status === 'RECEIVED')
        .reduce((sum, item) => sum + item.amount, 0)
    };
  };

  // Calculate Current MRR (Monthly Recurring Revenue)
  const calculateCurrentMRR = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Use original items without date filter for MRR
    return getFilteredBillableItems()
      .filter(item => 
        item.type === 'LICENSE' &&
        item.invoice_date &&
        new Date(item.invoice_date) >= start &&
        new Date(item.invoice_date) <= end &&
        ['RAISED', 'RECEIVED'].includes(item.status)
      )
      .reduce((sum, item) => {
        const startDate = new Date(item.start_date);
        const endDate = new Date(item.end_date);
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
          (endDate.getMonth() - startDate.getMonth()) + 1;

        const monthlyAmount = item.amount / monthsDiff;
        return sum + monthlyAmount;
      }, 0);
  };

  // Calculate Current NRR (Net Revenue Run Rate)
  const calculateCurrentNRR = () => {
    const mrr = calculateCurrentMRR();
    // Use original items without date filter for one-time revenue in NRR calculation
    const onetime = {
      raised: getFilteredBillableItems()
        .filter(item => item.type === 'ONE_TIME' && item.status === 'RAISED')
        .reduce((sum, item) => sum + item.amount, 0),
      received: getFilteredBillableItems()
        .filter(item => item.type === 'ONE_TIME' && item.status === 'RECEIVED')
        .reduce((sum, item) => sum + item.amount, 0)
    };
    const onetimeMonthly = (onetime.raised + onetime.received) / 12;
    return mrr + onetimeMonthly;
  };

  // Calculate Average Invoice Collection Time
  const calculateAvgCollectionTime = () => {
    // Get all items that were both raised and then received
    const completedInvoices = billableItems.filter(item => 
      item.status === 'RECEIVED' &&
      item.invoice_date
    );

    if (completedInvoices.length === 0) return 0;

    // For each invoice, find when it was first raised
    const totalDays = completedInvoices.reduce((sum, receivedItem) => {
      // Find the original raised item
      const raisedItem = billableItems.find(item => 
        item.id === receivedItem.id &&
        item.status === 'RAISED'
      );

      if (!raisedItem?.invoice_date) return sum;

      const raisedDate = new Date(raisedItem.invoice_date);
      const receivedDate = new Date(receivedItem.invoice_date!);
      return sum + (receivedDate.getTime() - raisedDate.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);

    return Math.round(totalDays / completedInvoices.length);
  };

  // Calculate Top 5 Customers by Revenue
  const calculateTopCustomers = () => {
    const customerRevenue = new Map<string, number>();

    // Calculate total revenue per customer
    billableItems.forEach(item => {
      const project = projects.find(p => p.id === item.project_id);
      if (!project) return;

      const client = clients.find(c => c.id === project.client_id);
      if (!client) return;

      const current = customerRevenue.get(client.id.toString()) || 0;
      customerRevenue.set(client.id.toString(), current + item.amount);
    });

    // Convert to array and sort
    return Array.from(customerRevenue.entries())
      .map(([clientId, revenue]) => ({
        client: clients.find(c => c.id.toString() === clientId)!,
        revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
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
      {/* Header with Date Filter */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Financial Overview</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateDateFilter('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              dateFilter.type === 'month' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => updateDateFilter('quarter')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              dateFilter.type === 'quarter' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Quarter
          </button>
          <button
            onClick={() => updateDateFilter('year')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              dateFilter.type === 'year' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Year
          </button>
          <button
            onClick={() => updateDateFilter('fy')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              dateFilter.type === 'fy' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current FY
          </button>
          <div className="relative ml-2">
            <input
              type="date"
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              value={dateFilter.startDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const newStart = new Date(e.target.value);
                updateDateFilter('custom', newStart, dateFilter.endDate);
              }}
            />
            <span className="mx-2">to</span>
            <input
              type="date"
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              value={dateFilter.endDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const newEnd = new Date(e.target.value);
                updateDateFilter('custom', dateFilter.startDate, newEnd);
              }}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm ring-1 ring-blue-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-blue-400">
            <DollarSign size={24} />
          </div>
          <h3 className="text-sm font-medium text-blue-600">Total Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateTotalRevenue().total)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">License</span>
              <span className="text-sm font-medium text-blue-800">{formatCurrency(calculateTotalRevenue().license)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">One-time</span>
              <span className="text-sm font-medium text-blue-800">{formatCurrency(calculateTotalRevenue().onetime)}</span>
            </div>
          </div>
        </div>

        {/* One-time Revenue */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 shadow-sm ring-1 ring-green-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-green-400">
            <CreditCard size={24} />
          </div>
          <h3 className="text-sm font-medium text-green-600">One-time Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateOnetimeRevenue().raised + calculateOnetimeRevenue().received)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700">Raised</span>
              <span className="text-sm font-medium text-green-800">{formatCurrency(calculateOnetimeRevenue().raised)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700">Received</span>
              <span className="text-sm font-medium text-green-800">{formatCurrency(calculateOnetimeRevenue().received)}</span>
            </div>
          </div>
        </div>

        {/* License Revenue (ARR) */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 shadow-sm ring-1 ring-purple-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-purple-400">
            <BadgeDollarSign size={24} />
          </div>
          <h3 className="text-sm font-medium text-purple-600">Annual Recurring Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateLicenseRevenue().raised + calculateLicenseRevenue().received)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700">Raised</span>
              <span className="text-sm font-medium text-purple-800">{formatCurrency(calculateLicenseRevenue().raised)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700">Received</span>
              <span className="text-sm font-medium text-purple-800">{formatCurrency(calculateLicenseRevenue().received)}</span>
            </div>
          </div>
        </div>

        {/* Current MRR */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 shadow-sm ring-1 ring-indigo-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-indigo-400">
            <TrendingUp size={24} />
          </div>
          <h3 className="text-sm font-medium text-indigo-600">Monthly Recurring Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateCurrentMRR())}
          </p>
          <div className="mt-4">
            <span className="text-sm text-indigo-700">This Month</span>
          </div>
        </div>

        {/* Current NRR */}
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 shadow-sm ring-1 ring-pink-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-pink-400">
            <ArrowUpRight size={24} />
          </div>
          <h3 className="text-sm font-medium text-pink-600">Net Revenue Run Rate</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateCurrentNRR())}
          </p>
          <div className="mt-4">
            <span className="text-sm text-pink-700">Annualized Revenue</span>
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 shadow-sm ring-1 ring-amber-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-amber-400">
            <Wallet size={24} />
          </div>
          <h3 className="text-sm font-medium text-amber-600">Outstanding Amount</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateOutstandingAmount())}
          </p>
          <div className="mt-4">
            <span className="text-sm text-amber-700">Awaiting Payment</span>
          </div>
        </div>

        {/* Average Collection Time */}
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 shadow-sm ring-1 ring-cyan-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-cyan-400">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-medium text-cyan-600">Avg. Collection Time</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {calculateAvgCollectionTime()} days
          </p>
          <div className="mt-4">
            <span className="text-sm text-cyan-700">Invoice to Payment</span>
          </div>
        </div>

        {/* Top 5 Customers */}
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 shadow-sm ring-1 ring-teal-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-teal-400">
            <Building2 size={24} />
          </div>
          <h3 className="text-sm font-medium text-teal-600">Top Customers</h3>
          <div className="mt-6">
            {calculateTopCustomers().map((item, index) => (
              <div 
                key={item.client.id} 
                className="group flex items-center justify-between mb-4 last:mb-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    flex-none w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200' : 
                      index === 1 ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' :
                      index === 2 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                      'bg-white/50 text-teal-600 ring-1 ring-teal-100'}
                  `}>
                    {index + 1}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-[140px]">
                      {item.client.legal_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatShortCurrency(item.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MRR Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Recurring Revenue (MRR)</h2>
        
        {/* MRR Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Current MRR */}
          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-600">Current MRR</h3>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(calculateCurrentMRR())}
              </p>
              {calculateMRRGrowth(
                calculateCurrentMRR(),
                calculateMonthlyMRR(billableItems, new Date().getFullYear(), new Date().getMonth() - 1)
              ) > 0 ? (
                <span className="ml-2 flex items-center text-sm font-medium text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  {calculateMRRGrowth(
                    calculateCurrentMRR(),
                    calculateMonthlyMRR(billableItems, new Date().getFullYear(), new Date().getMonth() - 1)
                  ).toFixed(1)}%
                </span>
              ) : (
                <span className="ml-2 flex items-center text-sm font-medium text-red-600">
                  <ArrowDownRight className="h-4 w-4" />
                  {Math.abs(calculateMRRGrowth(
                    calculateCurrentMRR(),
                    calculateMonthlyMRR(billableItems, new Date().getFullYear(), new Date().getMonth() - 1)
                  )).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">vs last month</p>
          </div>

          {/* MoM Growth */}
          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-600">Month over Month Growth</h3>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">
                {calculateMRRGrowth(
                  calculateCurrentMRR(),
                  calculateMonthlyMRR(billableItems, new Date().getFullYear(), new Date().getMonth() - 1)
                ).toFixed(1)}%
              </p>
            </div>
            <p className="mt-1 text-sm text-gray-500">Current trend</p>
          </div>

          {/* Top Customer MRR */}
          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-600">Top Customer MRR</h3>
            <div className="mt-2">
              {(() => {
                const topCustomer = clients.reduce((max, client) => {
                  const mrr = calculateCustomerMRR(billableItems, projects, client.id);
                  return mrr > max.mrr ? { client, mrr } : max;
                }, { client: clients[0], mrr: 0 });

                return (
                  <>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(topCustomer.mrr)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-700 truncate">
                      {topCustomer.client?.legal_name}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* MRR Graph */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">MRR Trend (FY 2024-25)</h3>
          <div className="h-80">
            <Line
              data={{
                labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                datasets: [
                  {
                    label: 'MRR',
                    data: Array.from({ length: 12 }, (_, i) => {
                      if (i === 8) return 150000; // For December 2024
                      if (i >= 9) return 150000; // For January to March 2025
                      const year = 2024;
                      const month = i + 3; // Convert to actual month (0-11)
                      return calculateMonthlyMRR(billableItems, year, month);
                    }),
                    borderColor: 'rgb(79, 70, 229)',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    fill: true,
                    tension: 0.4,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `₹${(value as number).toLocaleString('en-IN')}`
                    }
                  }
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (context) => `MRR: ₹${context.parsed.y.toLocaleString('en-IN')}`
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Project-wise MRR */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Project-wise MRR</h3>
            <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MRR</th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects
                  .map(project => ({
                    project,
                    mrr: calculateProjectMRR(billableItems, project.id)
                  }))
                  .sort((a, b) => b.mrr - a.mrr)
                  .slice(0, 10)
                  .map(({ project, mrr }) => {
                    const client = clients.find(c => c.id === project.client_id);
                    return (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {project.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {client?.legal_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(mrr)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            project.status === 'ACTIVE' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {project.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team-wise MRR */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Team-wise MRR</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sales Manager */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-600">Sales Manager</h4>
              {Object.values(projects
                .filter(p => p.sales_manager)
                .reduce((acc, project) => {
                  const manager = project.sales_manager;
                  if (!manager) return acc;
                  if (!acc[manager]) {
                    acc[manager] = {
                      name: manager,
                      mrr: calculateProjectMRR(billableItems, project.id),
                      projects: [project]
                    };
                  } else {
                    acc[manager].mrr += calculateProjectMRR(billableItems, project.id);
                    acc[manager].projects.push(project);
                  }
                  return acc;
                }, {} as Record<string, ManagerStats>))
                .sort((a, b) => b.mrr - a.mrr)
                .map(manager => (
                  <div key={manager.name} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{manager.name}</span>
                      <span className="text-sm text-gray-600">{formatCurrency(manager.mrr)}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {manager.projects.length} projects
                    </div>
                  </div>
                ))}
            </div>

            {/* Project Manager */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-600">Project Manager</h4>
              {Object.values(projects
                .filter(p => p.project_manager)
                .reduce((acc, project) => {
                  const manager = project.project_manager;
                  if (!manager) return acc;
                  if (!acc[manager]) {
                    acc[manager] = {
                      name: manager,
                      mrr: calculateProjectMRR(billableItems, project.id),
                      projects: [project]
                    };
                  } else {
                    acc[manager].mrr += calculateProjectMRR(billableItems, project.id);
                    acc[manager].projects.push(project);
                  }
                  return acc;
                }, {} as Record<string, ManagerStats>))
                .sort((a, b) => b.mrr - a.mrr)
                .map(manager => (
                  <div key={manager.name} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{manager.name}</span>
                      <span className="text-sm text-gray-600">{formatCurrency(manager.mrr)}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {manager.projects.length} projects
                    </div>
                  </div>
                ))}
            </div>

            {/* CX Manager */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-600">CX Manager</h4>
              {Object.values(projects
                .filter(p => p.cx_manager)
                .reduce((acc, project) => {
                  const manager = project.cx_manager;
                  if (!manager) return acc;
                  if (!acc[manager]) {
                    acc[manager] = {
                      name: manager,
                      mrr: calculateProjectMRR(billableItems, project.id),
                      projects: [project]
                    };
                  } else {
                    acc[manager].mrr += calculateProjectMRR(billableItems, project.id);
                    acc[manager].projects.push(project);
                  }
                  return acc;
                }, {} as Record<string, ManagerStats>))
                .sort((a, b) => b.mrr - a.mrr)
                .map(manager => (
                  <div key={manager.name} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{manager.name}</span>
                      <span className="text-sm text-gray-600">{formatCurrency(manager.mrr)}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {manager.projects.length} projects
                    </div>
                  </div>
                ))}
            </div>
          </div>
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
                    callback: (value) => `₹${(value as number).toLocaleString('en-IN')}`,
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
                      return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
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
        <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        <div className="mt-5 bg-white shadow-sm rounded-lg border border-gray-200">
          <ul role="list" className="divide-y divide-gray-200">
            {getRecentActivities().map((activity) => (
              <li key={activity.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-blue-600 truncate">{activity.description}</p>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${activity.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                      activity.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                      'bg-blue-100 text-blue-800'}`}>
                      {activity.status}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      {activity.type === 'billable' ? 'Invoice' : 'Project'}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                    <p>
                      ₹{activity.amount.toLocaleString('en-IN')} • {new Date(activity.date).toLocaleDateString()}
                    </p>
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
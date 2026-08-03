import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Users, 
  Receipt, 
  ArrowRight, 
  CalendarDays, 
  Filter, 
  X, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  Wallet, 
  CreditCard, 
  BadgeDollarSign, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import LicenseGantt from './LicenseGantt';
import OneTimeChart from './OneTimeChart';
import ReceivablesAging from './ReceivablesAging';
import NextDueInvoices from './NextDueInvoices';
import { getBillableItems, getClients, getProjects } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { getFinancialYearDates, getCurrentQuarter, getLastSixMonths, formatCurrency } from '../utils/dateUtils';
import type { BillableItem, Client, Project } from '../types';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type DateRangePreset = 'last30' | 'last90' | 'last180' | 'ytd' | 'custom';
type RevenueType = 'MRR' | 'ONE_TIME' | 'OTHERS';

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
  is_active?: boolean;
  inactive_date?: string | null;
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
  mrr: number;
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
  // Get current FY dates
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const fyStartYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
  const fyStart = new Date(fyStartYear, 3, 1); // April 1st
  const fyEnd = new Date(fyStartYear + 1, 2, 31); // March 31st

  const licenseItems = items.filter(item => 
    item.type === 'LICENSE' &&
    item.project_id === projectId &&
    ['RAISED', 'RECEIVED'].includes(item.status) &&
    // Only include items that fall within current FY
    new Date(item.start_date) <= fyEnd &&
    new Date(item.end_date) >= fyStart
  );

  console.log('Calculating MRR for project:', projectId);
  
  return licenseItems.reduce((sum, item) => {
    const startDate = new Date(item.start_date);
    const endDate = new Date(item.end_date);
    
    // Special handling for Dec 15 - Mar 31 period
    if (startDate.getFullYear() === 2024 && startDate.getMonth() === 11 && startDate.getDate() === 15 &&
        endDate.getFullYear() === 2025 && endDate.getMonth() === 2 && endDate.getDate() === 31) {
      const monthsDiff = 3.5; // Explicitly set for Dec 15 - Mar 31
      const monthlyAmount = item.amount / monthsDiff;
      
      console.log('License item:', {
        amount: item.amount,
        startDate: item.start_date,
        endDate: item.end_date,
        monthsDiff,
        monthlyAmount,
        status: item.status
      });
      
      return sum + monthlyAmount;
    }
    
    // Normal calculation for other periods
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
      (endDate.getMonth() - startDate.getMonth()) + 1;
    
    const monthlyAmount = item.amount / monthsDiff;
    
    console.log('License item:', {
      amount: item.amount,
      startDate: item.start_date,
      endDate: item.end_date,
      monthsDiff,
      monthlyAmount,
      status: item.status
    });
    
    return sum + monthlyAmount;
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
  }>(() => {
    // Get current date
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Determine financial year
    const fyStartYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
    
    // Set start date to April 1st of the financial year
    const startDate = new Date(Date.UTC(fyStartYear, 3, 1)); // April 1st
    startDate.setUTCHours(0, 0, 0, 0);
    
    // Set end date to March 31st of the next year
    const endDate = new Date(Date.UTC(fyStartYear + 1, 2, 31)); // March 31st
    endDate.setUTCHours(23, 59, 59, 999);
    
    return {
      type: 'fy',
      startDate,
      endDate
    };
  });
  // Local string state for the date inputs. Binding the native date inputs
  // directly to dateFilter made them re-render and reset the caret on every
  // keystroke, so typing a year (e.g. 2025) dropped digits and produced junk
  // like 1905. We type into these strings freely and only commit valid dates.
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const [selectedRevenueType, setSelectedRevenueType] = useState<RevenueType>('MRR');
  const { can } = useAuth();
  const showRevenue = can('dashboard.revenue');
  const showReceivables = can('dashboard.receivables');
  const showLicenses = can('dashboard.licenses');

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

  // Pagination and sorting states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<'name' | 'department' | 'amount' | 'license' | 'onetime'>('amount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // New filter states for team-wise revenue
  const [teamDateFilter, setTeamDateFilter] = useState<{
    type: 'fy' | 'quarter' | 'month' | 'custom';
    startDate: Date;
    endDate: Date;
  }>(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const fyStartYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
    
    return {
      type: 'fy',
      startDate: new Date(Date.UTC(fyStartYear, 3, 1)), // April 1st
      endDate: new Date(Date.UTC(fyStartYear + 1, 2, 31)) // March 31st
    };
  });
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);

  // Calculate employee stats with filters
  const employeeStats = useMemo(() => {
    const stats: { name: string; department: string; licenseAmount: number; oneTimeAmount: number }[] = [];
    
    // Get all unique employees from projects
    const employees = new Set<string>();
    projects.forEach(project => {
      if (project.sales_manager) employees.add(project.sales_manager);
      if (project.project_manager) employees.add(project.project_manager);
      if (project.cx_manager) employees.add(project.cx_manager);
    });

    // Calculate stats for each employee
    employees.forEach(employee => {
      // Determine department
      let department = '';
      if (projects.some(p => p.sales_manager === employee)) {
        department = 'Sales';
      } else if (projects.some(p => p.project_manager === employee)) {
        department = 'Operations';
      } else if (projects.some(p => p.cx_manager === employee)) {
        department = 'CX';
      }

      // Skip if department is not selected
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(department)) {
        return;
      }

      // Calculate total received amount for invoices raised by this employee within date range
      const licenseAmount = billableItems
        .filter(item => 
          item.invoice_raised_by === employee && 
          item.status === 'RECEIVED' &&
          item.type === 'LICENSE' &&
          item.invoice_date &&
          new Date(item.invoice_date) >= teamDateFilter.startDate &&
          new Date(item.invoice_date) <= teamDateFilter.endDate
        )
        .reduce((sum, item) => sum + item.amount, 0);

      const oneTimeAmount = billableItems
        .filter(item => 
          item.invoice_raised_by === employee && 
          item.status === 'RECEIVED' &&
          item.type === 'ONE_TIME' &&
          item.invoice_date &&
          new Date(item.invoice_date) >= teamDateFilter.startDate &&
          new Date(item.invoice_date) <= teamDateFilter.endDate
        )
        .reduce((sum, item) => sum + item.amount, 0);

      stats.push({ name: employee, department, licenseAmount, oneTimeAmount });
    });

    return stats;
  }, [projects, billableItems, teamDateFilter, selectedDepartments]);

  // Sort employee stats
  const sortedEmployeeStats = useMemo(() => {
    return [...employeeStats].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'name') {
        return multiplier * a.name.localeCompare(b.name);
      } else if (sortField === 'department') {
        return multiplier * a.department.localeCompare(b.department);
      } else if (sortField === 'license') {
        return multiplier * (a.licenseAmount - b.licenseAmount);
      } else {
        return multiplier * (a.oneTimeAmount - b.oneTimeAmount);
      }
    });
  }, [employeeStats, sortField, sortDirection]);

  // Get paginated employees
  const paginatedEmployees = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return sortedEmployeeStats.slice(start, start + itemsPerPage);
  }, [sortedEmployeeStats, currentPage, itemsPerPage]);

  // Handle sorting
  const handleSort = (field: 'name' | 'department' | 'amount' | 'license' | 'onetime') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

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

      // Merge projects with their billable items without overwriting project properties
      const projectsWithBillables = projectsList.map(project => {
        const billables = projectBillables[project.id] || [];
        const latestBillable = billables[0] || {};
        
        return {
          ...latestBillable,  // Put billable properties first
          ...project,         // Then override with project properties to preserve them
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

    // Get current month and year
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    switch (type) {
      case 'month':
        // Use current month, ensuring timezone doesn't affect the date
        startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        endDate.setUTCHours(23, 59, 59, 999);
        break;
      case 'quarter':
        // Financial year quarters
        let quarterStartMonth: number;
        if (currentMonth >= 3 && currentMonth <= 5) {
          quarterStartMonth = 3; // Q1
        } else if (currentMonth >= 6 && currentMonth <= 8) {
          quarterStartMonth = 6; // Q2
        } else if (currentMonth >= 9 && currentMonth <= 11) {
          quarterStartMonth = 9; // Q3
        } else {
          quarterStartMonth = 0; // Q4
        }
        startDate = new Date(Date.UTC(currentYear, quarterStartMonth, 1));
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(Date.UTC(currentYear, quarterStartMonth + 3, 0));
        endDate.setUTCHours(23, 59, 59, 999);
        break;
      case 'year':
        // Use calendar year (Jan 1st to Dec 31st)
        startDate = new Date(Date.UTC(currentYear, 0, 1));
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(Date.UTC(currentYear, 11, 31));
        endDate.setUTCHours(23, 59, 59, 999);
        break;
      case 'fy':
        // Use financial year with UTC dates
        const fyStartYear = currentMonth <= 3 ? currentYear - 1 : currentYear;
        startDate = new Date(Date.UTC(fyStartYear, 3, 1)); // April 1st
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(Date.UTC(fyStartYear + 1, 2, 31)); // March 31st
        endDate.setUTCHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customStart && customEnd) {
          // Keep everything in UTC to match the date inputs (which read/write
          // via toISOString / Date.UTC). Using local setHours here shifted the
          // day by the timezone offset, e.g. picking the 15th showed the 14th.
          startDate = new Date(customStart);
          startDate.setUTCHours(0, 0, 0, 0);
          endDate = new Date(customEnd);
          endDate.setUTCHours(23, 59, 59, 999);
        } else {
          // When switching to custom without dates, use current month as default
          startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
          startDate.setUTCHours(0, 0, 0, 0);
          endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
          endDate.setUTCHours(23, 59, 59, 999);
        }
        break;
      default:
        startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        endDate.setUTCHours(23, 59, 59, 999);
    }

    setDateFilter({ type, startDate, endDate });
  };

  // Update the date input handlers to use UTC
  // Safely format a Date for a <input type="date"> value, falling back to
  // an empty string for invalid dates instead of throwing.
  const toDateInputValue = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Mirror committed filter dates into the input strings (preset buttons,
  // initial load). User typing flows the other way via handleDateInputChange.
  useEffect(() => {
    setStartInput(toDateInputValue(dateFilter.startDate));
    setEndInput(toDateInputValue(dateFilter.endDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter.startDate, dateFilter.endDate]);

  const handleDateInputChange = (date: string, isStart: boolean) => {
    // Keep the input responsive: store the raw string immediately so the
    // native control never has its caret reset mid-edit.
    if (isStart) {
      setStartInput(date);
    } else {
      setEndInput(date);
    }

    const [year, month, day] = date.split('-').map(Number);
    const newDate = new Date(Date.UTC(year, month - 1, day));

    // Native date inputs can emit an empty/partial value while editing, or a
    // not-yet-sensible year. Only commit once we have a real, plausible date.
    if (isNaN(newDate.getTime()) || year < 1970 || year > 9999) {
      return;
    }

    if (isStart) {
      newDate.setUTCHours(0, 0, 0, 0);
      updateDateFilter('custom', newDate, dateFilter.endDate);
    } else {
      newDate.setUTCHours(23, 59, 59, 999);
      updateDateFilter('custom', dateFilter.startDate, newDate);
    }
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
      ),
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
    // Use date filtered items for ARR
    const items = getDateFilteredItems(getFilteredBillableItems())
      .filter(item => item.type === 'LICENSE');
    
    return {
      raised: items.filter(item => item.status === 'RAISED')
        .reduce((sum, item) => sum + item.amount, 0),
      received: items.filter(item => item.status === 'RECEIVED')
        .reduce((sum, item) => sum + item.amount, 0)
    };
  };

  // A project counts toward recurring revenue only if both the project and its
  // client are active (inactive ones stop counting from their inactivation).
  const isProjectActive = (projectId: number): boolean => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return false;
    if (proj.is_active === false) return false;
    const client = clients.find(c => c.id === proj.client_id);
    if (client && client.is_active === false) return false;
    return true;
  };

  // The license items that make up each active project's CURRENT recurring
  // commitment. Per project we anchor on the latest-starting license, then keep
  // every license whose period OVERLAPS that anchor. This:
  //  • sums concurrent streams (e.g. Motul's 12-mo platform + 9-mo software),
  //  • excludes ended sequential periods (an old server license that finished),
  //  • stays stable across the monthly gap (uses the latest period, not "today",
  //    so a monthly client doesn't vanish before its next invoice is raised).
  const getCurrentlyActiveLicenseItems = (): BillableItem[] => {
    const lic = getFilteredBillableItems()
      .filter(item => item.type === 'LICENSE')
      .filter(item => ['RAISED', 'RECEIVED'].includes(item.status))
      .filter(item => item.start_date && item.end_date)
      .filter(item => isProjectActive(item.project_id));

    const byProject: Record<number, BillableItem[]> = {};
    lic.forEach(item => { (byProject[item.project_id] ||= []).push(item); });

    const result: BillableItem[] = [];
    Object.values(byProject).forEach(items => {
      const anchor = [...items].sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )[0];
      const aStart = new Date(anchor.start_date).getTime();
      const aEnd = new Date(anchor.end_date!).getTime();
      items.forEach(it => {
        const s = new Date(it.start_date).getTime();
        const e = new Date(it.end_date!).getTime();
        if (s <= aEnd && e >= aStart) result.push(it); // overlaps the current window
      });
    });
    return result;
  };

  // MRR = sum over all currently-active license items of (amount ÷ months it
  // covers). The day-span month count handles multi-month single invoices
  // (e.g. an Apr–Jul license = ₹X ÷ 4) and mid-month periods.
  const calculateCurrentMRR = () => {
    return getCurrentlyActiveLicenseItems().reduce((total, item) => {
      const s = new Date(item.start_date);
      const e = new Date(item.end_date!);
      const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      const months = Math.max(1, Math.round(days / 30.44));
      return total + item.amount / months;
    }, 0);
  };

  // Projected revenue for the current financial year (Apr–Mar):
  // each license contributes monthlyAmount × the months remaining in the FY from
  // when it started (a license starting in April → ×12; in June → ×10; one that
  // started before this FY → ×12). Plus avg one-time per month × 12.
  const calculateProjectedRevenue = () => {
    const now = new Date();
    const fyStartYear = now.getMonth() <= 2 ? now.getFullYear() - 1 : now.getFullYear();

    // Monthly run-rate = amount spread over the months the invoice covers (day span).
    const monthlyOf = (item: BillableItem): number => {
      const s = new Date(item.start_date);
      const e = new Date(item.end_date || item.start_date);
      const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      const months = Math.max(1, Math.round(days / 30.44));
      return item.amount / months;
    };

    // Group license items by project.
    const byProject: Record<number, BillableItem[]> = {};
    billableItems
      .filter(i => i.type === 'LICENSE')
      .forEach(i => { (byProject[i.project_id] ||= []).push(i); });

    let annualRecurring = 0;
    Object.entries(byProject).forEach(([projectId, items]) => {
      if (!isProjectActive(Number(projectId))) return; // active clients/projects only
      const latest = [...items].sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )[0];
      const first = [...items].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )[0];
      const monthly = monthlyOf(latest);

      const startDt = new Date(first.invoice_date || first.start_date);
      const startFY = startDt.getMonth() <= 2 ? startDt.getFullYear() - 1 : startDt.getFullYear();
      let remaining: number;
      if (startFY < fyStartYear) remaining = 12;          // active before this FY → full year
      else if (startFY > fyStartYear) remaining = 0;       // starts in a future FY
      else remaining = 13 - (((startDt.getMonth() - 3 + 12) % 12) + 1); // Apr→12, Jun→10…

      annualRecurring += monthly * remaining;
    });

    // Average one-time per month (active clients/projects only), annualized.
    const oneTime = billableItems.filter(
      i => i.type === 'ONE_TIME' && (i.status === 'RAISED' || i.status === 'RECEIVED') && isProjectActive(i.project_id)
    );
    const totalOneTime = oneTime.reduce((sum, i) => sum + i.amount, 0);
    const monthsWithOneTime = new Set(
      oneTime.map(i => (i.invoice_date || i.start_date || '').slice(0, 7)).filter(Boolean)
    ).size;
    const avgOneTimePerMonth = monthsWithOneTime > 0 ? totalOneTime / monthsWithOneTime : 0;
    const annualOneTime = avgOneTimePerMonth * 12;

    return {
      annualRecurring,
      avgOneTimePerMonth,
      annualOneTime,
      projected: annualRecurring + annualOneTime,
    };
  };

  // Average MRR per recurring project (the "average ticket size"): current MRR
  // divided by the number of distinct projects with a currently-active license.
  const calculateAvgMrrPerProject = () => {
    const mrr = calculateCurrentMRR();
    const projectCount = new Set(getCurrentlyActiveLicenseItems().map(i => i.project_id)).size;
    return { mrr, projectCount, avg: projectCount > 0 ? mrr / projectCount : 0 };
  };

  // Count of pending invoices (raised but not yet received) grouped by project.
  const calculatePendingInvoices = () => {
    const byProject = projects
      .map(project => ({
        project,
        count: billableItems.filter(
          item => item.project_id === project.id && item.status === 'RAISED'
        ).length,
      }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count);
    const total = byProject.reduce((sum, entry) => sum + entry.count, 0);
    return { total, byProject };
  };

  // Calculate Average Invoice Collection Time
  const calculateAvgCollectionTime = () => {
    // Get all items that were received and have both invoice_date and payment_date
    const completedInvoices = getDateFilteredItems(billableItems).filter(item => 
      item.status === 'RECEIVED' &&
      item.invoice_date &&
      item.payment_date
    );

    if (completedInvoices.length === 0) return 0;

    // Calculate the total days between invoice date and payment date
    const totalDays = completedInvoices.reduce((sum, item) => {
      const invoiceDate = new Date(item.invoice_date!);
      const paymentDate = new Date(item.payment_date!);
      return sum + (paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24);
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

  // Calculate monthly one-time revenue
  const calculateMonthlyOneTimeRevenue = (year: number, month: number) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    return getFilteredBillableItems()
      .filter(item => 
        item.type === 'ONE_TIME' &&
        item.invoice_date &&
        new Date(item.invoice_date) >= start &&
        new Date(item.invoice_date) <= end &&
        ['RAISED', 'RECEIVED'].includes(item.status)
      )
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Calculate monthly others revenue
  const calculateMonthlyOthersRevenue = (year: number, month: number) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    return getFilteredBillableItems()
      .filter(item => 
        item.type === 'OTHERS' &&
        item.invoice_date &&
        new Date(item.invoice_date) >= start &&
        new Date(item.invoice_date) <= end &&
        ['RAISED', 'RECEIVED'].includes(item.status)
      )
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Get monthly revenue based on type
  const getMonthlyRevenue = (type: RevenueType, year: number, month: number) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    switch (type) {
      case 'MRR':
        // Get all license items that were active in this month and respect the date filter
        const licenseItems = getFilteredBillableItems()
          .filter(item => {
            const isLicense = item.type === 'LICENSE';
            const startDateValid = new Date(item.start_date) <= end;
            // End date should be null or after the end of the month
            const endDateValid = !item.end_date || new Date(item.end_date) > end;
            const statusValid = ['RAISED', 'RECEIVED'].includes(item.status);
            
            return isLicense && startDateValid && endDateValid && statusValid;
          });

        // Calculate MRR based on billing frequency
        const mrrDetails = licenseItems.map(item => {
          let monthlyAmount = 0;
          
          switch (item.billing_frequency) {
            case 'MONTHLY':
              monthlyAmount = item.amount;
              break;
            case 'QUARTERLY':
              monthlyAmount = item.amount / 3;
              break;
            case 'HALF_YEARLY':
              monthlyAmount = item.amount / 6;
              break;
            case 'YEARLY':
              monthlyAmount = item.amount / 12;
              break;
            case 'CUSTOM':
              if (item.custom_interval_days) {
                monthlyAmount = (item.amount * 30) / item.custom_interval_days;
              }
              break;
            default:
              monthlyAmount = item.amount;
          }

          return {
            name: item.name,
            amount: item.amount,
            frequency: item.billing_frequency || 'DEFAULT',
            monthlyAmount
          };
        });

        mrrDetails.forEach(detail => {
        });

        const totalMRR = mrrDetails.reduce((sum, detail) => sum + detail.monthlyAmount, 0);
        return totalMRR;

      case 'ONE_TIME':
        const oneTimeItems = getFilteredBillableItems()
          .filter(item => 
            item.type === 'ONE_TIME' &&
            item.invoice_date &&
            new Date(item.invoice_date) >= start &&
            new Date(item.invoice_date) <= end &&
            ['RAISED', 'RECEIVED'].includes(item.status)
          );
        
        const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.amount, 0);
        console.log(`\nOne-time revenue items: ${oneTimeItems.length}`);
        oneTimeItems.forEach(item => console.log(`${item.name}: ${item.amount}`));
        console.log(`Total one-time revenue: ${oneTimeTotal.toFixed(2)}`);
        return oneTimeTotal;

      case 'OTHERS':
        const otherItems = getFilteredBillableItems()
          .filter(item => 
            item.type === 'OTHERS' &&
            item.invoice_date &&
            new Date(item.invoice_date) >= start &&
            new Date(item.invoice_date) <= end &&
            ['RAISED', 'RECEIVED'].includes(item.status)
          );
        
        const othersTotal = otherItems.reduce((sum, item) => sum + item.amount, 0);
        console.log(`\nOther revenue items: ${otherItems.length}`);
        otherItems.forEach(item => console.log(`${item.name}: ${item.amount}`));
        console.log(`Total other revenue: ${othersTotal.toFixed(2)}`);
        return othersTotal;

      default:
        return 0;
    }
  };

  // Get months for the graph based on date filter
  const getMonthsForGraph = () => {
    const months = [];
    const start = new Date(dateFilter.startDate);
    const end = new Date(dateFilter.endDate);
    
    let current = new Date(start);
    while (current <= end) {
      months.push({
        label: current.toLocaleString('default', { month: 'short' }),
        year: current.getFullYear(),
        month: current.getMonth()
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  // Handle date filter change
  const handleTeamDateFilterChange = (type: 'fy' | 'quarter' | 'month' | 'custom', customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'fy':
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const fyStartYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
        startDate = new Date(Date.UTC(fyStartYear, 3, 1)); // April 1st
        endDate = new Date(Date.UTC(fyStartYear + 1, 2, 31)); // March 31st
        break;
      case 'quarter':
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(Date.UTC(now.getFullYear(), quarterStartMonth, 1));
        endDate = new Date(Date.UTC(now.getFullYear(), quarterStartMonth + 3, 0));
        break;
      case 'month':
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case 'custom':
        if (customStart && customEnd) {
          // Create dates without modifying the timezone
          startDate = new Date(customStart);
          startDate.setHours(0, 0, 0, 0);
          
          endDate = new Date(customEnd);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // When switching to custom without dates, use current month as default
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        return;
    }

    setTeamDateFilter({ type, startDate, endDate });
    setCurrentPage(0); // Reset to first page when filter changes
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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
              value={startInput}
              onChange={(e) => handleDateInputChange(e.target.value, true)}
            />
            <span className="mx-2">to</span>
            <input
              type="date"
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              value={endInput}
              onChange={(e) => handleDateInputChange(e.target.value, false)}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {showRevenue && (<>
        {/* 1. Total Revenue */}
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

        {/* 2. One-time Revenue */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 shadow-sm ring-1 ring-purple-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-purple-400">
            <CreditCard size={24} />
          </div>
          <h3 className="text-sm font-medium text-purple-600">One-time Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateOnetimeRevenue().raised + calculateOnetimeRevenue().received)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700">Raised</span>
              <span className="text-sm font-medium text-purple-800">{formatCurrency(calculateOnetimeRevenue().raised)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700">Received</span>
              <span className="text-sm font-medium text-purple-800">{formatCurrency(calculateOnetimeRevenue().received)}</span>
            </div>
          </div>
        </div>

        {/* 3. Annual Recurring Revenue */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-sm ring-1 ring-emerald-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-emerald-400">
            <BadgeDollarSign size={24} />
          </div>
          <h3 className="text-sm font-medium text-emerald-600">Annual Recurring Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateCurrentMRR() * 12)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-700">MRR</span>
              <span className="text-sm font-medium text-emerald-800">{formatCurrency(calculateCurrentMRR())}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-700">Annualized</span>
              <span className="text-sm font-medium text-emerald-800">MRR × 12</span>
            </div>
          </div>
        </div>

        {/* 4. Monthly Recurring Revenue */}
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

        {/* Projected Annual Revenue */}
        <div className="bg-gradient-to-br from-violet-50 to-violet-100 shadow-sm ring-1 ring-violet-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-violet-400">
            <TrendingUp size={24} />
          </div>
          <h3 className="text-sm font-medium text-violet-600">Projected Revenue (FY)</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateProjectedRevenue().projected)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-violet-700">Recurring (prorated)</span>
              <span className="text-sm font-medium text-violet-800">{formatCurrency(calculateProjectedRevenue().annualRecurring)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-violet-700">One-time (avg/mo×12)</span>
              <span className="text-sm font-medium text-violet-800">{formatCurrency(calculateProjectedRevenue().annualOneTime)}</span>
            </div>
          </div>
        </div>
        </>)}

        {showReceivables && (<>
        {/* 5. Outstanding Amount */}
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

        {/* 7. Pending Invoices (awaiting payment) by project */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 shadow-sm ring-1 ring-rose-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-rose-400">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-medium text-rose-600">Pending Invoices</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {calculatePendingInvoices().total}
          </p>
          <div className="mt-4 space-y-2">
            {calculatePendingInvoices().byProject.length > 0 ? (
              calculatePendingInvoices().byProject.slice(0, 4).map(({ project, count }) => (
                <div key={project.id} className="flex items-center justify-between">
                  <span className="text-sm text-rose-700 truncate max-w-[150px]">{project.name}</span>
                  <span className="text-sm font-semibold text-rose-900">{count}</span>
                </div>
              ))
            ) : (
              <span className="text-sm text-rose-700">All settled — none awaiting payment</span>
            )}
          </div>
        </div>
        </>)}

        {showRevenue && (<>
        {/* 8. Average MRR per Client (average ticket size) */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-100 shadow-sm ring-1 ring-sky-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-sky-400">
            <Users size={24} />
          </div>
          <h3 className="text-sm font-medium text-sky-600">Avg. MRR / Project</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(calculateAvgMrrPerProject().avg)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sky-700">Total MRR</span>
              <span className="text-sm font-medium text-sky-800">{formatCurrency(calculateAvgMrrPerProject().mrr)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-sky-700">Recurring projects</span>
              <span className="text-sm font-medium text-sky-800">{calculateAvgMrrPerProject().projectCount}</span>
            </div>
          </div>
        </div>
        </>)}
      </div>

      {/* Next due license invoices — actionable */}
      {showReceivables && (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Next Due Invoices</h2>
        <NextDueInvoices projects={projects} clients={clients} billableItems={billableItems} />
      </div>
      )}

      {/* Accounts receivable aging */}
      {showReceivables && (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Accounts Receivable</h2>
        <ReceivablesAging projects={projects} clients={clients} billableItems={billableItems} />
      </div>
      )}

      {/* License invoicing & payments Gantt */}
      {showLicenses && (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">License Projects — Invoicing &amp; Payments</h2>
        <LicenseGantt projects={projects} clients={clients} billableItems={billableItems} />
      </div>
      )}

      {/* One-time invoicing & payments chart */}
      {showRevenue && (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">One-Time Revenue — Invoicing &amp; Payments</h2>
        <OneTimeChart projects={projects} clients={clients} billableItems={billableItems} />
      </div>
      )}

    </div>
  );
};

export default Dashboard;
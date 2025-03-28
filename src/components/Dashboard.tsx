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
import { getBillableItems, getClients, getProjects } from '../lib/storage';
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
  const [selectedRevenueType, setSelectedRevenueType] = useState<RevenueType>('MRR');

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
        startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        endDate.setUTCHours(23, 59, 59, 999);
    }

    setDateFilter({ type, startDate, endDate });
  };

  // Update the date input handlers to use UTC
  const handleDateInputChange = (date: string, isStart: boolean) => {
    const [year, month, day] = date.split('-').map(Number);
    const newDate = new Date(Date.UTC(year, month - 1, day));
    
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
    switch (type) {
      case 'MRR':
        return calculateMonthlyMRR(billableItems, year, month);
      case 'ONE_TIME':
        return calculateMonthlyOneTimeRevenue(year, month);
      case 'OTHERS':
        return calculateMonthlyOthersRevenue(year, month);
      default:
        return 0;
    }
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
              value={dateFilter.startDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateInputChange(e.target.value, true)}
            />
            <span className="mx-2">to</span>
            <input
              type="date"
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              value={dateFilter.endDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateInputChange(e.target.value, false)}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            {formatCurrency(calculateLicenseRevenue().raised + calculateLicenseRevenue().received)}
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-700">Raised</span>
              <span className="text-sm font-medium text-emerald-800">{formatCurrency(calculateLicenseRevenue().raised)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-700">Received</span>
              <span className="text-sm font-medium text-emerald-800">{formatCurrency(calculateLicenseRevenue().received)}</span>
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

        {/* 6. Net Revenue Run Rate */}
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

        {/* 7. Average Collection Time */}
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

        {/* 8. Top Customers */}
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 shadow-sm ring-1 ring-teal-200 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 mt-4 mr-4 text-teal-400">
            <Building2 size={24} />
          </div>
          <h3 className="text-sm font-medium text-teal-600">Top Customers</h3>
          <div className="mt-6">
            {calculateTopCustomers().map((item, index) => (
              <div 
                key={`${item.client.id}-${index}`}
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

        {/* MRR Graph */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6 mb-6">
          <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Revenue Trend (FY 2024-25)</h3>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSelectedRevenueType('MRR')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedRevenueType === 'MRR'
                      ? 'bg-indigo-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  MRR
                </button>
                <button
                  onClick={() => setSelectedRevenueType('ONE_TIME')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedRevenueType === 'ONE_TIME'
                      ? 'bg-purple-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  One Time
                </button>
                <button
                  onClick={() => setSelectedRevenueType('OTHERS')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedRevenueType === 'OTHERS'
                      ? 'bg-teal-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Others
                </button>
              </div>
            </div>
            <div className="h-80">
              {selectedRevenueType === 'ONE_TIME' ? (
                <Bar
                  data={{
                    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                    datasets: [
                      {
                        label: selectedRevenueType,
                        data: Array.from({ length: 12 }, (_, i) => {
                          const year = 2024;
                          const month = i + 3; // Convert to actual month (0-11)
                          return getMonthlyRevenue(selectedRevenueType, year, month);
                        }),
                        backgroundColor: 'rgba(147, 51, 234, 0.8)',
                        borderColor: 'rgb(147, 51, 234)',
                        borderWidth: 1,
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
                          label: (context) => `${selectedRevenueType}: ₹${context.parsed.y.toLocaleString('en-IN')}`
                        }
                      },
                      title: {
                        display: true,
                        text: 'One Time Revenue Trend'
                      }
                    }
                  }}
                />
              ) : (
              <Line
                data={{
                  labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                  datasets: [
                    {
                      label: selectedRevenueType,
                      data: Array.from({ length: 12 }, (_, i) => {
                        const year = 2024;
                        const month = i + 3; // Convert to actual month (0-11)
                        return getMonthlyRevenue(selectedRevenueType, year, month);
                      }),
                      borderColor: selectedRevenueType === 'MRR' 
                        ? 'rgb(79, 70, 229)' 
                          : 'rgb(20, 184, 166)',
                      backgroundColor: selectedRevenueType === 'MRR'
                        ? 'rgba(79, 70, 229, 0.1)'
                          : 'rgba(20, 184, 166, 0.1)',
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
                        label: (context) => `${selectedRevenueType}: ₹${context.parsed.y.toLocaleString('en-IN')}`
                      }
                    },
                    title: {
                      display: true,
                        text: `${selectedRevenueType === 'MRR' ? 'Monthly Recurring Revenue' : 'Other Revenue'} Trend`
                    }
                  }
                }}
              />
              )}
            </div>
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
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Next Renewal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects
                  .map(project => {
                    const projectMRR = calculateProjectMRR(billableItems, project.id);
                    
                    // Get all LICENSE items for this project
                    const licenseItems = billableItems.filter(item => 
                      item.type === 'LICENSE' &&
                      item.project_id === project.id &&
                      ['RAISED', 'RECEIVED'].includes(item.status)
                    );
                    
                    // Find the latest end date
                    const latestEndDate = licenseItems.length > 0 
                      ? Math.max(...licenseItems.map(item => new Date(item.end_date).getTime()))
                      : null;
                    
                    // Calculate days until renewal
                    const today = new Date();
                    const daysUntilRenewal = latestEndDate 
                      ? Math.ceil((latestEndDate - today.getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    // Debug logging for ICICI projects
                    if (project.name.includes('ICICI')) {
                      console.log('Project:', project.name);
                      console.log('Project ID:', project.id);
                      console.log('MRR:', projectMRR);
                      console.log('Latest End Date:', new Date(latestEndDate!).toISOString());
                      console.log('Days Until Renewal:', daysUntilRenewal);
                      console.log('License Items:', licenseItems);
                    }

                    return {
                      project,
                      mrr: projectMRR,
                      daysUntilRenewal
                    };
                  })
                  .filter(({ mrr }) => mrr > 0) // Remove projects with zero MRR
                  .sort((a, b) => b.mrr - a.mrr)
                  .slice(0, 10)
                  .map(({ project, mrr, daysUntilRenewal }) => {
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            daysUntilRenewal === null ? 'bg-gray-100 text-gray-800' :
                            daysUntilRenewal < 0 ? 'bg-red-100 text-red-800' :
                            daysUntilRenewal <= 30 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {daysUntilRenewal === null ? 'No License' :
                             daysUntilRenewal < 0 ? 'Expired' :
                             `${daysUntilRenewal} days`}
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Team-wise Revenue</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <select
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  value={teamDateFilter.type}
                  onChange={(e) => handleTeamDateFilterChange(e.target.value as 'fy' | 'quarter' | 'month' | 'custom')}
                >
                  <option value="fy">Current FY</option>
                  <option value="quarter">Current Quarter</option>
                  <option value="month">Current Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                <div className="relative">
                  <button
                    onClick={() => setShowDepartmentDropdown(prev => !prev)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center gap-2"
                  >
                    {selectedDepartments.length === 0 ? 'All Departments' : `${selectedDepartments.length} Selected`}
                    <ChevronDown size={16} className={`transform transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showDepartmentDropdown && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                      <div className="py-1">
                        <label className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            checked={selectedDepartments.length === 0}
                            onChange={() => {
                              setSelectedDepartments([]);
                              setCurrentPage(0);
                            }}
                          />
                          <span className="ml-2">All</span>
                        </label>
                        {['Sales', 'Operations', 'CX'].map(dept => (
                          <label key={dept} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={selectedDepartments.includes(dept)}
                              onChange={() => {
                                setSelectedDepartments(prev => {
                                  const newSelection = prev.includes(dept)
                                    ? prev.filter(d => d !== dept)
                                    : [...prev, dept];
                                  return newSelection;
                                });
                                setCurrentPage(0);
                              }}
                            />
                            <span className="ml-2">{dept}</span>
                          </label>
                ))}
            </div>
                    </div>
                  )}
                    </div>
                {teamDateFilter.type === 'custom' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">From:</span>
                      <input
                        type="date"
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                        value={teamDateFilter.startDate.toISOString().split('T')[0]}
                        onChange={(e) => handleTeamDateFilterChange('custom', new Date(e.target.value), teamDateFilter.endDate)}
                      />
                  </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">To:</span>
                      <input
                        type="date"
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                        value={teamDateFilter.endDate.toISOString().split('T')[0]}
                        onChange={(e) => handleTeamDateFilterChange('custom', teamDateFilter.startDate, new Date(e.target.value))}
                      />
            </div>
                    </div>
                )}
                    </div>
                  </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th 
                    className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('department')}
                  >
                    Department {sortField === 'department' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('license')}
                  >
                    License {sortField === 'license' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('onetime')}
                  >
                    One Time {sortField === 'onetime' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedEmployees.map((employee) => (
                  <tr key={`${employee.name}-${employee.department}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {employee.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.department === 'Sales' 
                          ? 'bg-blue-100 text-blue-800'
                          : employee.department === 'Operations'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                      }`}>
                        {employee.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(employee.licenseAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(employee.oneTimeAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(employee.licenseAmount + employee.oneTimeAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-end mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Page {currentPage + 1} of {Math.ceil(employeeStats.length / itemsPerPage)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="p-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(employeeStats.length / itemsPerPage) - 1, prev + 1))}
                disabled={currentPage >= Math.ceil(employeeStats.length / itemsPerPage) - 1}
                className="p-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
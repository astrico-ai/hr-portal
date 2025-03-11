export const getFinancialYearDates = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // JavaScript months are 0-based

  // If current month is January to March (1-3), we're in previous year's financial year
  const financialYearStart = new Date(
    currentMonth <= 3 ? currentYear - 1 : currentYear, 
    3, // April (0-based, so 3 = April)
    1
  );
  
  const financialYearEnd = new Date(
    currentMonth <= 3 ? currentYear : currentYear + 1,
    2, // March (0-based, so 2 = March)
    31
  );

  return { start: financialYearStart, end: financialYearEnd };
};

export const getCurrentQuarter = () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  
  // Financial year quarters
  // Q1: Apr-Jun (4-6)
  // Q2: Jul-Sep (7-9)
  // Q3: Oct-Dec (10-12)
  // Q4: Jan-Mar (1-3)
  
  let quarterStart: Date;
  let quarterEnd: Date;
  
  if (month >= 4 && month <= 6) {
    // Q1
    quarterStart = new Date(year, 3, 1);
    quarterEnd = new Date(year, 5, 30);
  } else if (month >= 7 && month <= 9) {
    // Q2
    quarterStart = new Date(year, 6, 1);
    quarterEnd = new Date(year, 8, 30);
  } else if (month >= 10 && month <= 12) {
    // Q3
    quarterStart = new Date(year, 9, 1);
    quarterEnd = new Date(year, 11, 31);
  } else {
    // Q4 (Jan-Mar)
    quarterStart = new Date(year, 0, 1);
    quarterEnd = new Date(year, 2, 31);
  }

  return { start: quarterStart, end: quarterEnd };
};

export const getLastSixMonths = () => {
  const today = new Date();
  const months: { start: Date; end: Date; label: string }[] = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const label = start.toLocaleString('default', { month: 'short', year: 'numeric' });
    months.push({ start, end, label });
  }

  return months;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}; 
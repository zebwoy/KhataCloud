import { useState, useEffect, useRef } from 'react';
import { trackAction } from '../lib/trailTracker';
import { Download, Calendar, TrendingUp, TrendingDown, Printer, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import type { Transaction, TrusteeOption, Theme } from '../types';
import type { Stats } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { type DateFilterMode, type DateRange } from '../utils/constants';
import ExportOptionsModal from './ExportOptionsModal';
import AnalyticsPanel from './AnalyticsPanel';
import type { NoticeboardConfig } from '../../api/org-config';

interface FinancialReportsProps {
  filteredTransactions: Transaction[];
  dateFilterMode: DateFilterMode;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  setDateFilterMode: (mode: DateFilterMode) => void;
  isLoadingData: boolean;
  theme: Theme;
  stats: Stats;
  previousPeriodStats: Stats;
  previousRange: DateRange | null;
  trusteeFilter: string;
  setTrusteeFilter: (filter: string) => void;
  trusteeOptions: TrusteeOption[];
  getPrimaryButtonClasses: (isActive?: boolean) => string;
  formatPeriodLabel: () => string;
  formatPreviousPeriodLabel: () => string;
  handleQuickFilter: (mode: DateFilterMode) => void;
  exportToCSV?: () => void;
  orgConfig: NoticeboardConfig;
}

const MONTHS = [
  { name: 'January', short: 'Jan', index: 0 },
  { name: 'February', short: 'Feb', index: 1 },
  { name: 'March', short: 'Mar', index: 2 },
  { name: 'April', short: 'Apr', index: 3 },
  { name: 'May', short: 'May', index: 4 },
  { name: 'June', short: 'Jun', index: 5 },
  { name: 'July', short: 'Jul', index: 6 },
  { name: 'August', short: 'Aug', index: 7 },
  { name: 'September', short: 'Sep', index: 8 },
  { name: 'October', short: 'Oct', index: 9 },
  { name: 'November', short: 'Nov', index: 10 },
  { name: 'December', short: 'Dec', index: 11 },
];

export default function FinancialReports({
  filteredTransactions,
  dateFilterMode,
  dateRange,
  setDateRange,
  setDateFilterMode,
  isLoadingData,
  theme,
  stats,
  previousPeriodStats,
  previousRange,
  trusteeFilter,
  setTrusteeFilter,
  trusteeOptions,
  getPrimaryButtonClasses,
  formatPeriodLabel,
  formatPreviousPeriodLabel,
  handleQuickFilter,
  orgConfig,
}: FinancialReportsProps) {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  
  // Month dropdown state
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => {
    if (dateRange.fromDate) {
      const parsedYear = parseInt(dateRange.fromDate.split('-')[0], 10);
      if (!isNaN(parsedYear)) return parsedYear;
    }
    return new Date().getFullYear();
  });
  const monthDropdownRef = useRef<HTMLDivElement | null>(null);

  // Flatpickr range input ref
  const flatpickrInputRef = useRef<HTMLInputElement | null>(null);
  const flatpickrInstance = useRef<flatpickr.Instance | null>(null);

  // Close month dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setMonthDropdownOpen(false);
      }
    };
    if (monthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [monthDropdownOpen]);

  // Initialize Flatpickr in range mode
  useEffect(() => {
    if (!flatpickrInputRef.current) return;

    const fp = flatpickr(flatpickrInputRef.current, {
      mode: "range",
      dateFormat: "Y-m-d",
      defaultDate: dateRange.fromDate && dateRange.toDate ? [dateRange.fromDate, dateRange.toDate] : undefined,
      onClose: (selectedDates) => {
        if (selectedDates.length === 2) {
          const start = fp.formatDate(selectedDates[0], "Y-m-d");
          const end = fp.formatDate(selectedDates[1], "Y-m-d");
          setDateRange({ fromDate: start, toDate: end });
          setDateFilterMode('custom');
        } else if (selectedDates.length === 1) {
          const single = fp.formatDate(selectedDates[0], "Y-m-d");
          setDateRange({ fromDate: single, toDate: single });
          setDateFilterMode('custom');
        }
      },
    });

    flatpickrInstance.current = fp;

    return () => {
      fp.destroy();
    };
  }, [setDateRange, setDateFilterMode]);

  // Sync external dateRange changes into Flatpickr
  useEffect(() => {
    if (flatpickrInstance.current) {
      if (dateFilterMode === 'custom' && dateRange.fromDate && dateRange.toDate) {
        flatpickrInstance.current.setDate([dateRange.fromDate, dateRange.toDate], false);
      } else if (dateFilterMode !== 'custom') {
        flatpickrInstance.current.clear(false);
      }
    }
  }, [dateRange, dateFilterMode]);

  // Handle selecting a specific month
  const handleSelectMonth = (monthIndex: number) => {
    const firstDay = new Date(pickerYear, monthIndex, 1);
    const lastDay = new Date(pickerYear, monthIndex + 1, 0);

    const fromYearStr = String(firstDay.getFullYear());
    const fromMonthStr = String(firstDay.getMonth() + 1).padStart(2, '0');
    const toYearStr = String(lastDay.getFullYear());
    const toMonthStr = String(lastDay.getMonth() + 1).padStart(2, '0');
    const toDayStr = String(lastDay.getDate()).padStart(2, '0');

    const fromDate = `${fromYearStr}-${fromMonthStr}-01`;
    const toDate = `${toYearStr}-${toMonthStr}-${toDayStr}`;

    setDateRange({ fromDate, toDate });
    setDateFilterMode('selectedMonth');
    setMonthDropdownOpen(false);
  };

  // Helper to format the active selected month label
  const getSelectedMonthButtonText = () => {
    if (dateFilterMode === 'selectedMonth' && dateRange.fromDate) {
      const parts = dateRange.fromDate.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = new Date(y, m, 1);
        return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      }
    }
    return 'Select Month';
  };

  const getTrendData = () => {
    const groups: Record<string, { interval: string; sortKey: string; income: number; expense: number }> = {};
    
    let isDaily = false;
    if (dateFilterMode === 'thisMonth' || dateFilterMode === 'selectedMonth') {
      isDaily = true;
    } else if (dateFilterMode === 'custom' && dateRange.fromDate && dateRange.toDate) {
      const start = new Date(dateRange.fromDate);
      const end = new Date(dateRange.toDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 31) {
        isDaily = true;
      }
    }

    filteredTransactions.forEach((t) => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      
      let key = '';
      let sortKey = '';
      if (isDaily) {
        key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        sortKey = t.date;
      } else {
        key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        sortKey = t.date.substring(0, 7);
      }
      
      if (!groups[key]) {
        groups[key] = { interval: key, sortKey, income: 0, expense: 0 };
      }
      
      const amt = Number(t.amount) || 0;
      if (t.category === 'Income') {
        groups[key].income += amt;
      } else if (t.category === 'Expense') {
        groups[key].expense += amt;
      }
    });

    return Object.values(groups).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  };



  return (
    <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Report</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} 
            {dateFilterMode !== 'allTime' ? ' for selected period' : ' (all time)'}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => { trackAction('action:print-report'); window.print(); }}
            className="bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-sm font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Printer size={18} /> Print Report
          </button>
          <button
            onClick={() => { trackAction('action:export-report'); setExportModalOpen(true); }}
            className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600 text-sm font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Download size={18} /> Export Report
          </button>
        </div>
      </div>

      <ExportOptionsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        transactions={filteredTransactions}
        isAdmin={true}
        filenamePrefix={`Financial_Report_${dateFilterMode}`}
        activeFiltersContext={{
          dateRange: formatPeriodLabel(),
          custodians: trusteeFilter ? [trusteeFilter] : undefined,
        }}
        orgName="KhataCloud"
      />
      {isLoadingData && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Refreshing data from the server...</p>
      )}

      {/* Date Range Filter */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)]">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Period</p>
        
        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => handleQuickFilter('thisMonth')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              dateFilterMode === 'thisMonth'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-700 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            This Month
          </button>

          {/* Select Month Dropdown */}
          <div className="relative" ref={monthDropdownRef}>
            <button
              id="btn-select-month-dropdown"
              type="button"
              onClick={() => setMonthDropdownOpen(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                dateFilterMode === 'selectedMonth'
                  ? (theme.mode === 'dark' 
                      ? 'bg-gray-700 text-white shadow-sm' 
                      : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                         theme.palette === 'blue' ? 'bg-blue-600' :
                         theme.palette === 'purple' ? 'bg-purple-600' :
                         theme.palette === 'emerald' ? 'bg-emerald-600' :
                         'bg-rose-600') + ' text-white shadow-sm')
                  : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
              }`}
            >
              <Calendar size={14} />
              <span>{getSelectedMonthButtonText()}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${monthDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Popover */}
            {monthDropdownOpen && (
              <div className="absolute left-0 mt-2 z-50 w-64 p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl dark:shadow-[0_20px_40px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150">
                {/* Year Header with Previous / Next */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPickerYear(y => y - 1)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition-colors"
                    title="Previous Year"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {pickerYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerYear(y => y + 1)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition-colors"
                    title="Next Year"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* 12 Months Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTHS.map((m) => {
                    const isSelected = dateFilterMode === 'selectedMonth' && 
                      dateRange.fromDate.startsWith(`${pickerYear}-${String(m.index + 1).padStart(2, '0')}`);
                    const isCurrentRealMonth = new Date().getFullYear() === pickerYear && new Date().getMonth() === m.index;

                    return (
                      <button
                        key={m.index}
                        type="button"
                        onClick={() => handleSelectMonth(m.index)}
                        className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                            : isCurrentRealMonth
                            ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                        title={m.name}
                      >
                        {m.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => handleQuickFilter('thisQuarter')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              dateFilterMode === 'thisQuarter'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-700 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            This Quarter
          </button>
          <button
            onClick={() => handleQuickFilter('thisFiscalYear')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              dateFilterMode === 'thisFiscalYear'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-700 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            This Fiscal Year
          </button>
          <button
            onClick={() => handleQuickFilter('allTime')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              dateFilterMode === 'allTime'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-700 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            All Time
          </button>

          {/* Custom Range Button using Flatpickr */}
          <div className="relative inline-flex items-center">
            <input
              ref={flatpickrInputRef}
              type="text"
              aria-label="Custom Date Range Picker"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              title="Click to select custom date range"
            />
            <button
              type="button"
              tabIndex={-1}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 pointer-events-none transition-all ${
                dateFilterMode === 'custom'
                  ? (theme.mode === 'dark' 
                      ? 'bg-gray-700 text-white shadow-sm' 
                      : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                         theme.palette === 'blue' ? 'bg-blue-600' :
                         theme.palette === 'purple' ? 'bg-purple-600' :
                         theme.palette === 'emerald' ? 'bg-emerald-600' :
                         'bg-rose-600') + ' text-white shadow-sm')
                  : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
              }`}
            >
              <Calendar size={14} />
              <span>
                {dateFilterMode === 'custom' && dateRange.fromDate && dateRange.toDate
                  ? `${dateRange.fromDate} → ${dateRange.toDate}`
                  : 'Custom Range'}
              </span>
            </button>
          </div>
        </div>

        {/* Trustee Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setTrusteeFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${trusteeFilter === ''
                ? (theme.mode === 'dark'
                    ? 'bg-gray-700 text-white'
                    : getPrimaryButtonClasses() + ' text-white')
                : 'bg-white dark:bg-black text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
              }`}
          >
            All Trustees
          </button>
          {trusteeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTrusteeFilter(option.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${trusteeFilter === option.value
                  ? (theme.mode === 'dark'
                      ? 'bg-gray-700 text-white'
                      : getPrimaryButtonClasses() + ' text-white')
                  : 'bg-white dark:bg-black text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Display Selected Period */}
        {dateFilterMode !== 'allTime' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            Showing: {
              dateFilterMode === 'custom' 
                ? `${dateRange.fromDate} to ${dateRange.toDate}`
                : dateFilterMode === 'selectedMonth' && dateRange.fromDate
                ? (() => {
                    const parts = dateRange.fromDate.split('-');
                    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
                    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                  })()
                : dateFilterMode === 'thisMonth'
                ? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                : dateFilterMode === 'thisQuarter'
                ? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`
                : `FY ${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-${new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear()}`
            }
          </p>
        )}
      </div>

      {/* Surplus/Deficit Badge */}
      <div className="mb-6 flex justify-center">
        <div className={`px-8 py-4 rounded-lg shadow-2xl dark:shadow-[0_15px_35px_rgba(0,0,0,0.9)] transition-all duration-300 hover:scale-105 ${stats.balance >= 0
            ? 'bg-gradient-to-r from-green-500 to-green-600' 
            : 'bg-gradient-to-r from-red-500 to-red-600'
        } text-white`}>
          <div className="flex items-center gap-3">
            {stats.balance >= 0 ? (
              <TrendingUp size={32} />
            ) : (
              <TrendingDown size={32} />
            )}
            <div>
              <p className="text-lg font-semibold">
                {stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT'}
              </p>
              <p className="text-3xl font-bold">
                ₹{Math.abs(stats.balance).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Inflow/Outflow Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border-l-4 border-green-600 dark:border-green-700 shadow-lg dark:shadow-[0_10px_25px_rgba(34,197,94,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(34,197,94,0.3)] transition-all duration-300 hover:-translate-y-1">
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Total Inflow</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.income)}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Income for selected period</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border-l-4 border-red-600 dark:border-red-700 shadow-lg dark:shadow-[0_10px_25px_rgba(239,68,68,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(239,68,68,0.3)] transition-all duration-300 hover:-translate-y-1">
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Total Outflow</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.expenses)}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Expenses for selected period</p>
        </div>
        <div className={`${stats.balance >= 0 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-700 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(37,99,235,0.3)]' 
          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-600 dark:border-orange-700 shadow-lg dark:shadow-[0_10px_25px_rgba(249,115,22,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(249,115,22,0.3)]'
        } rounded-lg p-6 border-l-4 transition-all duration-300 hover:-translate-y-1`}>
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Net Position</p>
          <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {formatCurrency(stats.balance)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Inflow - Outflow</p>
        </div>
      </div>

      {/* Visual Analytics Chart */}
      {filteredTransactions.length > 0 && (
        <div className="mb-6 p-6 bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">Income & Expense Trends</h3>
          
          <div className="flex gap-4 mb-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">Total Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">Total Expense</span>
            </div>
          </div>

          {(() => {
            const trendData = getTrendData();
            if (trendData.length === 0) {
              return <p className="text-xs text-gray-500 text-center py-8">No transaction data available for trend chart.</p>;
            }
            
            const maxVal = Math.max(...trendData.map(d => Math.max(d.income, d.expense)), 1000);
            
            const svgWidth = 600;
            const svgHeight = 200;
            const paddingLeft = 50;
            const paddingRight = 20;
            const paddingTop = 10;
            const paddingBottom = 30;
            
            const chartWidth = svgWidth - paddingLeft - paddingRight;
            const chartHeight = svgHeight - paddingTop - paddingBottom;
            const colWidth = chartWidth / trendData.length;
            const barWidth = Math.max(colWidth * 0.35, 6);
            const gap = colWidth * 0.08;
            
            const gridLines = [0, 0.25, 0.5, 0.75, 1];

            return (
              <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[500px] h-[200px]">
                  {gridLines.map((ratio, idx) => {
                    const y = paddingTop + chartHeight * (1 - ratio);
                    const val = Math.round(maxVal * ratio);
                    return (
                      <g key={idx} className="opacity-40 dark:opacity-20">
                        <line 
                          x1={paddingLeft} 
                          y1={y} 
                          x2={svgWidth - paddingRight} 
                          y2={y} 
                          stroke="currentColor" 
                          strokeWidth="1" 
                          strokeDasharray="4 4"
                          className="text-gray-400"
                        />
                        <text 
                          x={paddingLeft - 8} 
                          y={y + 4} 
                          textAnchor="end" 
                          className="text-[9px] fill-gray-500 dark:fill-gray-400 font-medium"
                        >
                          {val >= 1000 ? `â‚¹${(val / 1000).toFixed(0)}k` : `â‚¹${val}`}
                        </text>
                      </g>
                    );
                  })}

                  {trendData.map((item, idx) => {
                    const xPos = paddingLeft + idx * colWidth;
                    const incomeHeight = (item.income / maxVal) * chartHeight;
                    const expenseHeight = (item.expense / maxVal) * chartHeight;
                    
                    return (
                      <g key={idx}>
                        {item.income > 0 && (
                          <rect 
                            x={xPos + gap} 
                            y={paddingTop + chartHeight - incomeHeight} 
                            width={barWidth} 
                            height={incomeHeight} 
                            fill="#22c55e" 
                            rx="2"
                            className="transition-all duration-300 hover:fill-green-400"
                          >
                            <title>{`${item.interval} - Income: â‚¹${item.income.toLocaleString()}`}</title>
                          </rect>
                        )}
                        {item.expense > 0 && (
                          <rect 
                            x={xPos + gap + barWidth + gap} 
                            y={paddingTop + chartHeight - expenseHeight} 
                            width={barWidth} 
                            height={expenseHeight} 
                            fill="#ef4444" 
                            rx="2"
                            className="transition-all duration-300 hover:fill-red-400"
                          >
                            <title>{`${item.interval} - Expense: â‚¹${item.expense.toLocaleString()}`}</title>
                          </rect>
                        )}
                        <text 
                          x={xPos + colWidth / 2} 
                          y={paddingTop + chartHeight + 16} 
                          textAnchor="middle" 
                          className="text-[9px] fill-gray-500 dark:fill-gray-400 font-semibold"
                        >
                          {item.interval}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}
        </div>
      )}

      {/* Period Comparison */}
      {previousRange && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)]">
          <h3 className="text-lg font-bold mb-4 text-blue-700 dark:text-blue-300">Period Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Current Period: {formatPeriodLabel()}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Income:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(stats.expenses)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                  <span className={`font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {formatCurrency(stats.balance)}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {formatPreviousPeriodLabel()}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Income:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(previousPeriodStats.income)}
                    {previousPeriodStats.income > 0 && (
                      <span className={`text-xs ml-2 ${stats.income > previousPeriodStats.income ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        ({stats.income > previousPeriodStats.income ? '+' : ''}
                        {((stats.income - previousPeriodStats.income) / previousPeriodStats.income * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(previousPeriodStats.expenses)}
                    {previousPeriodStats.expenses > 0 && (
                      <span className={`text-xs ml-2 ${stats.expenses < previousPeriodStats.expenses ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        ({stats.expenses < previousPeriodStats.expenses ? '' : '+'}
                        {((stats.expenses - previousPeriodStats.expenses) / previousPeriodStats.expenses * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                  <span className={`font-bold ${previousPeriodStats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {formatCurrency(previousPeriodStats.balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Panel â€” tabbed: Breakdown | Noticeboard */}
      <div className="mt-6">
        <AnalyticsPanel
          filteredTransactions={filteredTransactions}
          stats={stats}
          dateFilterMode={dateFilterMode}
          dateRange={dateRange}
          orgConfig={orgConfig}
          theme={theme}
        />
      </div>
    </div>
  );
}

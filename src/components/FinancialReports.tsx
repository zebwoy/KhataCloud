import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trackAction } from '../lib/trailTracker';
import { Download, Calendar, TrendingUp, TrendingDown, Printer, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
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

// ── Reports Floating Filter Drawer ──────────────────────────────────────────
interface ReportsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dateFilterMode: DateFilterMode;
  dateRange: DateRange;
  handleQuickFilter: (mode: DateFilterMode) => void;
  trusteeFilter: string;
  setTrusteeFilter: (filter: string) => void;
  trusteeOptions: TrusteeOption[];
  pickerYear: number;
  setPickerYear: React.Dispatch<React.SetStateAction<number>>;
  handleSelectMonth: (monthIndex: number) => void;
  flatpickrInputRef: React.RefObject<HTMLInputElement>;
}

function ReportsFilterDrawer({
  isOpen,
  onClose,
  dateFilterMode,
  dateRange,
  handleQuickFilter,
  trusteeFilter,
  setTrusteeFilter,
  trusteeOptions,
  pickerYear,
  setPickerYear,
  handleSelectMonth,
  flatpickrInputRef,
}: ReportsDrawerProps) {
  if (!isOpen) return null;

  const isFiltered = dateFilterMode !== 'thisMonth' || !!trusteeFilter;

  return createPortal(
    <>
      {/* Semi-transparent click guard */}
      <div
        className="fixed inset-0 z-40 pointer-events-auto bg-black/20 dark:bg-black/40 md:bg-transparent"
        onClick={onClose}
      />

      {/* Drawer card */}
      <div className="
        fixed z-40
        top-4 bottom-24 left-4 right-4
        md:top-24 md:bottom-6 md:right-6 md:left-auto
        md:w-[min(24rem,calc(100vw-2rem))]
        bg-white dark:bg-slate-900
        rounded-3xl border border-gray-200/80 dark:border-slate-800
        shadow-2xl shadow-black/25
        flex flex-col overflow-hidden
        animate-slide-in-right pointer-events-auto
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 dark:border-slate-800/80 shrink-0 bg-white/50 dark:bg-slate-900/50">
          <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <SlidersHorizontal size={17} />
            </div>
            Period &amp; Filters
          </h3>
          <div className="flex items-center gap-3">
            {isFiltered && (
              <button
                onClick={() => {
                  handleQuickFilter('thisMonth');
                  setTrusteeFilter('');
                }}
                className="text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline"
              >
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-5 p-6">
          
          {/* Quick Period Presets */}
          <section>
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
              Quick Period
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { mode: 'thisMonth' as const, label: 'This Month' },
                { mode: 'thisQuarter' as const, label: 'This Quarter' },
                { mode: 'thisFiscalYear' as const, label: 'This Fiscal Year' },
                { mode: 'allTime' as const, label: 'All Time' },
              ].map(({ mode, label }) => {
                const active = dateFilterMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleQuickFilter(mode)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      active
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-600/25'
                        : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Select Month Grid */}
          <section className="pt-2 border-t border-gray-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Select Month
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPickerYear(y => y - 1)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Previous Year"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs font-bold text-gray-900 dark:text-white px-1">
                  {pickerYear}
                </span>
                <button
                  type="button"
                  onClick={() => setPickerYear(y => y + 1)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Next Year"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((m) => {
                const isSelected = dateFilterMode === 'selectedMonth' &&
                  dateRange.fromDate.startsWith(`${pickerYear}-${String(m.index + 1).padStart(2, '0')}`);
                const isCurrentRealMonth = new Date().getFullYear() === pickerYear && new Date().getMonth() === m.index;

                return (
                  <button
                    key={m.index}
                    type="button"
                    onClick={() => handleSelectMonth(m.index)}
                    className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                        : isCurrentRealMonth
                        ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                    title={m.name}
                  >
                    {m.short}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Custom Date Range Picker */}
          <section className="pt-2 border-t border-gray-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Custom Range
            </h4>
            <div className="relative">
              <input
                ref={flatpickrInputRef}
                type="text"
                aria-label="Custom Date Range Picker"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                title="Click to select custom date range"
              />
              <div
                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                  dateFilterMode === 'custom'
                    ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                    : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-violet-500" />
                  <span>
                    {dateFilterMode === 'custom' && dateRange.fromDate && dateRange.toDate
                      ? `${dateRange.fromDate} → ${dateRange.toDate}`
                      : 'Choose Date Range…'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 uppercase">Select</span>
              </div>
            </div>
          </section>

          {/* Trustee / Custodian Filter */}
          <section className="pt-2 border-t border-gray-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
              Trustee / Custodian
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTrusteeFilter('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  trusteeFilter === ''
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                All Trustees
              </button>
              {trusteeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTrusteeFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    trusteeFilter === opt.value
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-600/30 active:scale-98"
          >
            Apply &amp; Close
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

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
  getPrimaryButtonClasses: _getPrimaryButtonClasses,
  formatPeriodLabel,
  formatPreviousPeriodLabel,
  handleQuickFilter,
  orgConfig,
}: FinancialReportsProps) {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  const [pickerYear, setPickerYear] = useState<number>(() => {
    if (dateRange.fromDate) {
      const parsedYear = parseInt(dateRange.fromDate.split('-')[0], 10);
      if (!isNaN(parsedYear)) return parsedYear;
    }
    return new Date().getFullYear();
  });

  // Sync pickerYear when dateRange.fromDate changes
  useEffect(() => {
    if (dateRange.fromDate) {
      const parsedYear = parseInt(dateRange.fromDate.split('-')[0], 10);
      if (!isNaN(parsedYear)) {
        setPickerYear(parsedYear);
      }
    }
  }, [dateRange.fromDate]);

  // Flatpickr range input ref
  const flatpickrInputRef = useRef<HTMLInputElement>(null);
  const flatpickrInstance = useRef<flatpickr.Instance | null>(null);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Report</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} 
            {dateFilterMode !== 'allTime' ? ' for selected period' : ' (all time)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
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

      {/* ── Active filter summary chips ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6 no-print">
        {/* Period Chip */}
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 font-medium">
          <Calendar size={12} />
          <span>Period: {formatPeriodLabel()}</span>
          {dateFilterMode !== 'thisMonth' && (
            <button
              type="button"
              onClick={() => handleQuickFilter('thisMonth')}
              title="Reset to This Month"
              className="hover:text-red-500 transition-colors ml-0.5"
            >
              <X size={12} />
            </button>
          )}
        </span>

        {/* Trustee Chip */}
        {trusteeFilter && (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium">
            <span>Trustee: {trusteeFilter}</span>
            <button
              type="button"
              onClick={() => setTrusteeFilter('')}
              title="Clear Trustee Filter"
              className="hover:text-red-500 transition-colors ml-0.5"
            >
              <X size={12} />
            </button>
          </span>
        )}

        {(dateFilterMode !== 'thisMonth' || !!trusteeFilter) && (
          <button
            type="button"
            onClick={() => {
              handleQuickFilter('thisMonth');
              setTrusteeFilter('');
            }}
            className="text-xs text-red-500 dark:text-red-400 font-medium hover:underline ml-1"
          >
            Clear all
          </button>
        )}
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

      {/* Floating Reports Filter Drawer */}
      <ReportsFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        dateFilterMode={dateFilterMode}
        dateRange={dateRange}
        handleQuickFilter={handleQuickFilter}
        trusteeFilter={trusteeFilter}
        setTrusteeFilter={setTrusteeFilter}
        trusteeOptions={trusteeOptions}
        pickerYear={pickerYear}
        setPickerYear={setPickerYear}
        handleSelectMonth={handleSelectMonth}
        flatpickrInputRef={flatpickrInputRef}
      />

      {/* ── Persistent Floating Filter & Period Trigger Pill ── */}
      {!filterDrawerOpen && createPortal(
        <button
          id="btn-floating-report-filters"
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          aria-label="Filter and Period Settings"
          title={`Current Period: ${formatPeriodLabel()}${trusteeFilter ? ` | Trustee: ${trusteeFilter}` : ''}. Click to change period or filter.`}
          className={`
            no-print fixed z-30
            bottom-24 left-4 md:left-auto md:right-20 md:bottom-8
            flex items-center gap-2.5 px-4 py-2.5 rounded-full
            bg-slate-900/90 hover:bg-slate-900 text-white
            border ${
              dateFilterMode !== 'thisMonth' || !!trusteeFilter
                ? 'border-violet-500/80 shadow-violet-950/60 ring-2 ring-violet-500/25'
                : 'border-white/20 shadow-black/40 hover:border-violet-400/50'
            }
            shadow-2xl backdrop-blur-xl
            transition-all duration-200 ease-out hover:scale-105 active:scale-95
            group cursor-pointer select-none
          `}
        >
          <div className="flex items-center justify-center p-1 rounded-full bg-violet-500/20 text-violet-300 group-hover:bg-violet-500/30 transition-colors">
            <SlidersHorizontal size={14} className="group-hover:rotate-12 transition-transform duration-200" />
          </div>

          <span className="text-xs font-bold tracking-tight text-white/95">
            Filter &amp; Period
          </span>

          <span className="w-px h-3.5 bg-white/20" />

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/25 text-violet-200 border border-violet-400/30 max-w-[140px] truncate">
            <Calendar size={11} className="shrink-0 text-violet-300" />
            <span className="truncate">{formatPeriodLabel()}</span>
          </span>

          {(dateFilterMode !== 'thisMonth' || !!trusteeFilter) && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
            </span>
          )}
        </button>,
        document.body
      )}

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

      {/* Analytics Panel — tabbed: Breakdown | Noticeboard */}
      <div className="mt-6">
        <AnalyticsPanel
          filteredTransactions={filteredTransactions}
          stats={stats}
          previousPeriodStats={previousPeriodStats}
          previousRange={previousRange}
          dateFilterMode={dateFilterMode}
          dateRange={dateRange}
          orgConfig={orgConfig}
          theme={theme}
        />
      </div>
    </div>
  );
}

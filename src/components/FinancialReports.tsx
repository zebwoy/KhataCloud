import { Download, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type { Transaction, TrusteeOption, Theme } from '../types';
import type { Stats } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { getCategoryBreakdown, getTransferTotal, getTrusteeLedger } from '../utils/calculations';
import { getDateRangeForMode, type DateFilterMode, type DateRange } from '../utils/constants';

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
  exportToCSV: () => void;
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
  getPrimaryButtonClasses,
  formatPeriodLabel,
  formatPreviousPeriodLabel,
  handleQuickFilter,
  exportToCSV,
}: FinancialReportsProps) {
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
        <button
          onClick={exportToCSV}
          className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600"
        >
          <Download size={18} /> Export Report
        </button>
      </div>
      {isLoadingData && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Refreshing data from the server...</p>
      )}

      {/* Date Range Filter */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)]">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Period</p>
        
        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleQuickFilter('thisMonth')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
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
          <button
            onClick={() => handleQuickFilter('thisQuarter')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
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
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
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
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
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
          <button
            onClick={() => {
              if (dateFilterMode !== 'custom') {
                // When switching to custom, preserve current range if available
                if (dateFilterMode !== 'allTime') {
                  const currentRange = getDateRangeForMode(dateFilterMode);
                  setDateRange(currentRange);
                }
              }
              setDateFilterMode('custom');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 ${
              dateFilterMode === 'custom'
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
            <Calendar size={14} /> Custom Range
          </button>
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

        {/* Custom Date Range Inputs */}
        {dateFilterMode === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">From Date</label>
              <DatePicker
                selected={dateRange.fromDate ? new Date(dateRange.fromDate) : null}
                onChange={(date: Date | null) => {
                  setDateRange({
                    ...dateRange,
                    fromDate: date ? date.toISOString().split('T')[0] : '',
                  });
                }}
                dateFormat="yyyy-MM-dd"
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                  theme.mode === 'dark' 
                    ? 'focus:ring-gray-700' 
                    : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                       theme.palette === 'blue' ? 'focus:ring-blue-500' :
                       theme.palette === 'purple' ? 'focus:ring-purple-500' :
                       theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                       'focus:ring-rose-500')
                } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                placeholderText="Select from date"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">To Date</label>
              <DatePicker
                selected={dateRange.toDate ? new Date(dateRange.toDate) : null}
                onChange={(date: Date | null) => {
                  setDateRange({
                    ...dateRange,
                    toDate: date ? date.toISOString().split('T')[0] : '',
                  });
                }}
                dateFormat="yyyy-MM-dd"
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                  theme.mode === 'dark' 
                    ? 'focus:ring-gray-700' 
                    : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                       theme.palette === 'blue' ? 'focus:ring-blue-500' :
                       theme.palette === 'purple' ? 'focus:ring-purple-500' :
                       theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                       'focus:ring-rose-500')
                } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                placeholderText="Select to date"
              />
            </div>
          </div>
        )}

        {/* Display Selected Period */}
        {dateFilterMode !== 'allTime' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            Showing: {
              dateFilterMode === 'custom' 
                ? `${dateRange.fromDate} to ${dateRange.toDate}`
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

      {/* Category-wise Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400 flex items-center gap-2">
            <TrendingUp size={20} /> Income Breakdown by Category
          </h3>
          {getCategoryBreakdown(filteredTransactions, 'Income').length > 0 ? (
            <div className="space-y-2">
              {getCategoryBreakdown(filteredTransactions, 'Income').map((item) => {
                const percentage = stats.income > 0 ? (item.total / stats.income * 100).toFixed(1) : 0;
                return (
                  <div key={item.sub} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(34,197,94,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(34,197,94,0.3)] transition-all duration-300">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                      <span className="font-bold text-green-600 dark:text-green-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                      <div 
                        className="bg-green-600 dark:bg-green-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentage}% of total income – {item.count} transaction{item.count !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-4">No income transactions in selected period</p>
          )}
        </div>

        <div>
           <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
            <TrendingDown size={20} /> Expense Breakdown by Category
          </h3>
          {getCategoryBreakdown(filteredTransactions, 'Expense').length > 0 ? (
            <div className="space-y-2">
               {getCategoryBreakdown(filteredTransactions, 'Expense').map((item) => {
                const percentage = stats.expenses > 0 ? (item.total / stats.expenses * 100).toFixed(1) : 0;
                return (
                    <div key={item.sub} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(239,68,68,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition-all duration-300">
                    <div className="flex justify-between items-center mb-1">
                       <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                       <span className="font-bold text-red-600 dark:text-red-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                    </div>
                     <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2">
                      <div 
                         className="bg-red-600 dark:bg-red-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                     <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentage}% of total expenses – {item.count} transaction{item.count !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
          ) : (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">No expense transactions in selected period</p>
          )}
        </div>
      </div>

      {/* Transfer Summary */}
      {getTransferTotal(filteredTransactions) > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400 flex items-center gap-2">
            ↔ Transfer Summary
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-600 dark:border-blue-700 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)]">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Total Internal Transfers</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {filteredTransactions.filter(t => t.category === 'Transfer').length} transaction(s)
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(getTransferTotal(filteredTransactions))}
              </p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
              Transfers are internal fund movements between trustees and don't affect the income/expense balance.
            </p>
          </div>
        </div>
      )}

      {/* Trustee Ledger */}
      <div className="mt-6">
        <h3 className="text-lg font-bold mb-3 text-indigo-700 dark:text-indigo-400">Trustee Ledger</h3>
        {getTrusteeLedger(filteredTransactions).length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No trustee data for this period.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getTrusteeLedger(filteredTransactions).map((item) => (
               <div
                 key={item.trustee}
                 className="rounded-lg border border-gray-200 dark:border-gray-900 bg-white dark:bg-black p-4 shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1"
               >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trustee</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{item.trustee}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${item.netPosition >= 0 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                      }`}
                  >
                    {item.netPosition >= 0 ? 'Surplus' : 'Deficit'}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Income Collected</span>
                    <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(item.incomeCollected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Expenses Paid</span>
                    <span className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(item.expensesPaid)}</span>
                  </div>
                  {(item.transfersIn > 0 || item.transfersOut > 0) && (
                    <>
                      {item.transfersIn > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Transfers In</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">+{formatCurrency(item.transfersIn)}</span>
                        </div>
                      )}
                      {item.transfersOut > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Transfers Out</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">-{formatCurrency(item.transfersOut)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Net Position</span>
                    <span className={`font-bold ${item.netPosition >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                      {formatCurrency(item.netPosition)}
                    </span>
                  </div>
                </div>
                {item.netPosition < 0 && (
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                    Trustee has spent beyond available funds. Transfer from surplus trustee advised.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
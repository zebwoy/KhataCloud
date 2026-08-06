import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, FileSpreadsheet, FileText, Calendar, Filter, Check } from 'lucide-react';
import type { Transaction } from '../types';
import { exportTransactionsToExcelXML, exportTransactionsToCSV } from '../utils/exportUtils';

export interface ExportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  isAdmin?: boolean;
  activeFiltersContext?: {
    dateRange?: string;
    categories?: string[];
    custodians?: string[];
    searchQuery?: string;
    amountRange?: string;
    enteredBy?: string[];
  };
  filenamePrefix?: string;
  orgName?: string;
}

export type RecordLimitMode = 'all' | 'top10' | 'top20' | 'top50' | 'month';
export type ExportFormatMode = 'excel' | 'csv';

export default function ExportOptionsModal({
  isOpen,
  onClose,
  transactions,
  isAdmin = false,
  activeFiltersContext = {},
  filenamePrefix = 'Transaction_Ledger_Export',
  orgName = 'KhataCloud',
}: ExportOptionsModalProps) {
  const [recordMode, setRecordMode] = useState<RecordLimitMode>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [formatMode, setFormatMode] = useState<ExportFormatMode>('excel');

  // Extract unique available months (YYYY-MM) from transaction dates
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      if (t.date && t.date.length >= 7) {
        monthsSet.add(t.date.substring(0, 7)); // 'YYYY-MM'
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Set default selected month if available
  useMemo(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter & limit transactions according to user selections
  const finalExportTransactions = useMemo(() => {
    let list = [...transactions];

    if (recordMode === 'month' && selectedMonth) {
      list = list.filter(t => t.date.startsWith(selectedMonth));
    }

    if (recordMode === 'top10') {
      list = list.slice(0, 10);
    } else if (recordMode === 'top20') {
      list = list.slice(0, 20);
    } else if (recordMode === 'top50') {
      list = list.slice(0, 50);
    }

    return list;
  }, [transactions, recordMode, selectedMonth]);

  if (!isOpen) return null;

  const handleExecuteExport = () => {
    let customDateFilter = activeFiltersContext.dateRange || 'All Time';
    if (recordMode === 'top10') customDateFilter += ' (Top 10 Latest Records)';
    else if (recordMode === 'top20') customDateFilter += ' (Top 20 Latest Records)';
    else if (recordMode === 'top50') customDateFilter += ' (Top 50 Latest Records)';
    else if (recordMode === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, 1);
      const monthLabel = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      customDateFilter = `Specific Month: ${monthLabel}`;
    }

    const mergedFilters = {
      ...activeFiltersContext,
      dateRange: customDateFilter,
    };

    if (formatMode === 'excel') {
      exportTransactionsToExcelXML({
        transactions: finalExportTransactions,
        filenamePrefix: `${filenamePrefix}_${recordMode}`,
        isAdmin,
        activeFilters: mergedFilters,
        orgName,
      });
    } else {
      exportTransactionsToCSV({
        transactions: finalExportTransactions,
        filenamePrefix: `${filenamePrefix}_${recordMode}`,
        isAdmin,
        activeFilters: mergedFilters,
        orgName,
      });
    }

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop guard */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col pointer-events-auto animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Export Options</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Customize record range &amp; format before downloading</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Section 1: Record Limit / Scope */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 block flex items-center gap-1.5">
              <Filter size={13} /> Select Record Scope
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Records', sub: `${transactions.length} items` },
                { id: 'top10', label: 'Top 10', sub: 'Latest 10' },
                { id: 'top20', label: 'Top 20', sub: 'Latest 20' },
                { id: 'top50', label: 'Top 50', sub: 'Latest 50' },
                { id: 'month', label: 'By Month', sub: 'Select month' },
              ].map(opt => {
                const active = recordMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRecordMode(opt.id as RecordLimitMode)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      active
                        ? 'bg-violet-600/10 border-violet-600 text-violet-700 dark:text-violet-300 font-semibold ring-2 ring-violet-500/20'
                        : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-violet-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      {opt.label}
                      {active && <Check size={14} className="text-violet-600 dark:text-violet-400" />}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{opt.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Month Dropdown Selector when 'month' mode is active */}
            {recordMode === 'month' && (
              <div className="mt-3 p-3 rounded-2xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/50">
                <label className="text-xs font-semibold text-violet-900 dark:text-violet-200 mb-1.5 block flex items-center gap-1.5">
                  <Calendar size={13} /> Select Target Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full text-xs rounded-xl border border-violet-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {availableMonths.map(m => {
                    const [year, month] = m.split('-');
                    const dateObj = new Date(Number(year), Number(month) - 1, 1);
                    const monthLabel = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                    return (
                      <option key={m} value={m}>
                        {monthLabel} ({transactions.filter(t => t.date.startsWith(m)).length} records)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Format Choice */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 block">
              Choose Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Formatted Excel (.xml / .xls) */}
              <button
                type="button"
                onClick={() => setFormatMode('excel')}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  formatMode === 'excel'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-semibold ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    Excel Spreadsheet
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-semibold">Recommended</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                    Includes colors, custom column widths, word-wrap, &amp; executive summary cards. No warnings.
                  </p>
                </div>
              </button>

              {/* Standard CSV (.csv) */}
              <button
                type="button"
                onClick={() => setFormatMode('csv')}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  formatMode === 'csv'
                    ? 'bg-violet-500/10 border-violet-500 text-violet-800 dark:text-violet-300 font-semibold ring-2 ring-violet-500/20'
                    : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-violet-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold">Standard CSV (.csv)</div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                    Universal plain-text CSV with UTF-8 BOM encoding &amp; metadata headers.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Export Summary Badge */}
          <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/80 dark:border-slate-800 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
            <span>Ready to export:</span>
            <span className="font-bold text-violet-600 dark:text-violet-400">
              {finalExportTransactions.length} transaction{finalExportTransactions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={finalExportTransactions.length === 0}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} /> Download Export
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Edit, X, SlidersHorizontal, Search } from 'lucide-react';
import type { Transaction, TrusteeOption } from '../types';
import { defaultColumnFilter } from '../types';
import useTableState from '../hooks/useTableState';
import { formatCurrency, formatDisplayDate } from '../utils/formatters';
import ExportOptionsModal from './ExportOptionsModal';

interface TransactionTableProps {
  transactions: Transaction[];
  trusteeOptions: TrusteeOption[];
  isLoadingData: boolean;
  isSyncing: boolean;
  isAdmin?: boolean;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  onExportCSV?: () => void;
}

// ── Unified Filter Drawer ─────────────────────────────────────────────────────
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  table: ReturnType<typeof useTableState>;
  trusteeOptions: TrusteeOption[];
  isAdmin?: boolean;
}

function FilterDrawer({ isOpen, onClose, table, trusteeOptions, isAdmin }: DrawerProps) {
  if (!isOpen) return null;

  const cf = table.columnFilters;

  // Current filter values
  const activeCategories = cf.category?.selectedValues ?? [];
  const activeDateFrom   = cf.date?.dateFrom ?? '';
  const activeDateTo     = cf.date?.dateTo   ?? '';
  const activeAmountMin  = cf.amount?.amountMin ?? '';
  const activeAmountMax  = cf.amount?.amountMax ?? '';
  const activeCustodians = cf.custodian?.selectedValues ?? [];
  const activeEnteredBy  = cf.entered_by?.selectedValues ?? [];

  const custodianOptions = trusteeOptions.map(o => o.value).sort();
  // Derive unique entered_by values from transactions via table state
  const enteredByOptions = table.getUniqueColumnValues('entered_by' as any).filter(Boolean);

  const setQuickPreset = (from: string) => {
    table.updateFilter('date', { ...cf.date, dateFrom: from, dateTo: '' });
  };

  const getPresets = () => {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    return [
      { label: 'This Month', from: `${y}-${m}-01` },
      {
        label: 'Last 3 Months',
        from: new Date(y, now.getMonth() - 3, 1).toISOString().split('T')[0],
      },
      { label: 'This Year', from: `${y}-01-01` },
    ];
  };

  const sortOptions: { col: string; dir: 'asc' | 'desc'; label: string }[] = [
    { col: 'date',   dir: 'desc', label: 'Newest first'   },
    { col: 'date',   dir: 'asc',  label: 'Oldest first'   },
    { col: 'amount', dir: 'desc', label: 'Highest amount' },
    { col: 'amount', dir: 'asc',  label: 'Lowest amount'  },
    { col: 'category', dir: 'asc', label: 'Category A→Z' },
  ];

  const catColors: Record<string, string> = {
    Income:   'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold shadow-sm',
    Expense:  'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 font-semibold shadow-sm',
    Transfer: 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 font-semibold shadow-sm',
  };

  // Portal to document.body so fixed positioning is always relative to the
  // viewport, never to any ancestor stacking/transform/overflow context.
  return createPortal(
    <>
      {/*
        Invisible click-guard — covers only the page content area below the navbar.
        Starts at top-16 (below the floating navbar band) so it never sits on top
        of the navbar at all, which prevents the glass navbar from picking up any
        tint/overlay colour from this div.
      */}
      <div
        className="fixed inset-0 z-40 pointer-events-auto bg-black/20 dark:bg-black/40 md:bg-transparent"
        onClick={onClose}
      />

      {/*
        Drawer card — fixed directly, not inside a full-viewport flex wrapper.
        Mobile (< md): top-4 bottom-24 left-4 right-4 (clears bottom nav bar, symmetric margin at top)
        Desktop (md): top-24 bottom-6 right-6 left-auto (clears top navbar pill)
        z-40 keeps it below the navbar z-50 so it can never paint over it.
      */}
      <div className="
        fixed z-40
        top-4 bottom-24 left-4 right-4
        md:top-24 md:bottom-6 md:right-6 md:left-auto
        md:w-[min(22rem,calc(100vw-2rem))]
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
            Filters &amp; Sort
          </h3>
          <div className="flex items-center gap-3">
            {table.hasActiveFilters() && (
              <button
                onClick={table.clearAllFilters}
                className="text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline"
              >
                Clear all
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

        {/* Scrollable body with scrollbars hidden */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-1">

          {/* Sort */}
          <section className="px-6 py-4 border-b border-gray-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Sort By</h4>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map(o => {
                const active = table.sortColumn === o.col && table.sortDirection === o.dir;
                return (
                  <button
                    key={`${o.col}-${o.dir}`}
                    onClick={() => {
                      table.setSortColumn(o.col);
                      table.setSortDirection(o.dir);
                    }}
                    className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all ${
                      active
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/25 font-semibold'
                        : 'border-gray-200 dark:border-slate-700/80 text-gray-600 dark:text-gray-300 hover:border-violet-400/60'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Category */}
          <section className="px-6 py-4 border-b border-gray-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Category</h4>
            <div className="flex flex-wrap gap-2">
              {(['Income', 'Expense', 'Transfer'] as const).map(cat => {
                const selected = activeCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      const next = selected
                        ? activeCategories.filter(v => v !== cat)
                        : [...activeCategories, cat];
                      table.updateFilter('category', { ...cf.category, selectedValues: next });
                    }}
                    className={`text-xs px-4 py-1.5 rounded-full border transition-all ${
                      selected ? catColors[cat] : 'border-gray-200 dark:border-slate-700/80 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Date range */}
          <section className="px-6 py-4 border-b border-gray-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Date Range</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {getPresets().map(p => (
                <button
                  key={p.label}
                  onClick={() => setQuickPreset(p.from)}
                  className="text-xs px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-slate-700/80 text-gray-600 dark:text-gray-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                <input
                  type="date" value={activeDateFrom}
                  onChange={e => table.updateFilter('date', { ...cf.date, dateFrom: e.target.value })}
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                <input
                  type="date" value={activeDateTo}
                  onChange={e => table.updateFilter('date', { ...cf.date, dateTo: e.target.value })}
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Amount */}
          <section className="px-6 py-4 border-b border-gray-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Amount Range (₹)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">Min</label>
                <input
                  type="number" placeholder="0" value={activeAmountMin}
                  onChange={e => table.updateFilter('amount', { ...cf.amount, amountMin: e.target.value })}
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">Max</label>
                <input
                  type="number" placeholder="No limit" value={activeAmountMax}
                  onChange={e => table.updateFilter('amount', { ...cf.amount, amountMax: e.target.value })}
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Custodian */}
          {custodianOptions.length > 0 && (
            <section className="px-6 py-4 border-b border-gray-100 dark:border-slate-800/60">
              <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Custodian</h4>
              <div className="flex flex-wrap gap-2">
                {custodianOptions.map(opt => {
                  const selected = activeCustodians.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        const next = selected
                          ? activeCustodians.filter(v => v !== opt)
                          : [...activeCustodians, opt];
                        table.updateFilter('custodian', { ...cf.custodian, selectedValues: next });
                      }}
                      className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all ${
                        selected
                          ? 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300 font-semibold shadow-sm'
                          : 'border-gray-200 dark:border-slate-700/80 text-gray-600 dark:text-gray-300 hover:border-violet-400/60'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Entered By — admin only */}
          {isAdmin && enteredByOptions.length > 0 && (
            <section className="px-6 py-4">
              <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Entered By</h4>
              <div className="flex flex-wrap gap-2">
                {enteredByOptions.map(opt => {
                  const selected = activeEnteredBy.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        const next = selected
                          ? activeEnteredBy.filter(v => v !== opt)
                          : [...activeEnteredBy, opt];
                        table.updateFilter('entered_by', { ...cf.entered_by, selectedValues: next });
                      }}
                      className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all ${
                        selected
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                          : 'border-gray-200 dark:border-slate-700/80 text-gray-600 dark:text-gray-300 hover:border-indigo-400/60'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-gray-200/60 dark:border-slate-800 shrink-0 bg-white/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/25 active:scale-[0.99]"
          >
            Done
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Count active filters for badge ────────────────────────────────────────────
function countActiveFilters(table: ReturnType<typeof useTableState>, isAdmin?: boolean): number {
  const cf = table.columnFilters;
  let n = 0;
  if (table.searchQuery.trim()) n++;
  if ((cf.category?.selectedValues ?? []).length > 0) n++;
  if (cf.date?.dateFrom || cf.date?.dateTo) n++;
  if (cf.amount?.amountMin || cf.amount?.amountMax) n++;
  if ((cf.custodian?.selectedValues ?? []).length > 0) n++;
  if (cf.counterparty?.textFilter) n++;
  if (isAdmin && (cf.entered_by?.selectedValues ?? []).length > 0) n++;
  return n;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TransactionTable({
  transactions,
  trusteeOptions,
  isLoadingData,
  isSyncing,
  isAdmin = false,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionTableProps) {
  const table = useTableState({ transactions, trusteeOptions });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.ctrlKey && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filterCount = countActiveFilters(table, isAdmin);

  return (
    <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">

      {/* ── Header ── */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Showing {table.filteredTransactions.length} of {transactions.length} transaction{table.filteredTransactions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Toolbar: Search | Filters | Export ── */}
      <div className="flex items-center gap-2 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
            <Search size={16} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search transactions… (Press /)"
            value={table.searchQuery}
            onChange={e => table.setSearchQuery(e.target.value)}
            className="pl-9 pr-9 py-2.5 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all shadow-sm"
          />
          {table.searchQuery && (
            <button
              onClick={() => table.setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filters button */}
        <button
          id="btn-filters"
          onClick={() => setDrawerOpen(true)}
          className={`
            relative flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium
            transition-all duration-150 shrink-0
            ${ filterCount > 0
              ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-950/30 dark:border-violet-700 dark:text-violet-300'
              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
            }
          `}
        >
          <SlidersHorizontal size={15} />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span className="
              min-w-[20px] h-5 px-1 rounded-full
              bg-violet-600 text-white text-[10px] font-bold
              flex items-center justify-center
            ">
              {filterCount}
            </span>
          )}
        </button>

        {/* Export CSV / Excel */}
        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shrink-0 shadow-sm"
        >
          <Download size={15} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* ── Export Options Modal ── */}
      {(() => {
        const cf = table.columnFilters;
        let dateRangeStr = '';
        if (cf.date?.dateFrom || cf.date?.dateTo) {
          dateRangeStr = `${cf.date.dateFrom || 'Start'} to ${cf.date.dateTo || 'End'}`;
        }
        let amountRangeStr = '';
        if (cf.amount?.amountMin || cf.amount?.amountMax) {
          amountRangeStr = `₹${cf.amount.amountMin || '0'} to ₹${cf.amount.amountMax || '∞'}`;
        }

        return (
          <ExportOptionsModal
            isOpen={exportModalOpen}
            onClose={() => setExportModalOpen(false)}
            transactions={table.filteredTransactions}
            isAdmin={isAdmin}
            filenamePrefix="Transaction_Ledger_Export"
            activeFiltersContext={{
              dateRange: dateRangeStr || 'All Time',
              categories: cf.category?.selectedValues,
              custodians: cf.custodian?.selectedValues,
              enteredBy: cf.entered_by?.selectedValues,
              amountRange: amountRangeStr,
              searchQuery: table.searchQuery,
            }}
            orgName="KhataCloud"
          />
        );
      })()}

      {/* ── Filter Drawer ── */}
      <FilterDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        table={table}
        trusteeOptions={trusteeOptions}
        isAdmin={isAdmin}
      />

      {/* ── Active filter summary chips (lightweight, dismissible) ── */}
      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(table.columnFilters.category?.selectedValues ?? []).map(cat => (
            <span key={cat} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
              {cat}
              <button onClick={() => {
                const next = (table.columnFilters.category?.selectedValues ?? []).filter(v => v !== cat);
                table.updateFilter('category', { ...table.columnFilters.category, selectedValues: next });
              }}><X size={11} /></button>
            </span>
          ))}
          {(table.columnFilters.date?.dateFrom || table.columnFilters.date?.dateTo) && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
              {table.columnFilters.date?.dateFrom || '*'} → {table.columnFilters.date?.dateTo || '*'}
              <button onClick={() => table.updateFilter('date', { ...defaultColumnFilter })}><X size={11} /></button>
            </span>
          )}
          {(table.columnFilters.custodian?.selectedValues ?? []).map(c => (
            <span key={c} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
              {c}
              <button onClick={() => {
                const next = (table.columnFilters.custodian?.selectedValues ?? []).filter(v => v !== c);
                table.updateFilter('custodian', { ...table.columnFilters.custodian, selectedValues: next });
              }}><X size={11} /></button>
            </span>
          ))}
          {(table.columnFilters.amount?.amountMin || table.columnFilters.amount?.amountMax) && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
              ₹{table.columnFilters.amount?.amountMin || '0'} – ₹{table.columnFilters.amount?.amountMax || '∞'}
              <button onClick={() => table.updateFilter('amount', { ...defaultColumnFilter })}><X size={11} /></button>
            </span>
          )}
          {/* Entered By chips — admin only */}
          {isAdmin && (table.columnFilters.entered_by?.selectedValues ?? []).map(eb => (
            <span key={eb} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              👤 {eb}
              <button onClick={() => {
                const next = (table.columnFilters.entered_by?.selectedValues ?? []).filter(v => v !== eb);
                table.updateFilter('entered_by', { ...table.columnFilters.entered_by, selectedValues: next });
              }}><X size={11} /></button>
            </span>
          ))}
          <button
            onClick={table.clearAllFilters}
            className="text-xs text-red-500 dark:text-red-400 font-medium hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── No results ── */}
      {!isLoadingData && table.filteredTransactions.length === 0 && (
        <p className="text-gray-500 text-center py-12">No transactions found</p>
      )}

      {/* ── Desktop Table ── */}
      {(isLoadingData || table.filteredTransactions.length > 0) && (
        <>
          <div className="hidden md:block overflow-x-auto mb-4 -mx-6 md:mx-0 px-4 md:px-0">
            <table className="w-full min-w-[800px] md:min-w-0">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subcategory</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Custodian</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Counterparty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks</th>
                  {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entered By</th>}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingData ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-t animate-pulse bg-white dark:bg-black">
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-20" /></td>
                      <td className="px-4 py-4"><div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-16" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-28" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-28" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-16 ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32" /></td>
                      {isAdmin && <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24" /></td>}
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-20 mx-auto" /></td>
                    </tr>
                  ))
                ) : (
                  table.paginatedTransactions.map(t => (
                    <tr key={t.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(t.date)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          t.category === 'Income'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : t.category === 'Transfer'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                        }`}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{t.subcategory || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{t.custodian}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{t.counterparty}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold whitespace-nowrap">
                        <span className={
                          t.category === 'Income'
                            ? 'text-green-600 dark:text-green-400'
                            : t.category === 'Transfer'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                        }>
                          {t.category === 'Income' ? '+' : t.category === 'Transfer' ? '↔' : '-'}{formatCurrency(Number(t.amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{t.remarks || '-'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {t.entered_by ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                              👤 {t.entered_by}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 italic text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => onEditTransaction(t)}
                            disabled={isSyncing}
                            className={`text-violet-600 dark:text-violet-400 hover:text-violet-800 font-semibold text-sm flex items-center gap-1 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Edit size={15} /> Edit
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(t.id)}
                            disabled={isSyncing}
                            className={`text-red-500 dark:text-red-400 hover:text-red-700 font-semibold text-sm transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Card List ── */}
          <div className="block md:hidden space-y-3 mb-4">
            {isLoadingData ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-4 animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24" />
                    <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-16" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-4 bg-gray-100 dark:bg-gray-900 rounded" />
                    <div className="h-4 bg-gray-100 dark:bg-gray-900 rounded" />
                  </div>
                </div>
              ))
            ) : (
              table.paginatedTransactions.map(t => (
                <div key={t.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">{formatDisplayDate(t.date)}</span>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                        t.category === 'Income'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : t.category === 'Transfer'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                      }`}>
                        {t.category}
                      </span>
                    </div>
                    <span className={`text-base font-bold ${
                      t.category === 'Income' ? 'text-green-600 dark:text-green-400'
                      : t.category === 'Transfer' ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
                    }`}>
                      {t.category === 'Income' ? '+' : t.category === 'Transfer' ? '⇄' : '-'}{formatCurrency(Number(t.amount))}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs py-2 border-t border-b border-gray-100 dark:border-gray-900 my-2">
                    {t.subcategory && (
                      <div>
                        <span className="text-gray-400 block">Subcategory</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{t.subcategory}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400 block">Custodian</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{t.custodian}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Counterparty</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{t.counterparty}</span>
                    </div>
                    {isAdmin && t.entered_by && (
                      <div className="col-span-2">
                        <span className="text-gray-400 block">Entered By</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium">
                          👤 {t.entered_by}
                        </span>
                      </div>
                    )}
                  </div>

                  {t.remarks && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">{t.remarks}</p>
                  )}

                  <div className="flex justify-end gap-4 pt-2 border-t border-gray-100 dark:border-gray-900">
                    <button
                      onClick={() => onEditTransaction(t)}
                      disabled={isSyncing}
                      className={`text-violet-600 dark:text-violet-400 font-semibold text-xs flex items-center gap-1 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Edit size={13} /> Edit
                    </button>
                    <button
                      onClick={() => onDeleteTransaction(t.id)}
                      disabled={isSyncing}
                      className={`text-red-500 dark:text-red-400 font-semibold text-xs ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Pagination ── */}
          {table.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-900 pt-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Page {table.currentPage} of {table.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => table.setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={table.currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    table.currentPage === 1
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => table.setCurrentPage(prev => Math.min(table.totalPages, prev + 1))}
                  disabled={table.currentPage === table.totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    table.currentPage === table.totalPages
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
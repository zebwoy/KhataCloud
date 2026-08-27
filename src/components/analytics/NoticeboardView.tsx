/**
 * NoticeboardView.tsx — Digital monthly notice board
 *
 * Premium styled monthly financial summary with a toggle to switch between:
 *   • Subcategory mode  — groups transactions by subcategory (default)
 *   • Remark mode       — shows individual transactions with their remarks
 *
 * Driven by filteredTransactions + CMS config from org-config API.
 */
import { useState } from 'react';
import { Heart, MessageSquare, ExternalLink, TrendingUp, TrendingDown, Minus, AlignLeft, Tag } from 'lucide-react';
import type { Transaction, Theme } from '../../types';
import type { Stats } from '../../utils/calculations';
import { getCategoryBreakdown } from '../../utils/calculations';
import type { NoticeboardConfig } from '../../../api/org-config';
import type { DateFilterMode } from '../../utils/constants';

interface Props {
  filteredTransactions: Transaction[];
  stats: Stats;
  dateFilterMode: DateFilterMode;
  dateRange: { fromDate: string; toDate: string };
  orgConfig: NoticeboardConfig;
  theme: Theme;
}

type DisplayMode = 'subcategory' | 'remark';

function getPeriodLabel(
  dateFilterMode: DateFilterMode,
  dateRange: { fromDate: string; toDate: string }
): string {
  const today = new Date();
  if (dateFilterMode === 'thisMonth') {
    return today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  if (dateFilterMode === 'selectedMonth' && dateRange.fromDate) {
    const parts = dateRange.fromDate.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const d = new Date(year, month, 1);
      return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
  }
  if (dateFilterMode === 'thisQuarter') {
    const q = Math.floor(today.getMonth() / 3) + 1;
    return `Q${q} ${today.getFullYear()}`;
  }
  if (dateFilterMode === 'thisFiscalYear') {
    const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `FY ${fyStart}–${fyStart + 1}`;
  }
  if (dateFilterMode === 'custom' && dateRange.fromDate && dateRange.toDate) {
    const from = new Date(dateRange.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const to   = new Date(dateRange.toDate).toLocaleDateString('en-IN',   { day: 'numeric', month: 'short', year: 'numeric' });
    return `${from} – ${to}`;
  }
  return 'All Time';
}

/** Get individual transactions with their remark (or label) as display text */
function getRemarkLines(
  transactions: Transaction[],
  category: 'Income' | 'Expense',
  hiddenSubcategories: string[]
): { label: string; amount: number; id: number }[] {
  return transactions
    .filter(t => t.category === category && !hiddenSubcategories.includes(t.subcategory))
    .map(t => ({
      id: t.id,
      amount: t.amount,
      label: (t.remarks && t.remarks !== 'Not Available') ? t.remarks : t.subcategory,
    }));
}

export default function NoticeboardView({ filteredTransactions, stats, dateFilterMode, dateRange, orgConfig, theme: _theme }: Props) {
  const { publicMessage, donationLink, hiddenSubcategories = [] } = orgConfig;
  const periodLabel = getPeriodLabel(dateFilterMode, dateRange);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('subcategory');

  const incomeBreakdown  = getCategoryBreakdown(filteredTransactions, 'Income')
    .filter(item => !hiddenSubcategories.includes(item.sub));
  const expenseBreakdown = getCategoryBreakdown(filteredTransactions, 'Expense')
    .filter(item => !hiddenSubcategories.includes(item.sub));

  const incomeRemarks  = getRemarkLines(filteredTransactions, 'Income',  hiddenSubcategories);
  const expenseRemarks = getRemarkLines(filteredTransactions, 'Expense', hiddenSubcategories);

  const isDeficit  = stats.balance < 0;
  const isEmpty    = filteredTransactions.length === 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Notice board card */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-gray-200 dark:border-slate-800">

        {/* Header banner */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-black dark:to-slate-950 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-1">
                Financial Summary
              </p>
              <h2 className="text-2xl font-bold text-white tracking-tight">{periodLabel}</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Subtle display mode toggle */}
              {!isEmpty && (
                <div className="flex items-center bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/40">
                  <button
                    id="noticeboard-toggle-subcategory"
                    onClick={() => setDisplayMode('subcategory')}
                    title="Group by subcategory"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      displayMode === 'subcategory'
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Tag size={11} />
                    <span className="hidden sm:inline">Category</span>
                  </button>
                  <button
                    id="noticeboard-toggle-remark"
                    onClick={() => setDisplayMode('remark')}
                    title="Show individual remarks"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      displayMode === 'remark'
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlignLeft size={11} />
                    <span className="hidden sm:inline">Remarks</span>
                  </button>
                </div>
              )}

              {/* Surplus / Deficit badge */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg ${
                isEmpty
                  ? 'bg-slate-700 text-slate-400'
                  : isDeficit
                    ? 'bg-red-600/90 text-white shadow-red-500/30'
                    : 'bg-emerald-600/90 text-white shadow-emerald-500/30'
              }`}>
                {isEmpty ? <Minus size={16} /> : isDeficit ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                {isEmpty ? 'No data' : isDeficit ? 'Deficit' : 'Surplus'}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-slate-950 px-6 py-5 space-y-5">

          {isEmpty ? (
            <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">
              No transactions for this period.
            </p>
          ) : (
            <>
              {/* Two-column layout: Expenses | Income */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Expenses column */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-500 dark:text-red-400 mb-3 flex items-center gap-1.5">
                    <TrendingDown size={13} /> Expenses
                  </p>
                  <div className="space-y-2">
                    {displayMode === 'subcategory' ? (
                      expenseBreakdown.length > 0 ? expenseBreakdown.map(item => (
                        <div key={item.sub} className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-slate-400">{item.sub}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            ₹{item.total.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )) : <p className="text-xs text-gray-400 dark:text-slate-500">None recorded</p>
                    ) : (
                      expenseRemarks.length > 0 ? expenseRemarks.map(item => (
                        <div key={item.id} className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-slate-400 truncate max-w-[65%]" title={item.label}>{item.label}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )) : <p className="text-xs text-gray-400 dark:text-slate-500">None recorded</p>
                    )}
                  </div>
                  {/* Expense total */}
                  <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-900/30 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Total</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                      ₹{stats.expenses.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Income column */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                    <TrendingUp size={13} /> Income
                  </p>
                  <div className="space-y-2">
                    {displayMode === 'subcategory' ? (
                      incomeBreakdown.length > 0 ? incomeBreakdown.map(item => (
                        <div key={item.sub} className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-slate-400">{item.sub}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            ₹{item.total.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )) : <p className="text-xs text-gray-400 dark:text-slate-500">None recorded</p>
                    ) : (
                      incomeRemarks.length > 0 ? incomeRemarks.map(item => (
                        <div key={item.id} className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-slate-400 truncate max-w-[65%]" title={item.label}>{item.label}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )) : <p className="text-xs text-gray-400 dark:text-slate-500">None recorded</p>
                    )}
                  </div>
                  {/* Income total */}
                  <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹{stats.income.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance row */}
              <div className={`rounded-xl px-5 py-4 flex justify-between items-center ${
                isDeficit
                  ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
              }`}>
                <span className="font-bold text-gray-700 dark:text-white text-base">Balance</span>
                <span className={`text-xl font-black tabular-nums ${
                  isDeficit ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {isDeficit ? '−' : '+'}₹{Math.abs(stats.balance).toLocaleString('en-IN')}
                </span>
              </div>
            </>
          )}

          {/* Admin public message */}
          {publicMessage && (
            <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50">
              <MessageSquare size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{publicMessage}</p>
            </div>
          )}

          {/* Donation CTA */}
          {donationLink && (
            <div className="pt-1">
              <a
                href={donationLink}
                target="_blank"
                rel="noopener noreferrer"
                id="noticeboard-donate-btn"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-200 active:scale-95"
              >
                <Heart size={16} className="fill-white/70" />
                Help us — Donate
                <ExternalLink size={13} className="opacity-60" />
              </a>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 dark:text-slate-600">
            This summary reflects recorded transactions for the selected period.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * NoticeboardView.tsx — Digital monthly notice board
 *
 * Displays financial summary with:
 *   • Toggle: Detailed (all subcategories, remarks for "Others") vs Common (aggregated expenses)
 *   • Common Expense items: Salaries, Rent + Building Water Bill, Electric Light Bill, Carry forward deficit
 *   • Print Noticeboard button: Generates 4-page PDF (English, Urdu, Hindi, Marathi) with donation QR
 */
import { useState } from 'react';
import { Heart, MessageSquare, ExternalLink, TrendingUp, TrendingDown, Minus, ListTree, Layers, Printer, QrCode } from 'lucide-react';
import { trackAction } from '../../lib/trailTracker';
import type { Transaction, Theme } from '../../types';
import type { Stats } from '../../utils/calculations';
import type { NoticeboardConfig } from '../../../api/org-config';
import type { DateFilterMode } from '../../utils/constants';
import NoticeboardPrintSheet, { type NoticeboardLineItem } from './NoticeboardPrintSheet';

interface Props {
  filteredTransactions: Transaction[];
  stats: Stats;
  previousPeriodStats?: Stats;
  previousRange?: { fromDate: string; toDate: string } | null;
  dateFilterMode: DateFilterMode;
  dateRange: { fromDate: string; toDate: string };
  orgConfig: NoticeboardConfig;
  theme: Theme;
}

export type NoticeboardDisplayMode = 'detailed' | 'common';

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

/**
 * Build line items for a category (Income or Expense).
 * If subcategory is "Others", "Other Income", or "Other Expenses",
 * dynamically show transaction remarks instead.
 */
function buildDetailedItems(
  transactions: Transaction[],
  category: 'Income' | 'Expense',
  hiddenSubcategories: string[] = []
): NoticeboardLineItem[] {
  const visible = transactions.filter(t => t.category === category && !hiddenSubcategories.includes(t.subcategory));

  const subTotals: Record<string, number> = {};
  const remarkTotals: Record<string, number> = {};

  visible.forEach(t => {
    const sub = t.subcategory || 'General';
    const isOther = /other/i.test(sub);
    const amt = Number(t.amount) || 0;

    if (isOther) {
      const remark = t.remarks && t.remarks.trim() && t.remarks !== 'Not Available'
        ? t.remarks.trim()
        : sub;
      remarkTotals[remark] = (remarkTotals[remark] || 0) + amt;
    } else {
      subTotals[sub] = (subTotals[sub] || 0) + amt;
    }
  });

  const items: NoticeboardLineItem[] = [];

  Object.entries(subTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sub, total]) => {
      items.push({ id: `sub-${sub}`, label: sub, amount: total, subcategory: sub });
    });

  Object.entries(remarkTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rem, total]) => {
      items.push({ id: `rem-${rem}`, label: rem, amount: total, subcategory: 'Others' });
    });

  return items;
}

/**
 * Build Common Expense items:
 * Aggregates:
 *   1. Salaries
 *   2. Rent + Building Water Bill
 *   3. Electric Light Bill
 *   4. Carry forward of last month's deficit (from previous period)
 *   5. Other Expenses (remaining expenses)
 */
function buildCommonExpenseItems(
  transactions: Transaction[],
  previousPeriodStats?: Stats,
  hiddenSubcategories: string[] = []
): NoticeboardLineItem[] {
  const visible = transactions.filter(t => t.category === 'Expense' && !hiddenSubcategories.includes(t.subcategory));

  let salariesTotal = 0;
  let rentWaterTotal = 0;
  let electricLightTotal = 0;
  let otherExpensesTotal = 0;
  const otherRemarkTotals: Record<string, number> = {};

  visible.forEach(t => {
    const sub = (t.subcategory || '').toLowerCase();
    const rem = (t.remarks || '').toLowerCase();
    const amt = Number(t.amount) || 0;

    if (/salary|salaries|teacher|staff|imam|stipend/.test(sub) || /salary|salaries|teacher|staff|imam/.test(rem)) {
      salariesTotal += amt;
    } else if (/rent|water|building water/.test(sub) || /rent|water/.test(rem)) {
      rentWaterTotal += amt;
    } else if (/electric|electricity|light bill|power/.test(sub) || /electric|electricity|light bill/.test(rem)) {
      electricLightTotal += amt;
    } else {
      if (/other/i.test(t.subcategory || '')) {
        const remark = t.remarks && t.remarks.trim() && t.remarks !== 'Not Available'
          ? t.remarks.trim()
          : (t.subcategory || 'Other Expenses');
        otherRemarkTotals[remark] = (otherRemarkTotals[remark] || 0) + amt;
      } else {
        otherExpensesTotal += amt;
      }
    }
  });

  const items: NoticeboardLineItem[] = [];

  if (salariesTotal > 0) {
    items.push({ id: 'common-salaries', label: 'Salaries', amount: salariesTotal, subcategory: 'Salaries' });
  }
  if (rentWaterTotal > 0) {
    items.push({ id: 'common-rent-water', label: 'Rent + Building Water Bill', amount: rentWaterTotal, subcategory: 'Rent + Building Water Bill' });
  }
  if (electricLightTotal > 0) {
    items.push({ id: 'common-electric', label: 'Electric Light Bill', amount: electricLightTotal, subcategory: 'Electric Light Bill' });
  }

  // Carry forward of last month's deficit
  if (previousPeriodStats && previousPeriodStats.balance < 0) {
    const lastMonthDeficit = Math.abs(previousPeriodStats.balance);
    items.push({
      id: 'common-deficit-carryover',
      label: "Carry forward of last month's deficit",
      amount: lastMonthDeficit,
      isDeficitCarryOver: true,
    });
  }

  if (otherExpensesTotal > 0) {
    items.push({ id: 'common-other-expenses', label: 'Other Expenses', amount: otherExpensesTotal, subcategory: 'Other Expenses' });
  }

  Object.entries(otherRemarkTotals).forEach(([rem, total]) => {
    items.push({ id: `common-rem-${rem}`, label: rem, amount: total, subcategory: 'Others' });
  });

  return items;
}

export default function NoticeboardView({
  filteredTransactions,
  stats: _stats,
  previousPeriodStats,
  dateFilterMode,
  dateRange,
  orgConfig,
  theme: _theme,
}: Props) {
  const { publicMessage, donationLink, hiddenSubcategories = [] } = orgConfig;
  const periodLabel = getPeriodLabel(dateFilterMode, dateRange);
  const [displayMode, setDisplayMode] = useState<NoticeboardDisplayMode>('detailed');

  // Build items based on display mode
  const detailedIncomeItems = buildDetailedItems(filteredTransactions, 'Income', hiddenSubcategories);
  const detailedExpenseItems = buildDetailedItems(filteredTransactions, 'Expense', hiddenSubcategories);
  const commonExpenseItems = buildCommonExpenseItems(filteredTransactions, previousPeriodStats, hiddenSubcategories);

  const displayIncomeItems = detailedIncomeItems; // Incomes are same in Detailed and Common
  const displayExpenseItems = displayMode === 'common' ? commonExpenseItems : detailedExpenseItems;

  const totalIncome = displayIncomeItems.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = displayExpenseItems.reduce((sum, item) => sum + item.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const isDeficit = netBalance < 0;
  const isEmpty = filteredTransactions.length === 0;

  const handlePrintNoticeboard = () => {
    trackAction('action:print-noticeboard');
    document.body.classList.add('printing-noticeboard');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-noticeboard');
    }, 1000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Notice board card (screen view) */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-gray-200 dark:border-slate-800 no-print">

        {/* Header banner */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-black dark:to-slate-950 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-1">
                Financial Summary
              </p>
              <h2 className="text-2xl font-bold text-white tracking-tight">{periodLabel}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Detailed vs Common toggle */}
              {!isEmpty && (
                <div className="flex items-center bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/40">
                  <button
                    id="noticeboard-toggle-detailed"
                    type="button"
                    onClick={() => setDisplayMode('detailed')}
                    title="Show all subcategories and remarks"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                      displayMode === 'detailed'
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ListTree size={12} />
                    <span>Detailed</span>
                  </button>
                  <button
                    id="noticeboard-toggle-common"
                    type="button"
                    onClick={() => setDisplayMode('common')}
                    title="Aggregated view (Salaries, Rent+Water, Electric Light Bill, Deficit)"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                      displayMode === 'common'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers size={12} />
                    <span>Common</span>
                  </button>
                </div>
              )}

              {/* Print Noticeboard Button */}
              <button
                id="btn-print-noticeboard"
                type="button"
                onClick={handlePrintNoticeboard}
                title="Print 4-Page Multilingual Noticeboard (English, Urdu, Hindi, Marathi) with QR Code"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Printer size={13} />
                <span className="hidden sm:inline">Print Noticeboard</span>
                <span className="sm:hidden">Print</span>
              </button>

              {/* Surplus / Deficit badge */}
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-lg ${
                isEmpty
                  ? 'bg-slate-700 text-slate-400'
                  : isDeficit
                    ? 'bg-red-600/90 text-white shadow-red-500/30'
                    : 'bg-emerald-600/90 text-white shadow-emerald-500/30'
              }`}>
                {isEmpty ? <Minus size={14} /> : isDeficit ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
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
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-500 dark:text-red-400 flex items-center gap-1.5">
                      <TrendingDown size={13} /> Expenses
                    </p>
                    {displayMode === 'common' && (
                      <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                        Common View
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {displayExpenseItems.length > 0 ? (
                      displayExpenseItems.map(item => (
                        <div key={item.id} className="flex justify-between items-baseline">
                          <span className={`text-sm ${item.isDeficitCarryOver ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-slate-400'}`}>
                            {item.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0 ml-2">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-slate-500">None recorded</p>
                    )}
                  </div>
                  {/* Expense total */}
                  <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-900/30 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Total Expenses</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                      ₹{totalExpense.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Income column */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                    <TrendingUp size={13} /> Income
                  </p>
                  <div className="space-y-2">
                    {displayIncomeItems.length > 0 ? (
                      displayIncomeItems.map(item => (
                        <div key={item.id} className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-slate-400 truncate max-w-[65%]" title={item.label}>
                            {item.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-slate-500">None recorded</p>
                    )}
                  </div>
                  {/* Income total */}
                  <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Income</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹{totalIncome.toLocaleString('en-IN')}
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
                <div>
                  <span className="font-bold text-gray-700 dark:text-white text-base block">Net Balance</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {displayMode === 'common' && previousPeriodStats && previousPeriodStats.balance < 0 ? 'Including carry forward deficit' : 'Inflows minus Outflows'}
                  </span>
                </div>
                <span className={`text-xl font-black tabular-nums ${
                  isDeficit ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {isDeficit ? '−' : '+'}₹{Math.abs(netBalance).toLocaleString('en-IN')}
                </span>
              </div>
            </>
          )}

          {/* Donation Appeal Card with Millat Qur'an Learning Centre QR Code */}
          <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 text-center sm:text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 block mb-1">
                Donation & Community Appeal
              </span>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                Support Millat Qur'an Learning Centre
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Scan the QR code to contribute directly towards educational and welfare maintenance.
              </p>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <img
                src="/donation-qr.png"
                alt="Millat Qur'an Learning Centre QR Code"
                className="w-24 h-24 object-contain rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white shadow-sm"
              />
              <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider flex items-center gap-1">
                <QrCode size={10} /> Scan To Donate
              </span>
            </div>
          </div>

          {/* Admin public message */}
          {publicMessage && (
            <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50">
              <MessageSquare size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{publicMessage}</p>
            </div>
          )}

          {/* External Donation Link Button */}
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
                Help us — Donate Online
                <ExternalLink size={13} className="opacity-60" />
              </a>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 dark:text-slate-600">
            This summary reflects verified transactions for the selected period.
          </p>
        </div>
      </div>

      {/* ── 4-Page Multilingual Print Sheet (Hidden on screen, visible on print) ── */}
      <div className="noticeboard-print-sheet hidden print:block">
        <NoticeboardPrintSheet
          periodLabel={periodLabel}
          displayMode={displayMode}
          incomeItems={displayIncomeItems}
          expenseItems={displayExpenseItems}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          balance={netBalance}
          isDeficit={isDeficit}
          qrCodeUrl="/donation-qr.png"
          orgName="Millat Qur'an Learning Centre"
        />
      </div>
    </div>
  );
}

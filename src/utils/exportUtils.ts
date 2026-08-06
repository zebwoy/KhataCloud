/**
 * exportUtils.ts — Premium CSV Export Utility for KhataCloud
 *
 * Features:
 *   1. Prepend UTF-8 BOM (\uFEFF) so Excel/Numbers automatically open in UTF-8.
 *   2. Executive Header Block (Org Name, Report Title, Timestamp).
 *   3. Applied Filters Block (Date Range, Categories, Custodians, Search Keyword, Amounts, Entered By).
 *   4. Summary Metrics Block (Total Records, Total Inflow, Total Outflow, Net Position).
 *   5. Data Table with 1-based index (S.No.), clean alignment, signed numerical amounts.
 *   6. Footer Summary Row calculating totals at bottom.
 */

import type { Transaction } from '../types';
import { calculateStats } from './calculations';

export interface ActiveFiltersContext {
  dateRange?: string;
  categories?: string[];
  custodians?: string[];
  searchQuery?: string;
  amountRange?: string;
  enteredBy?: string[];
}

export interface ExportCSVOptions {
  transactions: Transaction[];
  filenamePrefix?: string;
  isAdmin?: boolean;
  activeFilters?: ActiveFiltersContext;
  orgName?: string;
}

export function exportTransactionsToCSV({
  transactions,
  filenamePrefix = 'Khata_Account_Statement',
  isAdmin = false,
  activeFilters = {},
  orgName = 'KhataCloud',
}: ExportCSVOptions) {
  const stats = calculateStats(transactions);
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0];
  const timeStamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const lines: string[] = [];

  // Helper to escape CSV cells properly
  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // ── 1. EXECUTIVE HEADER BANNER ───────────────────────────────────────────────
  lines.push([orgName.toUpperCase() + ' — FINANCIAL ACCOUNT STATEMENT'].map(escapeCell).join(','));
  lines.push(['Generated On:', `${dateStamp} at ${timeStamp}`].map(escapeCell).join(','));
  lines.push(['Export Context:', filenamePrefix.replace(/_/g, ' ')].map(escapeCell).join(','));
  lines.push(''); // blank row

  // ── 2. APPLIED FILTERS SUMMARY BLOCK ─────────────────────────────────────────
  lines.push(['=== APPLIED FILTERS SUMMARY ==='].map(escapeCell).join(','));
  lines.push(['Date Filter:', activeFilters.dateRange || 'All Time'].map(escapeCell).join(','));

  const categoryText = activeFilters.categories?.length
    ? activeFilters.categories.join(', ')
    : 'All Categories (Income, Expense, Transfer)';
  lines.push(['Categories:', categoryText].map(escapeCell).join(','));

  const custodianText = activeFilters.custodians?.length
    ? activeFilters.custodians.join(', ')
    : 'All Custodians / Trustees';
  lines.push(['Custodians / Trustees:', custodianText].map(escapeCell).join(','));

  if (activeFilters.amountRange) {
    lines.push(['Amount Range:', activeFilters.amountRange].map(escapeCell).join(','));
  }

  if (activeFilters.enteredBy?.length) {
    lines.push(['Entered By:', activeFilters.enteredBy.join(', ')].map(escapeCell).join(','));
  }

  if (activeFilters.searchQuery?.trim()) {
    lines.push(['Search Keyword:', `"${activeFilters.searchQuery.trim()}"`].map(escapeCell).join(','));
  }

  lines.push(''); // blank row

  // ── 3. EXECUTIVE FINANCIAL SUMMARY BLOCK ─────────────────────────────────────
  lines.push(['=== FINANCIAL SUMMARY (EXPORTED RECORDS) ==='].map(escapeCell).join(','));
  lines.push(['Total Records Exported:', transactions.length].map(escapeCell).join(','));
  lines.push(['Total Income (Inflow):', `₹ ${stats.income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`].map(escapeCell).join(','));
  lines.push(['Total Expenses (Outflow):', `₹ ${stats.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`].map(escapeCell).join(','));
  
  const netLabel = stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT';
  lines.push(['Net Position:', `${netLabel}: ₹ ${stats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`].map(escapeCell).join(','));
  lines.push(''); // blank row

  // ── 4. DATA TABLE HEADERS ───────────────────────────────────────────────────
  lines.push(['=== TRANSACTION LEDGER DETAILS ==='].map(escapeCell).join(','));
  const headers = [
    'S.No.',
    'Date',
    'Category',
    'Subcategory',
    'Custodian',
    'Counterparty',
    'Amount (₹)',
    'Remarks',
  ];
  if (isAdmin) {
    headers.push('Entered By');
  }

  lines.push(headers.map(escapeCell).join(','));

  // ── 5. DATA ROWS ────────────────────────────────────────────────────────────
  transactions.forEach((t, idx) => {
    const rawAmt = Number(t.amount) || 0;
    const formattedAmt = t.category === 'Expense' ? -Math.abs(rawAmt) : rawAmt;
    const row = [
      idx + 1,
      t.date,
      t.category,
      t.subcategory || '-',
      t.custodian || '-',
      t.counterparty || '-',
      formattedAmt.toFixed(2),
      t.remarks || '-',
    ];
    if (isAdmin) {
      row.push(t.entered_by || '-');
    }
    lines.push(row.map(escapeCell).join(','));
  });

  // ── 6. GRAND TOTAL FOOTER ROW ────────────────────────────────────────────────
  lines.push(''); // blank row
  const summaryRow = [
    'GRAND TOTALS',
    `Records: ${transactions.length}`,
    '',
    '',
    '',
    'NET BALANCE:',
    stats.balance.toFixed(2),
    `Inflow: +${stats.income.toFixed(2)} | Outflow: -${stats.expenses.toFixed(2)}`,
  ];
  if (isAdmin) {
    summaryRow.push('');
  }
  lines.push(summaryRow.map(escapeCell).join(','));

  // ── 7. DOWNLOAD BLOB PREPARATION WITH UTF-8 BOM ─────────────────────────────
  const csvString = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const cleanPrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${cleanPrefix}_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

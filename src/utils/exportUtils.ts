/**
 * exportUtils.ts — Premium Formatted Excel (.xls) & CSV Export Utility for KhataCloud
 *
 * Features:
 *   1. Generates an HTML-based Excel spreadsheet (.xls) with full CSS styling.
 *   2. Native Colors: Deep violet headers (#4c1d95), emerald green for Income, rose red for Expense, blue for Net Position.
 *   3. Fixed Column Widths: Custom widths defined for each column so no text is clipped.
 *   4. Text Wrapping: `white-space: normal; word-wrap: break-word` so long remarks/counterparties wrap neatly without stretching columns.
 *   5. Applied Filters Header: Clearly displays selected Date Range, Categories, Custodians, Amount Range, Search Keyword, and Entered By.
 *   6. Executive Summary Cards: Displays Total Inflow, Outflow, and Net Position with colored indicator cards.
 *   7. Grand Total Row: Summary row at bottom calculating exact totals.
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

export interface ExportOptions {
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
}: ExportOptions) {
  const stats = calculateStats(transactions);
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0];
  const timeStamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const categoryText = activeFilters.categories?.length
    ? activeFilters.categories.join(', ')
    : 'All Categories (Income, Expense, Transfer)';

  const custodianText = activeFilters.custodians?.length
    ? activeFilters.custodians.join(', ')
    : 'All Custodians / Trustees';

  const enteredByText = activeFilters.enteredBy?.length
    ? activeFilters.enteredBy.join(', ')
    : 'All Users';

  const searchKeywordText = activeFilters.searchQuery?.trim()
    ? `"${activeFilters.searchQuery.trim()}"`
    : 'None';

  const amountRangeText = activeFilters.amountRange || 'All Amounts';
  const dateRangeText = activeFilters.dateRange || 'All Time';

  const netPositionLabel = stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT';
  const netPositionColor = stats.balance >= 0 ? '#1d4ed8' : '#c2410c';

  // Construct styled HTML table that Excel/Google Sheets open natively with full formatting
  const htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Statement</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 12px;
    color: #1e293b;
    background-color: #ffffff;
  }
  .banner-title {
    background-color: #4c1d95;
    color: #ffffff;
    font-size: 18px;
    font-weight: bold;
    padding: 12px 16px;
    text-align: left;
  }
  .sub-banner {
    background-color: #5b21b6;
    color: #ede9fe;
    font-size: 11px;
    padding: 6px 16px;
  }
  .section-header {
    background-color: #f3e8ff;
    color: #6b21a8;
    font-size: 13px;
    font-weight: bold;
    padding: 8px 12px;
    border: 1px solid #d8b4fe;
    margin-top: 15px;
  }
  .filter-table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 15px;
    font-size: 12px;
  }
  .filter-table td {
    padding: 6px 10px;
    border: 1px solid #e9d5ff;
    vertical-align: top;
  }
  .filter-label {
    font-weight: bold;
    color: #581c87;
    width: 160px;
    background-color: #faf5ff;
  }
  .filter-val {
    color: #1e1b4b;
  }
  
  .summary-grid {
    margin-bottom: 20px;
    width: 100%;
    border-collapse: collapse;
  }
  .summary-card {
    padding: 10px 14px;
    border-radius: 6px;
    text-align: center;
    border: 1px solid #cbd5e1;
  }
  .card-inflow {
    background-color: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }
  .card-outflow {
    background-color: #fff1f2;
    border-color: #fecdd3;
    color: #be123c;
  }
  .card-net {
    background-color: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
  }
  .card-val {
    font-size: 16px;
    font-weight: bold;
    margin-top: 4px;
  }
  .card-lbl {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .data-table {
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
    font-size: 12px;
  }
  .data-table th {
    background-color: #6d28d9;
    color: #ffffff;
    font-weight: 600;
    padding: 10px 8px;
    border: 1px solid #5b21b6;
    text-align: left;
    vertical-align: middle;
  }
  .data-table td {
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
    white-space: normal !important;
    word-wrap: break-word !important;
  }
  .row-even {
    background-color: #f8fafc;
  }
  .row-odd {
    background-color: #ffffff;
  }
  
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }

  .badge-income {
    color: #047857;
    font-weight: bold;
    background-color: #d1fae5;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .badge-expense {
    color: #be123c;
    font-weight: bold;
    background-color: #ffe4e6;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .badge-transfer {
    color: #1d4ed8;
    font-weight: bold;
    background-color: #dbeafe;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .amt-income {
    color: #047857;
    font-weight: bold;
  }
  .amt-expense {
    color: #be123c;
    font-weight: bold;
  }
  .amt-transfer {
    color: #1d4ed8;
    font-weight: bold;
  }

  .footer-summary td {
    background-color: #f1f5f9;
    font-weight: bold;
    border-top: 2px solid #475569;
    padding: 10px;
    color: #0f172a;
  }
</style>
</head>
<body>

  <!-- BANNER HEADER -->
  <table width="100%" cellPadding="0" cellSpacing="0" style="margin-bottom: 12px;">
    <tr>
      <td class="banner-title" colSpan="${isAdmin ? 9 : 8}">
        ${orgName.toUpperCase()} — FINANCIAL ACCOUNT STATEMENT
      </td>
    </tr>
    <tr>
      <td class="sub-banner" colSpan="${isAdmin ? 9 : 8}">
        Report Generated: ${dateStamp} at ${timeStamp} | Context: ${filenamePrefix.replace(/_/g, ' ')}
      </td>
    </tr>
  </table>

  <!-- SECTION: APPLIED FILTERS SUMMARY -->
  <div class="section-header">APPLIED FILTERS AT EXPORT TIME</div>
  <table class="filter-table">
    <tr>
      <td class="filter-label">Date Filter Period:</td>
      <td class="filter-val" colSpan="${isAdmin ? 8 : 7}">${dateRangeText}</td>
    </tr>
    <tr>
      <td class="filter-label">Categories Selected:</td>
      <td class="filter-val" colSpan="${isAdmin ? 8 : 7}">${categoryText}</td>
    </tr>
    <tr>
      <td class="filter-label">Custodians / Trustees:</td>
      <td class="filter-val" colSpan="${isAdmin ? 8 : 7}">${custodianText}</td>
    </tr>
    <tr>
      <td class="filter-label">Amount Range:</td>
      <td class="filter-val" colSpan="${isAdmin ? 8 : 7}">${amountRangeText}</td>
    </tr>
    ${isAdmin ? `
    <tr>
      <td class="filter-label">Entered By User(s):</td>
      <td class="filter-val" colSpan="8">${enteredByText}</td>
    </tr>
    ` : ''}
    <tr>
      <td class="filter-label">Search Term / Keyword:</td>
      <td class="filter-val" colSpan="${isAdmin ? 8 : 7}">${searchKeywordText}</td>
    </tr>
  </table>

  <!-- SECTION: EXECUTIVE FINANCIAL SUMMARY CARDS -->
  <div class="section-header">FINANCIAL SUMMARY (EXACT EXPORTED RECORDS)</div>
  <table class="summary-grid">
    <tr>
      <td width="25%">
        <div class="summary-card card-inflow">
          <div class="card-lbl">Total Records</div>
          <div class="card-val">${transactions.length}</div>
        </div>
      </td>
      <td width="25%">
        <div class="summary-card card-inflow">
          <div class="card-lbl">Total Inflow (Income)</div>
          <div class="card-val">₹ ${stats.income.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </td>
      <td width="25%">
        <div class="summary-card card-outflow">
          <div class="card-lbl">Total Outflow (Expense)</div>
          <div class="card-val">₹ ${stats.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </td>
      <td width="25%">
        <div class="summary-card card-net">
          <div class="card-lbl">Net Position (${netPositionLabel})</div>
          <div class="card-val" style="color: ${netPositionColor};">
            ₹ ${stats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- SECTION: TRANSACTION LEDGER TABLE WITH EXPLICIT COLUMN WIDTHS & TEXT WRAP -->
  <div class="section-header">TRANSACTION LEDGER DETAILS</div>
  <table class="data-table">
    <colgroup>
      <col style="width: 55px;" />   <!-- S.No -->
      <col style="width: 105px;" />  <!-- Date -->
      <col style="width: 105px;" />  <!-- Category -->
      <col style="width: 150px;" />  <!-- Subcategory -->
      <col style="width: 150px;" />  <!-- Custodian -->
      <col style="width: 190px;" />  <!-- Counterparty -->
      <col style="width: 125px;" />  <!-- Amount -->
      <col style="width: 260px;" />  <!-- Remarks -->
      ${isAdmin ? '<col style="width: 135px;" />' : ''} <!-- Entered By -->
    </colgroup>
    <thead>
      <tr>
        <th class="text-center">S.No.</th>
        <th class="text-center">Date</th>
        <th class="text-center">Category</th>
        <th class="text-left">Subcategory</th>
        <th class="text-left">Custodian</th>
        <th class="text-left">Counterparty</th>
        <th class="text-right">Amount (₹)</th>
        <th class="text-left">Remarks</th>
        ${isAdmin ? '<th class="text-left">Entered By</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${transactions.map((t, idx) => {
        const rawAmt = Number(t.amount) || 0;
        const isExp = t.category === 'Expense';
        const isInc = t.category === 'Income';
        
        const badgeClass = isInc ? 'badge-income' : isExp ? 'badge-expense' : 'badge-transfer';
        const amtClass   = isInc ? 'amt-income'   : isExp ? 'amt-expense'   : 'amt-transfer';
        const amtSign    = isInc ? '+' : isExp ? '-' : '↔';

        const displayAmt = `${amtSign} ₹ ${rawAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';

        return `
        <tr class="${rowClass}">
          <td class="text-center">${idx + 1}</td>
          <td class="text-center">${t.date}</td>
          <td class="text-center"><span class="${badgeClass}">${t.category}</span></td>
          <td class="text-left">${t.subcategory || '-'}</td>
          <td class="text-left">${t.custodian || '-'}</td>
          <td class="text-left">${t.counterparty || '-'}</td>
          <td class="text-right ${amtClass}">${displayAmt}</td>
          <td class="text-left">${t.remarks || '-'}</td>
          ${isAdmin ? `<td class="text-left">${t.entered_by || '-'}</td>` : ''}
        </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr class="footer-summary">
        <td class="text-center" colSpan="2">GRAND TOTALS</td>
        <td class="text-center" colSpan="4">Records Exported: ${transactions.length}</td>
        <td class="text-right" style="color: ${netPositionColor};">
          ₹ ${stats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td colSpan="${isAdmin ? 2 : 1}">
          Inflow: +₹${stats.income.toLocaleString('en-IN')} | Outflow: -₹${stats.expenses.toLocaleString('en-IN')}
        </td>
      </tr>
    </tfoot>
  </table>

</body>
</html>
  `;

  // Create downloadable Excel blob (.xls extension) which Excel & Google Sheets open natively with full styles
  const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const cleanPrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${cleanPrefix}_${dateStamp}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

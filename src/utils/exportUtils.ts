/**
 * exportUtils.ts — Executive Export Engine for KhataCloud
 *
 * Supports:
 *   1. `exportTransactionsToExcelXML`: Official Excel SpreadsheetML (XML) export.
 *      - Zero format mismatch warning when opened in Microsoft Excel!
 *      - Full rich inline styling: Deep Violet headers (#4C1D95), Green for Income, Red for Expense.
 *      - Fixed Column Widths: Exact column widths defined in Excel XML schema.
 *      - Text Wrapping: `ss:WrapText="1"` on cells so long remarks & counterparties wrap neatly.
 *      - Executive Summary Cards & Applied Filters block.
 *
 *   2. `exportTransactionsToCSV`: Universal UTF-8 CSV with Byte-Order Mark (\uFEFF).
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXCEL SPREADSHEETML (XML) EXPORT — ZERO EXCEL WARNINGS, FULL STYLING
// ─────────────────────────────────────────────────────────────────────────────
export function exportTransactionsToExcelXML({
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

  const escapeXML = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const netPositionLabel = stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT';

  // Excel SpreadsheetML Schema
  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>${escapeXML(orgName)}</Author>
  <Created>${now.toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <!-- Base Style with balanced Vertical Centering padding -->
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <!-- Header Banner -->
  <Style ss:ID="Banner">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4C1D95" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#3B0764"/>
   </Borders>
  </Style>
  <Style ss:ID="SubBanner">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#EDE9FE"/>
   <Interior ss:Color="#5B21B6" ss:Pattern="Solid"/>
  </Style>
  <!-- Section Title -->
  <Style ss:ID="SectionHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#581C87"/>
   <Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
   </Borders>
  </Style>
  <!-- Filter Label & Value -->
  <Style ss:ID="FilterLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#581C87"/>
   <Interior ss:Color="#FAF5FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F3E8FF"/>
   </Borders>
  </Style>
  <Style ss:ID="FilterVal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#1E1B4B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F3E8FF"/>
   </Borders>
  </Style>
  <!-- Executive Summary Cards -->
  <Style ss:ID="CardTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="CardInflow">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
   </Borders>
  </Style>
  <Style ss:ID="CardOutflow">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#BE123C"/>
   <Interior ss:Color="#FFF1F2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECDD3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECDD3"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECDD3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECDD3"/>
   </Borders>
  </Style>
  <Style ss:ID="CardNet">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#1D4ED8"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
  </Style>
  <!-- Table Header -->
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#6D28D9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#4C1D95"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeaderCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#6D28D9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#4C1D95"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeaderRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#6D28D9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#4C1D95"/>
   </Borders>
  </Style>
  <!-- Table Data Cells with Vertical Padding & Borders -->
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F8FAFC"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F8FAFC"/>
   </Borders>
  </Style>
  <Style ss:ID="CellIncome">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#047857"/>
   <NumberFormat ss:Format="&#34;₹&#34;#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F8FAFC"/>
   </Borders>
  </Style>
  <Style ss:ID="CellExpense">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#BE123C"/>
   <NumberFormat ss:Format="&#34;-₹&#34;#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F8FAFC"/>
   </Borders>
  </Style>
  <Style ss:ID="CellTransfer">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#1D4ED8"/>
   <NumberFormat ss:Format="&#34;₹&#34;#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F8FAFC"/>
   </Borders>
  </Style>
  <!-- Footer Totals -->
  <Style ss:ID="FooterLabel">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
  <Style ss:ID="FooterNet">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#1D4ED8"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&#34;₹&#34;#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Statement">
  <Table ss:ExpandedColumnCount="${isAdmin ? 9 : 8}">
   <!-- OPTIMIZED COLUMN WIDTHS -->
   <Column ss:Width="65"/>   <!-- S.No -->
   <Column ss:Width="110"/>  <!-- Date -->
   <Column ss:Width="115"/>  <!-- Category -->
   <Column ss:Width="160"/>  <!-- Subcategory -->
   <Column ss:Width="160"/>  <!-- Custodian -->
   <Column ss:Width="200"/>  <!-- Counterparty -->
   <Column ss:Width="140"/>  <!-- Amount -->
   <Column ss:Width="280"/>  <!-- Remarks -->
   ${isAdmin ? '<Column ss:Width="150"/>' : ''} <!-- Entered By -->

   <!-- BANNER ROW -->
   <Row ss:Height="32">
    <Cell ss:MergeAcross="${isAdmin ? 8 : 7}" ss:StyleID="Banner">
     <Data ss:Type="String"> ${escapeXML(orgName.toUpperCase())} — FINANCIAL ACCOUNT STATEMENT</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="${isAdmin ? 8 : 7}" ss:StyleID="SubBanner">
     <Data ss:Type="String"> Report Generated: ${dateStamp} at ${timeStamp} | Context: ${escapeXML(filenamePrefix.replace(/_/g, ' '))}</Data>
    </Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- APPLIED FILTERS HEADER -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="${isAdmin ? 8 : 7}" ss:StyleID="SectionHeader">
     <Data ss:Type="String"> APPLIED FILTERS AT EXPORT TIME</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="FilterLabel"><Data ss:Type="String">Date Filter Period:</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 7 : 6}" ss:StyleID="FilterVal"><Data ss:Type="String">${escapeXML(dateRangeText)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="FilterLabel"><Data ss:Type="String">Categories:</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 7 : 6}" ss:StyleID="FilterVal"><Data ss:Type="String">${escapeXML(categoryText)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="FilterLabel"><Data ss:Type="String">Custodians / Trustees:</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 7 : 6}" ss:StyleID="FilterVal"><Data ss:Type="String">${escapeXML(custodianText)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="FilterLabel"><Data ss:Type="String">Amount Range:</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 7 : 6}" ss:StyleID="FilterVal"><Data ss:Type="String">${escapeXML(amountRangeText)}</Data></Cell>
   </Row>
   ${isAdmin ? `
   <Row ss:Height="22">
    <Cell ss:StyleID="FilterLabel"><Data ss:Type="String">Entered By User(s):</Data></Cell>
    <Cell ss:MergeAcross="7" ss:StyleID="FilterVal"><Data ss:Type="String">${escapeXML(enteredByText)}</Data></Cell>
   </Row>
   ` : ''}
   <Row ss:Height="22">
    <Cell ss:StyleID="FilterLabel"><Data ss:Type="String">Search Term / Keyword:</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 7 : 6}" ss:StyleID="FilterVal"><Data ss:Type="String">${escapeXML(searchKeywordText)}</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- EXECUTIVE FINANCIAL SUMMARY CARDS -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="${isAdmin ? 8 : 7}" ss:StyleID="SectionHeader">
     <Data ss:Type="String"> FINANCIAL SUMMARY (EXACT EXPORTED RECORDS)</Data>
    </Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="1" ss:StyleID="CardTitle"><Data ss:Type="String">Total Records Exported</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CardTitle"><Data ss:Type="String">Total Income (Inflow)</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CardTitle"><Data ss:Type="String">Total Expenses (Outflow)</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 2 : 1}" ss:StyleID="CardTitle"><Data ss:Type="String">Net Position (${netPositionLabel})</Data></Cell>
   </Row>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="1" ss:StyleID="CardTitle"><Data ss:Type="Number">${transactions.length}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CardInflow"><Data ss:Type="Number">${stats.income}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CardOutflow"><Data ss:Type="Number">${stats.expenses}</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 2 : 1}" ss:StyleID="CardNet"><Data ss:Type="Number">${stats.balance}</Data></Cell>
   </Row>
   <Row ss:Height="14"/>

   <!-- DATA TABLE HEADERS -->
   <Row ss:Height="28">
    <Cell ss:StyleID="TableHeaderCenter"><Data ss:Type="String">S.No.</Data></Cell>
    <Cell ss:StyleID="TableHeaderCenter"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="TableHeaderCenter"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Subcategory</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Custodian</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Counterparty</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Amount (₹)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Remarks</Data></Cell>
    ${isAdmin ? '<Cell ss:StyleID="TableHeader"><Data ss:Type="String">Entered By</Data></Cell>' : ''}
   </Row>

   <!-- DATA ROWS WITH PADDING & BORDERS -->
   ${transactions.map((t, idx) => {
     const rawAmt = Number(t.amount) || 0;
     const isExp = t.category === 'Expense';
     const isInc = t.category === 'Income';
     const amtStyle = isInc ? 'CellIncome' : isExp ? 'CellExpense' : 'CellTransfer';
     const valAmt = isExp ? -Math.abs(rawAmt) : rawAmt;

     return `
   <Row ss:Height="24">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(t.date)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(t.category)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(t.subcategory || '-')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(t.custodian || '-')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(t.counterparty || '-')}</Data></Cell>
    <Cell ss:StyleID="${amtStyle}"><Data ss:Type="Number">${valAmt}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(t.remarks || '-')}</Data></Cell>
    ${isAdmin ? `<Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(t.entered_by || '-')}</Data></Cell>` : ''}
   </Row>`;
   }).join('')}

   <!-- GRAND TOTALS FOOTER -->
   <Row ss:Height="14"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="1" ss:StyleID="FooterLabel"><Data ss:Type="String">GRAND TOTALS</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="FooterLabel"><Data ss:Type="String">Records Exported: ${transactions.length}</Data></Cell>
    <Cell ss:StyleID="FooterNet"><Data ss:Type="Number">${stats.balance}</Data></Cell>
    <Cell ss:MergeAcross="${isAdmin ? 1 : 0}" ss:StyleID="FooterLabel">
     <Data ss:Type="String">Inflow: +₹${stats.income.toFixed(2)} | Outflow: -₹${stats.expenses.toFixed(2)}</Data>
    </Cell>
   </Row>

  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
   </PageSetup>
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>1</ActiveRow>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  // Create downloadable Excel file (.xls) — opens directly in Microsoft Excel & Google Sheets
  const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNIVERSAL STANDARD CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────
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

  const lines: string[] = [];

  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  lines.push([orgName.toUpperCase() + ' — FINANCIAL ACCOUNT STATEMENT'].map(escapeCell).join(','));
  lines.push(['Generated On:', `${dateStamp} at ${timeStamp}`].map(escapeCell).join(','));
  lines.push(['Export Context:', filenamePrefix.replace(/_/g, ' ')].map(escapeCell).join(','));
  lines.push('');

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

  lines.push('');

  lines.push(['=== FINANCIAL SUMMARY (EXPORTED RECORDS) ==='].map(escapeCell).join(','));
  lines.push(['Total Records Exported:', transactions.length].map(escapeCell).join(','));
  lines.push(['Total Income (Inflow):', `₹ ${stats.income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`].map(escapeCell).join(','));
  lines.push(['Total Expenses (Outflow):', `₹ ${stats.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`].map(escapeCell).join(','));
  
  const netLabel = stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT';
  lines.push(['Net Position:', `${netLabel}: ₹ ${stats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`].map(escapeCell).join(','));
  lines.push('');

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

  lines.push('');
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

/**
 * Static form configuration and category metadata.
 * No React state — safe to import anywhere.
 */
import type { TransactionCategory, CategoryOption, SubcategoryOption } from '../types';

// ---- Subcategory lists ----

export const incomeSubcategories = ['Donations', 'Student Fees', 'Grants', 'Other Income'];
export const expenseSubcategories = ['Salaries', 'Utilities', 'Books & Materials', 'Infrastructure', 'Other Expenses'];
export const remarkLabels = ['Deposit', 'Rent', 'Legality', 'Bathroom', 'Classroom', 'Library', 'Painting', 'Fabrication', 'Cleaning', 'Plumbing'];

// ---- Category options for Select dropdown ----

export const categoryOptions: CategoryOption[] = [
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Transfer', label: 'Transfer' },
];

// ---- Subcategory options based on current category ----

export const getSubcategoryOptions = (category: TransactionCategory): SubcategoryOption[] => {
  if (category === 'Transfer') return [];
  const list = category === 'Income' ? incomeSubcategories : expenseSubcategories;
  return list.map((sub) => ({ value: sub, label: sub }));
};

// ---- Subcategory helper checks & prepopulations ----

export const isDonorRequired = (subcategory?: string): boolean => {
  if (!subcategory) return true;
  const sub = subcategory.toLowerCase();
  if (sub.includes('donation box') || sub.includes('student fee') || sub.includes('other')) {
    return false;
  }
  return true;
};

export const getExpensePrepopulation = (subcategory?: string): string | null => {
  if (!subcategory) return null;
  const sub = subcategory.toLowerCase();
  if (sub.includes('rent')) {
    return 'Sohel Bhai (Makaan Malik)';
  }
  if (sub.includes('electric') || sub.includes('light bill')) {
    return 'Torrent Electricity Provider';
  }
  if (sub.includes('water')) {
    return 'Kaif Mugal (Drinking Water Plant - FaridBaug)';
  }
  return null;
};

// ---- Dynamic field labels based on category ----

export interface FieldLabels {
  custodianLabel: string;
  custodianPlaceholder: string;
  counterpartyLabel: string;
  counterpartyPlaceholder: string;
}

export const getFieldLabels = (category: TransactionCategory, subcategory?: string): FieldLabels => {
  switch (category) {
    case 'Income':
      return {
        custodianLabel: 'Received by',
        custodianPlaceholder: 'Trust member who received',
        counterpartyLabel: 'Donor',
        counterpartyPlaceholder: 'Name of donor',
      };
    case 'Expense': {
      const isSalary = subcategory && /salary|salaries|teacher|staff|imam/.test(subcategory.toLowerCase());
      return {
        custodianLabel: 'Paid by',
        custodianPlaceholder: 'Trust member who paid',
        counterpartyLabel: isSalary ? 'Staff Member' : 'Vendor / Payee',
        counterpartyPlaceholder: isSalary ? 'Select staff member' : 'Vendor or shop name',
      };
    }
    case 'Transfer':
      return {
        custodianLabel: 'From Trustee',
        custodianPlaceholder: 'Source trustee',
        counterpartyLabel: 'To Trustee',
        counterpartyPlaceholder: 'Destination trustee',
      };
    default:
      return {
        custodianLabel: 'Custodian',
        custodianPlaceholder: 'Trust member',
        counterpartyLabel: 'Counterparty',
        counterpartyPlaceholder: 'Other party',
      };
  }
};

// ---- Date range computation (pure — no state) ----

export type DateFilterMode = 'thisMonth' | 'selectedMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom';

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export const getDateRangeForMode = (mode: DateFilterMode, customRange?: DateRange): DateRange => {
  const today = new Date();
  
  switch (mode) {
    case 'thisMonth': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        fromDate: firstDay.toISOString().split('T')[0],
        toDate: lastDay.toISOString().split('T')[0]
      };
    }
    case 'selectedMonth':
      return customRange || { fromDate: '', toDate: '' };
    case 'thisQuarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
      const lastDay = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
      return {
        fromDate: firstDay.toISOString().split('T')[0],
        toDate: lastDay.toISOString().split('T')[0]
      };
    }
    case 'thisFiscalYear': {
      // India fiscal year: April 1 to March 31
      const fiscalYearStart = today.getMonth() >= 3 
        ? new Date(today.getFullYear(), 3, 1)
        : new Date(today.getFullYear() - 1, 3, 1);
      const fiscalYearEnd = today.getMonth() >= 3
        ? new Date(today.getFullYear() + 1, 2, 31)
        : new Date(today.getFullYear(), 2, 31);
      return {
        fromDate: fiscalYearStart.toISOString().split('T')[0],
        toDate: fiscalYearEnd.toISOString().split('T')[0]
      };
    }
    case 'allTime':
      return { fromDate: '', toDate: '' };
    default:
      return customRange || { fromDate: '', toDate: '' };
  }
};

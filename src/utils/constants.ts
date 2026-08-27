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

// ---- Dynamic field labels based on category ----

export interface FieldLabels {
  custodianLabel: string;
  custodianPlaceholder: string;
  counterpartyLabel: string;
  counterpartyPlaceholder: string;
}

export const getFieldLabels = (category: TransactionCategory): FieldLabels => {
  switch (category) {
    case 'Income':
      return {
        custodianLabel: 'Received by',
        custodianPlaceholder: 'Trust member who received',
        counterpartyLabel: 'Donor',
        counterpartyPlaceholder: 'Name of donor',
      };
    case 'Expense':
      return {
        custodianLabel: 'Paid by',
        custodianPlaceholder: 'Trust member who paid',
        counterpartyLabel: 'Vendor / Payee',
        counterpartyPlaceholder: 'Vendor or shop name',
      };
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

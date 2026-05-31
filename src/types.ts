// ============================================================
// Shared types & interfaces for HisaabKitaab
// ============================================================

export type TransactionCategory = 'Income' | 'Expense' | 'Transfer';

export interface Transaction {
  id: number;
  date: string;
  category: TransactionCategory;
  subcategory: string;
  sender: string;
  receiver: string;
  custodian: string;
  counterparty: string;
  remarks: string;
  amount: number;
  created_at?: string;
  modifieddate?: string;
}

export interface FormState {
  date: string;
  category: TransactionCategory;
  subcategory: string;
  amount: string;
  custodian: string;
  counterparty: string;
  remarks: string;
}

export const getDefaultFormState = (): FormState => ({
  date: new Date().toISOString().split('T')[0],
  category: 'Income',
  subcategory: 'Donations',
  amount: '',
  custodian: '',
  counterparty: '',
  remarks: '',
});

export interface CategoryOption {
  value: TransactionCategory;
  label: string;
}

export interface SubcategoryOption {
  value: string;
  label: string;
}

export interface TrusteeOption {
  value: string;
  label: string;
}

export interface Entity {
  id: number;
  entity_name: string;
  entity_type: 'trustee' | 'donor' | 'vendor' | 'other';
  IsDeleted: string;
  ModifiedDate: string | null;
  IsTrial: string;
  created_at: string;
}

export interface UserTypeOption {
  value: 'admin' | 'trial';
  label: string;
}

export type ColorPalette = 'indigo' | 'blue' | 'purple' | 'emerald' | 'rose';
export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  palette: ColorPalette;
}

export interface ColumnFilter {
  textFilter: string;
  textOperator: 'contains' | 'equals' | 'starts' | 'ends';
  selectedValues: string[];
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export const defaultColumnFilter: ColumnFilter = {
  textFilter: '',
  textOperator: 'contains',
  selectedValues: [],
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

/**
 * Pure calculation utilities for transaction data.
 * No React state, no side effects — safe to import anywhere.
 */
import type { Transaction, TransactionCategory } from '../types';

export interface Stats {
  income: number;
  expenses: number;
  balance: number;
  transfers: number;
}

export interface BreakdownRow {
  sub: string;
  total: number;
  count: number;
}

export interface TrusteeLedgerEntry {
  trustee: string;
  incomeCollected: number;
  expensesPaid: number;
  transfersIn: number;
  transfersOut: number;
  netPosition: number;
}

/** Calculate income, expenses, balance, and transfers from a list of transactions */
export const calculateStats = (trans: Transaction[]): Stats => {
  const income = trans
    .filter(t => t.category === 'Income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  
  const expenses = trans
    .filter(t => t.category === 'Expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const transfers = trans
    .filter(t => t.category === 'Transfer')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  return { income, expenses, balance: income - expenses, transfers };
};

/** Get subcategory-wise breakdown for a given category */
export const getCategoryBreakdown = (transList: Transaction[], category: TransactionCategory): BreakdownRow[] => {
  return transList
    .filter((t: Transaction) => t.category === category)
    .reduce<BreakdownRow[]>((acc, t) => {
      // For Transfer, use 'Reimbursement' as the subcategory label since it has no subcategory
      const subKey = t.subcategory || 'Reimbursement';
      const existing = acc.find((x) => x.sub === subKey);
      if (existing) {
        existing.total += (Number(t.amount) || 0);
        existing.count += 1;
      } else {
        acc.push({ sub: subKey, total: (Number(t.amount) || 0), count: 1 });
      }
      return acc;
    }, [])
    .sort((a, b) => b.total - a.total);
};

/** Get total transfer amount */
export const getTransferTotal = (transList: Transaction[]): number => {
  return transList
    .filter(t => t.category === 'Transfer')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
};

/** Get per-trustee fund ledger with net position */
export const getTrusteeLedger = (transList: Transaction[]): TrusteeLedgerEntry[] => {
  const ledger = new Map<string, { incomeCollected: number; expensesPaid: number; transfersIn: number; transfersOut: number }>();

  const ensureTrustee = (name: string) => {
    if (!ledger.has(name)) {
      ledger.set(name, { incomeCollected: 0, expensesPaid: 0, transfersIn: 0, transfersOut: 0 });
    }
  };

  transList.forEach((t) => {
    const custodian = t.custodian || 'Unassigned';
    ensureTrustee(custodian);
    const entry = ledger.get(custodian)!;

    if (t.category === 'Income') entry.incomeCollected += (Number(t.amount) || 0);
    if (t.category === 'Expense') entry.expensesPaid += (Number(t.amount) || 0);
    if (t.category === 'Transfer') {
      entry.transfersOut += (Number(t.amount) || 0);
      // Also credit the destination trustee
      const dest = t.counterparty || 'Unassigned';
      ensureTrustee(dest);
      ledger.get(dest)!.transfersIn += (Number(t.amount) || 0);
    }
  });

  return Array.from(ledger.entries()).map(([trustee, data]) => ({
    trustee,
    ...data,
    netPosition: data.incomeCollected - data.expensesPaid + data.transfersIn - data.transfersOut,
  }));
};

/**
 * CategoryBreakdownView.tsx — Pure analytics view
 *
 * Extracted from FinancialReports.tsx. Renders the Income/Expense
 * subcategory breakdown grids with progress bars.
 * Pure component: no fetching, no internal state beyond what's computed.
 */
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Transaction, Theme } from '../../types';
import type { Stats } from '../../utils/calculations';
import { getCategoryBreakdown, getTransferTotal, getTrusteeLedger } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  filteredTransactions: Transaction[];
  stats: Stats;
  theme: Theme;
}

export default function CategoryBreakdownView({ filteredTransactions, stats, theme: _theme }: Props) {
  const incomeBreakdown  = getCategoryBreakdown(filteredTransactions, 'Income');
  const expenseBreakdown = getCategoryBreakdown(filteredTransactions, 'Expense');
  const transferTotal    = getTransferTotal(filteredTransactions);
  const trusteeLedger    = getTrusteeLedger(filteredTransactions);

  return (
    <div className="space-y-6">
      {/* Category-wise Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400 flex items-center gap-2">
            <TrendingUp size={20} /> Income Breakdown by Category
          </h3>
          {incomeBreakdown.length > 0 ? (
            <div className="space-y-2">
              {incomeBreakdown.map((item) => {
                const pct = stats.income > 0 ? (item.total / stats.income * 100).toFixed(1) : 0;
                return (
                  <div key={item.sub} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(34,197,94,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(34,197,94,0.3)] transition-all duration-300">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                      <span className="font-bold text-green-600 dark:text-green-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                      <div className="bg-green-600 dark:bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {pct}% of total income – {item.count} transaction{item.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-4">No income transactions in selected period</p>
          )}
        </div>

        {/* Expense */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
            <TrendingDown size={20} /> Expense Breakdown by Category
          </h3>
          {expenseBreakdown.length > 0 ? (
            <div className="space-y-2">
              {expenseBreakdown.map((item) => {
                const pct = stats.expenses > 0 ? (item.total / stats.expenses * 100).toFixed(1) : 0;
                return (
                  <div key={item.sub} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(239,68,68,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition-all duration-300">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                      <span className="font-bold text-red-600 dark:text-red-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2">
                      <div className="bg-red-600 dark:bg-red-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {pct}% of total expenses – {item.count} transaction{item.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-4">No expense transactions in selected period</p>
          )}
        </div>
      </div>

      {/* Transfer Summary */}
      {transferTotal > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400 flex items-center gap-2">
            ↔ Transfer Summary
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-600 dark:border-blue-700 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)]">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Total Internal Transfers</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {filteredTransactions.filter(t => t.category === 'Transfer').length} transaction(s)
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(transferTotal)}
              </p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
              Transfers are internal fund movements between trustees and don't affect the income/expense balance.
            </p>
          </div>
        </div>
      )}

      {/* Trustee Ledger */}
      <div>
        <h3 className="text-lg font-bold mb-3 text-indigo-700 dark:text-indigo-400">Trustee Ledger</h3>
        {trusteeLedger.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No trustee data for this period.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trusteeLedger.map((item) => (
              <div
                key={item.trustee}
                className="rounded-lg border border-gray-200 dark:border-gray-900 bg-white dark:bg-black p-4 shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trustee</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{item.trustee}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.netPosition >= 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  }`}>
                    {item.netPosition >= 0 ? 'Surplus' : 'Deficit'}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Income Collected</span>
                    <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(item.incomeCollected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Expenses Paid</span>
                    <span className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(item.expensesPaid)}</span>
                  </div>
                  {(item.transfersIn > 0 || item.transfersOut > 0) && (
                    <>
                      {item.transfersIn > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Transfers In</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">+{formatCurrency(item.transfersIn)}</span>
                        </div>
                      )}
                      {item.transfersOut > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Transfers Out</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">-{formatCurrency(item.transfersOut)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Net Position</span>
                    <span className={`font-bold ${item.netPosition >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                      {formatCurrency(item.netPosition)}
                    </span>
                  </div>
                </div>
                {item.netPosition < 0 && (
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                    Trustee has spent beyond available funds. Transfer from surplus trustee advised.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

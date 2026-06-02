import { Download, Edit, ChevronUp, ChevronDown, X, Filter, Search } from 'lucide-react';
import type { Transaction, TrusteeOption } from '../types';
import { defaultColumnFilter } from '../types';
import FilterPopupComponent from './FilterPopup';
import useTableState from '../hooks/useTableState';
import { formatCurrency, formatDisplayDate } from '../utils/formatters';

interface TransactionTableProps {
  transactions: Transaction[];
  trusteeOptions: TrusteeOption[];
  isLoadingData: boolean;
  isSyncing: boolean;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  onExportCSV: () => void;
}

export default function TransactionTable({
  transactions,
  trusteeOptions,
  isLoadingData,
  isSyncing,
  onEditTransaction,
  onDeleteTransaction,
  onExportCSV,
}: TransactionTableProps) {
  const table = useTableState({ transactions, trusteeOptions });

  // FilterPopup bridge � maps hook state to FilterPopupComponent props
  const FilterPopup = ({ column, label }: { column: string; label: string }) => {
    if (table.openFilterPopup !== column) return null;
    return (
      <FilterPopupComponent
        column={column}
        label={label}
        filter={table.columnFilters[column]}
        uniqueValues={table.getUniqueColumnValues(column as keyof Transaction)}
        sortColumn={table.sortColumn}
        sortDirection={table.sortDirection}
        hasActiveFilter={table.columnHasActiveFilter(column)}
        onClose={table.closeFilterPopup}
        onUpdateFilter={table.updateFilter}
        onSort={table.handleSort}
        onSortDescending={table.handleSortDescending}
        onClearFilter={(col) => table.updateFilter(col, defaultColumnFilter)}
      />
    );
  };

  return (
    <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Showing {table.filteredTransactions.length} of {transactions.length} transaction{table.filteredTransactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search transactions..."
              value={table.searchQuery}
              onChange={(e) => table.setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all shadow-sm"
            />
            {table.searchQuery && (
              <button
                onClick={() => table.setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {table.hasActiveFilters() && (
              <button
                onClick={table.clearAllFilters}
                className="bg-gray-500 dark:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600 dark:hover:bg-gray-700 text-sm"
              >
                <X size={16} /> Clear Filters
              </button>
            )}
            <button
              onClick={onExportCSV}
              className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600 text-sm"
            >
              <Download size={18} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter for View Tab */}


      {isLoadingData ? (
        <p className="text-gray-500 text-center py-8">Loading transactions...</p>
      ) : table.filteredTransactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-4 -mx-6 md:mx-0 px-4 md:px-0">
            <table className="w-full min-w-[800px] md:min-w-0">
              <thead className="bg-gray-100">
                <tr>
                  {/* Date Column */}
                  <th className="px-4 py-3 text-left relative">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => table.handleSort('date')}
                        className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                      >
                        Date
                        {table.sortColumn === 'date' ? (
                          table.sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                      <button
                        onClick={(e) => table.toggleFilterPopup('date', e)}
                        className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('date') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Date"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'date' && (
                      <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                        <FilterPopup column="date" label="Date" />
                      </div>
                    )}
                  </th>
                  {/* Category Column */}
                  <th className="px-4 py-3 text-left relative">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => table.handleSort('category')}
                        className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                      >
                        Category
                        {table.sortColumn === 'category' ? (
                          table.sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                      <button
                        onClick={(e) => table.toggleFilterPopup('category', e)}
                        className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('category') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Category"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'category' && (
                      <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                        <FilterPopup column="category" label="Category" />
                      </div>
                    )}
                  </th>
                  {/* Subcategory Column */}
                  <th className="px-4 py-3 text-left relative">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => table.handleSort('subcategory')}
                        className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                      >
                        Subcategory
                        {table.sortColumn === 'subcategory' ? (
                          table.sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                      <button
                        onClick={(e) => table.toggleFilterPopup('subcategory', e)}
                        className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('subcategory') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Subcategory"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'subcategory' && (
                      <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                        <FilterPopup column="subcategory" label="Subcategory" />
                      </div>
                    )}
                  </th>
                  {/* Custodian Column */}
                  <th className="px-4 py-3 text-left relative">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => table.handleSort('custodian')}
                        className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                      >
                        Custodian
                        {table.sortColumn === 'custodian' ? (
                          table.sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                      <button
                        onClick={(e) => table.toggleFilterPopup('custodian', e)}
                        className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('custodian') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Custodian"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'custodian' && (
                      <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                        <FilterPopup column="custodian" label="Custodian" />
                      </div>
                    )}
                  </th>
                  {/* Counterparty Column */}
                  <th className="px-4 py-3 text-left relative">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => table.handleSort('counterparty')}
                        className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                      >
                        Counterparty
                        {table.sortColumn === 'counterparty' ? (
                          table.sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                      <button
                        onClick={(e) => table.toggleFilterPopup('counterparty', e)}
                        className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('counterparty') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Counterparty"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'counterparty' && (
                      <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                        <FilterPopup column="counterparty" label="Counterparty" />
                      </div>
                    )}
                  </th>
                  {/* Amount Column */}
                  <th className="px-4 py-3 text-right relative">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => table.handleSort('amount')}
                        className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                      >
                        Amount
                        {table.sortColumn === 'amount' ? (
                          table.sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                      <button
                        onClick={(e) => table.toggleFilterPopup('amount', e)}
                        className={`filter-button p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('amount') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Amount"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'amount' && (
                      <div className="absolute right-0 md:right-0 left-0 md:left-auto top-full mt-1">
                        <FilterPopup column="amount" label="Amount" />
                      </div>
                    )}
                  </th>
                  {/* Remarks Column */}
                  <th className="px-4 py-3 text-left relative">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Remarks</span>
                      <button
                        onClick={(e) => table.toggleFilterPopup('remarks', e)}
                        className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${table.columnHasActiveFilter('remarks') ? 'text-indigo-600' : 'text-gray-400'}`}
                        title="Filter"
                        aria-label="Filter by Remarks"
                      >
                        <Filter size={16} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                    {table.openFilterPopup === 'remarks' && (
                      <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                        <FilterPopup column="remarks" label="Remarks" />
                      </div>
                    )}
                  </th>
                  {/* Action Column */}
                  <th className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.paginatedTransactions.map(t => (
                  <tr key={t.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(t.date)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        t.category === 'Income' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                          : t.category === 'Transfer'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                        }`}>
                        {t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{t.subcategory || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{t.custodian}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{t.counterparty}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      <span className={
                        t.category === 'Income' 
                          ? 'text-green-600 dark:text-green-400' 
                          : t.category === 'Transfer'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-red-600 dark:text-red-400'
                      }>
                        {t.category === 'Income' ? '+' : t.category === 'Transfer' ? '↔' : '-'}{formatCurrency(Number(t.amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{t.remarks || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => onEditTransaction(t)}
                          disabled={isSyncing}
                          className={`text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold text-sm flex items-center gap-1 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Edit transaction"
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          disabled={isSyncing}
                          className={`text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-semibold text-sm transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Delete transaction"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {table.totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {table.currentPage} of {table.totalPages} ({table.filteredTransactions.length} transactions)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => table.setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={table.currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${table.currentPage === 1
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
                    }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => table.setCurrentPage(prev => Math.min(table.totalPages, prev + 1))}
                  disabled={table.currentPage === table.totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${table.currentPage === table.totalPages
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
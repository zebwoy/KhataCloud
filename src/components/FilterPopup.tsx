import { X, Check } from 'lucide-react';
import Select from 'react-select';
import type { ColumnFilter } from '../types';

interface FilterPopupProps {
  column: string;
  label: string;
  filter: ColumnFilter;
  uniqueValues: string[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  hasActiveFilter: boolean;
  onClose: () => void;
  onUpdateFilter: (column: string, updates: Partial<ColumnFilter>) => void;
  onSort: (column: string) => void;
  onSortDescending: (column: string) => void;
  onClearFilter: (column: string) => void;
}

export default function FilterPopup({
  column,
  label,
  filter,
  uniqueValues,
  sortColumn,
  sortDirection,
  hasActiveFilter,
  onClose,
  onUpdateFilter,
  onSort,
  onSortDescending,
  onClearFilter,
}: FilterPopupProps) {
  const isDateColumn = column === 'date';
  const isAmountColumn = column === 'amount';
  const isTextColumn = !isDateColumn && !isAmountColumn;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
      />
      <div className="filter-popup fixed md:absolute z-50 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] w-[calc(100vw-2rem)] max-w-sm md:w-80 md:max-w-none max-h-[80vh] md:max-h-96 overflow-y-auto top-1/2 md:top-full left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 md:translate-y-0 -translate-y-1/2 md:mt-1">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filter by {label}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Sort Options */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Sort</p>
          <div className="space-y-1">
            <button
              onClick={() => {
                onSort(column);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-between text-gray-900 dark:text-gray-100"
            >
              <span>Sort A to Z</span>
              {sortColumn === column && sortDirection === 'asc' && (
                <Check size={14} className="text-indigo-600" />
              )}
            </button>
            <button
              onClick={() => {
                onSortDescending(column);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-between text-gray-900 dark:text-gray-100"
            >
              <span>Sort Z to A</span>
              {sortColumn === column && sortDirection === 'desc' && (
                <Check size={14} className="text-indigo-600" />
              )}
            </button>
          </div>
        </div>

        {/* Text Filter */}
        {isTextColumn && (
          <>
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Text Filters</p>
              <Select
                unstyled
                value={{ value: filter.textOperator, label: filter.textOperator.charAt(0).toUpperCase() + filter.textOperator.slice(1) }}
                onChange={(option) => onUpdateFilter(column, { textOperator: (option?.value || 'contains') as any })}
                options={[
                  { value: 'contains', label: 'Contains' },
                  { value: 'equals', label: 'Equals' },
                  { value: 'starts', label: 'Starts with' },
                  { value: 'ends', label: 'Ends with' },
                ]}
                className="text-xs mb-2"
                classNames={{
                  control: ({ isFocused }) =>
                    `flex items-center justify-between px-3 py-1.5 bg-white dark:bg-gray-900 border ${
                      isFocused ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-300 dark:border-gray-700'
                    } rounded-lg text-xs text-gray-900 dark:text-gray-100 transition-all cursor-pointer`,
                  menu: () => 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg mt-1 overflow-hidden z-50 text-xs',
                  option: ({ isFocused, isSelected }) =>
                    `px-3 py-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-semibold'
                        : isFocused
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300'
                    }`,
                  singleValue: () => 'text-gray-900 dark:text-gray-100',
                  indicatorsContainer: () => 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
                  dropdownIndicator: () => 'p-0 ml-1',
                }}
              />
              <input
                type="text"
                placeholder={`Filter ${label.toLowerCase()}...`}
                value={filter.textFilter}
                onChange={(e) => onUpdateFilter(column, { textFilter: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Multi-select for unique values */}
            {uniqueValues.length > 0 && uniqueValues.length <= 50 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Select values</p>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1">
                  {uniqueValues.map((value) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filter.selectedValues.includes(value)}
                        onChange={(e) => {
                          const newValues = e.target.checked
                            ? [...filter.selectedValues, value]
                            : filter.selectedValues.filter(v => v !== value);
                          onUpdateFilter(column, { selectedValues: newValues });
                        }}
                        className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-700 dark:bg-gray-900 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Date Range Filter */}
        {isDateColumn && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Date Range</p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">From</label>
                <input
                  type="date"
                  value={filter.dateFrom}
                  onChange={(e) => onUpdateFilter(column, { dateFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">To</label>
                <input
                  type="date"
                  value={filter.dateTo}
                  onChange={(e) => onUpdateFilter(column, { dateTo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Amount Range Filter */}
        {isAmountColumn && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Amount Range</p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Minimum</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filter.amountMin}
                  onChange={(e) => onUpdateFilter(column, { amountMin: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Maximum</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filter.amountMax}
                  onChange={(e) => onUpdateFilter(column, { amountMax: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Clear Filter Button */}
        {hasActiveFilter && (
          <button
            onClick={() => onClearFilter(column)}
            className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg font-semibold"
          >
            Clear Filter
          </button>
        )}
      </div>
    </div>
    </>
  );
}

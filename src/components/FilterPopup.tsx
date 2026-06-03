import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
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

  // Local state to store draft edits before clicking "Apply"
  const [localFilter, setLocalFilter] = useState<ColumnFilter>({ ...filter });

  // Keep local state in sync if parent filter changes
  useEffect(() => {
    setLocalFilter({ ...filter });
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleApply = () => {
    onUpdateFilter(column, localFilter);
    onClose();
  };

  const handleClear = () => {
    onClearFilter(column);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
      />
      <div className="filter-popup fixed md:absolute z-50 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-xl shadow-2xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] w-[calc(100vw-2rem)] max-w-sm md:w-80 md:max-w-none max-h-[85vh] md:max-h-[500px] overflow-y-auto top-1/2 md:top-full left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 md:translate-y-0 -translate-y-1/2 md:mt-2 transition-all">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Filter {label}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Sort Options */}
          <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Sort</p>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onSort(column);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg flex items-center justify-between text-gray-900 dark:text-gray-100 transition-colors"
              >
                <span>Sort A to Z (Ascending)</span>
                {sortColumn === column && sortDirection === 'asc' && (
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
              <button
                onClick={() => {
                  onSortDescending(column);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg flex items-center justify-between text-gray-900 dark:text-gray-100 transition-colors"
              >
                <span>Sort Z to A (Descending)</span>
                {sortColumn === column && sortDirection === 'desc' && (
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            </div>
          </div>

          {/* Text Filter */}
          {isTextColumn && (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Text Filters</p>
                <Select
                  unstyled
                  value={{ value: localFilter.textOperator, label: localFilter.textOperator.charAt(0).toUpperCase() + localFilter.textOperator.slice(1) }}
                  onChange={(option) => setLocalFilter({ ...localFilter, textOperator: (option?.value || 'contains') as any })}
                  options={[
                    { value: 'contains', label: 'Contains' },
                    { value: 'equals', label: 'Equals' },
                    { value: 'starts', label: 'Starts with' },
                    { value: 'ends', label: 'Ends with' },
                  ]}
                  className="text-xs mb-2"
                  classNames={{
                    control: ({ isFocused }) =>
                      `flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 border ${
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
                  value={localFilter.textFilter}
                  onChange={(e) => setLocalFilter({ ...localFilter, textFilter: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all"
                />
              </div>

              {/* Multi-select for unique values */}
              {uniqueValues.length > 0 && uniqueValues.length <= 50 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Select values</p>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-2 space-y-1 bg-gray-50/50 dark:bg-black/20">
                    {uniqueValues.map((value) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={localFilter.selectedValues.includes(value)}
                          onChange={(e) => {
                            const newValues = e.target.checked
                              ? [...localFilter.selectedValues, value]
                              : localFilter.selectedValues.filter(v => v !== value);
                            setLocalFilter({ ...localFilter, selectedValues: newValues });
                          }}
                          className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-700 dark:bg-gray-900 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{value || '(Blank)'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Date Range Filter */}
          {isDateColumn && (
            <div className="flex flex-col items-center">
              <p className="w-full text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 font-semibold">Date Range</p>
              
              <div className="w-full flex justify-center mb-3 react-datepicker-inline-container bg-gray-50 dark:bg-black/40 border border-gray-150 dark:border-gray-800/80 rounded-xl p-2">
                <DatePicker
                  selectsRange={true}
                  startDate={localFilter.dateFrom ? new Date(localFilter.dateFrom) : null}
                  endDate={localFilter.dateTo ? new Date(localFilter.dateTo) : null}
                  onChange={(update: [Date | null, Date | null]) => {
                    const [start, end] = update;
                    setLocalFilter({
                      ...localFilter,
                      dateFrom: start ? start.toISOString().split('T')[0] : '',
                      dateTo: end ? end.toISOString().split('T')[0] : '',
                    });
                  }}
                  inline
                  dateFormat="yyyy-MM-dd"
                />
              </div>

              {localFilter.dateFrom && (
                <div className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-150 dark:border-gray-800 rounded-lg text-xs text-center text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  {localFilter.dateFrom} {localFilter.dateTo ? ` to ${localFilter.dateTo}` : ' (select end date)'}
                </div>
              )}
            </div>
          )}

          {/* Amount Range Filter */}
          {isAmountColumn && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Amount Range</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Minimum</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={localFilter.amountMin}
                    onChange={(e) => setLocalFilter({ ...localFilter, amountMin: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Maximum</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={localFilter.amountMax}
                    onChange={(e) => setLocalFilter({ ...localFilter, amountMax: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons: Apply / Clear */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-lg font-semibold shadow transition-all flex items-center justify-center gap-1.5"
            >
              Apply Filter
            </button>
            {(hasActiveFilter || localFilter.textFilter || localFilter.dateFrom || localFilter.dateTo || localFilter.amountMin || localFilter.amountMax || localFilter.selectedValues.length > 0) && (
              <button
                onClick={handleClear}
                className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg font-semibold transition-colors"
                title="Clear filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

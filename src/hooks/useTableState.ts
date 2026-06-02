import { useState, useEffect, useCallback } from 'react';
import type { Transaction, ColumnFilter, TrusteeOption } from '../types';
import { defaultColumnFilter } from '../types';

interface UseTableStateOptions {
  transactions: Transaction[];
  trusteeOptions: TrusteeOption[];
}

export default function useTableState({ transactions, trusteeOptions }: UseTableStateOptions) {
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({
    date: { ...defaultColumnFilter },
    category: { ...defaultColumnFilter },
    subcategory: { ...defaultColumnFilter },
    custodian: { ...defaultColumnFilter },
    counterparty: { ...defaultColumnFilter },
    amount: { ...defaultColumnFilter },
    remarks: { ...defaultColumnFilter },
  });
  const [openFilterPopup, setOpenFilterPopup] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Close filter popup on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openFilterPopup && !(event.target as Element).closest('.filter-popup, .filter-button')) {
        setOpenFilterPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFilterPopup]);

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Apply column filters + sorting + global search to transactions
  const getFilteredTransactions = useCallback((): Transaction[] => {
    let filtered = [...transactions];

    // Apply global search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => {
        return (
          String(t.date || '').toLowerCase().includes(lowerQuery) ||
          String(t.category || '').toLowerCase().includes(lowerQuery) ||
          String(t.subcategory || '').toLowerCase().includes(lowerQuery) ||
          String(t.custodian || '').toLowerCase().includes(lowerQuery) ||
          String(t.counterparty || '').toLowerCase().includes(lowerQuery) ||
          String(t.remarks || '').toLowerCase().includes(lowerQuery) ||
          String(t.amount || '').toLowerCase().includes(lowerQuery)
        );
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, filter]) => {
      const columnKey = column as keyof Transaction;
      
      // Text filter
      if (filter.textFilter.trim()) {
        const lowerFilter = filter.textFilter.toLowerCase();
        filtered = filtered.filter(t => {
          const value = String(t[columnKey] || '').toLowerCase();
          switch (filter.textOperator) {
            case 'equals':
              return value === lowerFilter;
            case 'starts':
              return value.startsWith(lowerFilter);
            case 'ends':
              return value.endsWith(lowerFilter);
            case 'contains':
            default:
              return value.includes(lowerFilter);
          }
        });
      }

      // Multi-select filter
      if (filter.selectedValues.length > 0) {
        filtered = filtered.filter(t => {
          const value = String(t[columnKey] || '');
          return filter.selectedValues.includes(value);
        });
      }

      // Date range filter
      if (column === 'date') {
        if (filter.dateFrom) {
          filtered = filtered.filter(t => t.date >= filter.dateFrom);
        }
        if (filter.dateTo) {
          filtered = filtered.filter(t => t.date <= filter.dateTo);
        }
      }

      // Amount range filter
      if (column === 'amount') {
        if (filter.amountMin) {
          const min = Number(filter.amountMin);
          if (!isNaN(min)) {
            filtered = filtered.filter(t => Number(t.amount) >= min);
          }
        }
        if (filter.amountMax) {
          const max = Number(filter.amountMax);
          if (!isNaN(max)) {
            filtered = filtered.filter(t => Number(t.amount) <= max);
          }
        }
      }
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof Transaction];
      let bVal: any = b[sortColumn as keyof Transaction];

      if (sortColumn === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortColumn === 'amount') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  }, [transactions, columnFilters, sortColumn, sortDirection, searchQuery]);

  const filteredTransactions = getFilteredTransactions();
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = useCallback((column: string) => {
    setSortColumn(prev => {
      if (prev === column) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection('desc');
      return column;
    });
    setCurrentPage(1);
  }, []);

  const handleSortDescending = useCallback((column: string) => {
    setSortColumn(prev => {
      if (prev === column) {
        setSortDirection('desc');
        return prev;
      }
      setSortDirection('desc');
      return column;
    });
    setCurrentPage(1);
  }, []);

  const updateFilter = useCallback((column: string, updates: Partial<ColumnFilter>) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: { ...prev[column], ...updates }
    }));
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({
      date: { ...defaultColumnFilter },
      category: { ...defaultColumnFilter },
      subcategory: { ...defaultColumnFilter },
      custodian: { ...defaultColumnFilter },
      counterparty: { ...defaultColumnFilter },
      amount: { ...defaultColumnFilter },
      remarks: { ...defaultColumnFilter },
    });
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = useCallback(() => {
    return searchQuery.trim() !== '' || Object.values(columnFilters).some(filter => 
      filter.textFilter.trim() !== '' ||
      filter.selectedValues.length > 0 ||
      filter.dateFrom !== '' ||
      filter.dateTo !== '' ||
      filter.amountMin !== '' ||
      filter.amountMax !== ''
    );
  }, [columnFilters, searchQuery]);

  const toggleFilterPopup = useCallback((column: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.stopPropagation();
    }
    setOpenFilterPopup(prev => prev === column ? null : column);
  }, []);

  const closeFilterPopup = useCallback(() => {
    setOpenFilterPopup(null);
  }, []);

  // Get unique values for a column (for multi-select filters)
  const getUniqueColumnValues = useCallback((column: keyof Transaction): string[] => {
    // For custodian column, use trustee entities
    if (column === 'custodian') {
      return trusteeOptions.map(opt => opt.value).sort();
    }
    
    // For other columns, extract unique values from transactions
    const values = new Set<string>();
    transactions.forEach(t => {
      const value = String(t[column] || '').trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  }, [transactions, trusteeOptions]);

  // Check if a specific column has active filters
  const columnHasActiveFilter = useCallback((column: string): boolean => {
    const filter = columnFilters[column];
    if (!filter) return false;
    return (
      filter.textFilter.trim() !== '' ||
      filter.selectedValues.length > 0 ||
      filter.dateFrom !== '' ||
      filter.dateTo !== '' ||
      filter.amountMin !== '' ||
      filter.amountMax !== ''
    );
  }, [columnFilters]);

  return {
    // State
    columnFilters,
    openFilterPopup,
    setOpenFilterPopup,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    searchQuery,
    
    // Computed
    filteredTransactions,
    totalPages,
    paginatedTransactions,

    // Actions
    handleSort,
    handleSortDescending,
    updateFilter,
    clearAllFilters,
    hasActiveFilters,
    toggleFilterPopup,
    closeFilterPopup,
    getUniqueColumnValues,
    columnHasActiveFilter,
    setCurrentPage,
    setSortColumn,
    setSortDirection,
    setSearchQuery,
  };
}

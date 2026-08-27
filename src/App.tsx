import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { trackAction } from './lib/trailTracker';
import { SingleValue } from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';

import type {
  Transaction,
  FormState,
  CategoryOption,
  SubcategoryOption,
  TrusteeOption,
  Entity,
} from './types';
import { getDefaultFormState } from './types';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import FinancialReports from './components/FinancialReports';
import TransactionTable from './components/TransactionTable';
import TransactionForm from './components/TransactionForm';
import SuperAdminDashboard from './components/SuperAdmin/SuperAdminDashboard';
import useTheme from './hooks/useTheme';
import useAuth from './hooks/useAuth';
import { formatCurrency, formatDisplayDateShort } from './utils/formatters';
import { calculateStats } from './utils/calculations';
import { exportTransactionsToCSV } from './utils/exportUtils';
import {
  getSubcategoryOptions, getFieldLabels,
  getDateRangeForMode,
  type DateFilterMode,
} from './utils/constants';
import type { NoticeboardConfig } from '../api/org-config';

const apiFetch = async (url: string, options: RequestInit = {}) => {
  // Prefer a live Clerk token (exposed by OrgAppShell when in saas mode).
  // This ensures we never send an expired JWT — Clerk tokens expire in ~60 s.
  let token: string | null = null;
  const clerkGetter = (window as any).__getClerkToken as (() => Promise<string | null>) | undefined;
  if (clerkGetter) {
    try { token = await clerkGetter(); } catch { /* fall through */ }
  }
  if (!token) token = sessionStorage.getItem('kc_auth_token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  let res = await fetch(url, { ...options, headers });

  // If 401 Unauthorized occurs, try getting a fresh Clerk token and retry once
  if (res.status === 401 && clerkGetter) {
    try {
      const freshToken = await clerkGetter();
      if (freshToken && freshToken !== token) {
        sessionStorage.setItem('kc_auth_token', freshToken);
        const retryHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${freshToken}`,
        };
        res = await fetch(url, { ...options, headers: retryHeaders });
      }
    } catch { /* ignore retry errors */ }
  }

  return res;
};

export default function AccountingSystem({
  saasMode = false,
  onSignOut,
  initialTab,
  navStyle = 'pill',
  onReady,
  isAdmin = false,
}: {
  saasMode?:   boolean;
  onSignOut?:  () => void;
  initialTab?: string;           // 'view' | 'add' | 'report' — from FloatingNavBar
  navStyle?:   'pill' | 'classic'; // 'pill' = sub-menu handles view/add; 'classic' = inline toggle
  onReady?:    () => void;       // called once when initial data fetch completes
  isAdmin?:    boolean;          // org admin — unlocks 'Entered By' column + filter
} = {}) {
  // Auth state + handlers (login, logout, user type selection)
  const {
    isLoggedIn,
    userType,
    displayTitle,
    handleLogout,
  } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormState>(getDefaultFormState());
  // In saasMode default to 'view'; otherwise 'add'
  const [activeTab, setActiveTab] = useState(saasMode ? (initialTab ?? 'view') : 'add');

  // Sync initialTab prop changes from FloatingNavBar / RootApp to internal activeTab
  // NOTE: do NOT call handleCancelEdit here — it is defined at line ~605 (const, not hoisted).
  // Calling it from this useEffect at line ~75 hits the temporal dead zone and silently
  // aborts the effect before setActiveTab ever runs.
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [initialTab]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataError, setDataError] = useState('');
  const [trusteeFilter, setTrusteeFilter] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [showSuccessAck, setShowSuccessAck] = useState(false);
  const successTimer = useRef<number | null>(null);
  const hasCalledReady = useRef(false);

  interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
  }
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);
  const [playSoundOnSuccess, setPlaySoundOnSuccess] = useState(true);
  const [trusteeOptions, setTrusteeOptions] = useState<TrusteeOption[]>([]);
  const [isInitializing, setIsInitializing] = useState(() => {
    // Start as initializing if:
    // a) saasMode is true (always wait for Clerk / data fetch before ready)
    // b) Already logged in (prevents showing stale data on page refresh), OR
    // c) On /trial without a token — auto-trial is about to fire.
    if (saasMode) return true;
    const isTrialPending =
      window.location.pathname === '/trial' &&
      !sessionStorage.getItem('kc_auth_token');
    return isTrialPending || sessionStorage.getItem('kc_logged_in') === 'true';
  });

  
  // Saved senders state (loaded from server)
  const [savedCounterparties, setSavedCounterparties] = useState<string[]>([]);
  const [showCounterpartyDropdown, setShowCounterpartyDropdown] = useState(false);

  // Org noticeboard config (from /api/org-config)
  const DEFAULT_ORG_CONFIG: NoticeboardConfig = {
    publicMessage: null,
    donationLink: null,
    hiddenSubcategories: [],
    customIncomeSubcats: null,
    customExpenseSubcats: null,
  };
  const [orgConfig, setOrgConfig] = useState<NoticeboardConfig>(DEFAULT_ORG_CONFIG);
  
  // Date range filter state
  const [dateRange, setDateRange] = useState({
    fromDate: '',
    toDate: ''
  });
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('allTime');




  // Theme state + CSS effects + button class helper
  const { theme, setTheme, getPrimaryButtonClasses } = useTheme();

  // Derived values — use org-defined custom subcategories when available
  const incomeSubcats  = (orgConfig.customIncomeSubcats  && orgConfig.customIncomeSubcats.length  > 0)
    ? orgConfig.customIncomeSubcats  : undefined;
  const expenseSubcats = (orgConfig.customExpenseSubcats && orgConfig.customExpenseSubcats.length > 0)
    ? orgConfig.customExpenseSubcats : undefined;
  const subcategoryOptions: SubcategoryOption[] = (() => {
    if (formData.category === 'Transfer') return [];
    const customList = formData.category === 'Income' ? incomeSubcats : expenseSubcats;
    if (customList && customList.length > 0) return customList.map(sub => ({ value: sub, label: sub }));
    return getSubcategoryOptions(formData.category);
  })();
  const fieldLabels = getFieldLabels(formData.category);





  const fetchTransactions = useCallback(async () => {
    setIsLoadingData(true);
    setDataError('');
    try {
      const currentUserType = sessionStorage.getItem('kc_user_type') || 'admin';
      const response = await apiFetch(`/api/transactions?userType=${currentUserType}`);
      if (!response.ok) {
        throw new Error('Unable to load transactions from the server.');
      }
      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (error) {
      const errMsg = (error as Error).message || 'Unable to load transactions.';
      setDataError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const fetchEntities = useCallback(async () => {
    try {
      const currentUserType = sessionStorage.getItem('kc_user_type') || 'admin';
      
      // Fetch trustees for custodian dropdown
      const trusteesResponse = await apiFetch(`/api/entities?userType=${currentUserType}&entityType=trustee`);

      if (trusteesResponse.ok) {
        const trustees: Entity[] = await trusteesResponse.json();
        setTrusteeOptions(trustees.map(e => ({ value: e.entity_name, label: e.entity_name })));
      }
    } catch (error) {
      console.error('Error fetching entities:', error);
      setTrusteeOptions([]);
    }
  }, []);

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setDateRange({
      fromDate: firstDay.toISOString().split('T')[0],
      toDate: lastDay.toISOString().split('T')[0]
    });
  }, []);

  // Fetch entities and transactions when logged in or userType changes
  // Fetch saved senders from server
  const fetchSavedCounterparties = useCallback(async () => {
    try {
      const response = await apiFetch('/api/saved-senders');
      if (!response.ok) {
        throw new Error('Unable to load saved counterparties from the server.');
      }
      const data: string[] = await response.json();
      setSavedCounterparties(data);
    } catch (error) {
      console.error('Error loading saved counterparties:', error);
      setSavedCounterparties([]);
    }
  }, []);

  // Fetch org noticeboard config (non-blocking — fails silently, defaults used)
  const fetchOrgConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/api/org-config');
      if (res.ok) {
        const data: NoticeboardConfig = await res.json();
        setOrgConfig(data);
      }
    } catch {
      // Non-critical — noticeboard will render with empty defaults
    }
  }, []);



  useEffect(() => {
    if (isLoggedIn) {
      fetchSavedCounterparties();
    }
  }, [isLoggedIn, fetchSavedCounterparties]);

  // In saasMode the logout button calls Clerk signOut; otherwise old flow
  const effectiveLogout = saasMode && onSignOut ? onSignOut : handleLogout;

  // Sync activeTab when FloatingNavBar switches between Transactions/Reports
  useEffect(() => {
    if (saasMode && initialTab) setActiveTab(initialTab);
  }, [saasMode, initialTab]);

  useEffect(() => {
    if (isLoggedIn) {
      // Clear old data when userType changes to prevent showing wrong data
      setTransactions([]);
      setTrusteeOptions([]);
      setIsInitializing(true);

      // Fetch new data for the current user type
      Promise.all([fetchTransactions(), fetchEntities()]).finally(() => {
        setIsInitializing(false);
      });

      // Non-blocking: fetch org noticeboard config
      fetchOrgConfig();
    } else {
      // Clear entities when logged out
      setTrusteeOptions([]);
    }
  }, [isLoggedIn, userType, fetchTransactions, fetchEntities, fetchOrgConfig]);

  // Signal parent (OrgAppShell) that initial data load is done — fires once
  useEffect(() => {
    if (!isInitializing && !hasCalledReady.current) {
      hasCalledReady.current = true;
      onReady?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing]);


  // Helper function to filter transactions by date range.
  // For period-based modes (thisMonth, selectedMonth) we compare against
  // accounting_period (YYYY-MM) — the reconciliation field — so late-entered
  // transactions are counted in the month they actually belong to.
  // For range-based modes (thisQuarter, thisFiscalYear, custom) we continue
  // to use t.date so the wider date windows are respected correctly.
  const getFilteredTransactions = (): Transaction[] => {
    let filtered = transactions;

    if (trusteeFilter) {
      filtered = filtered.filter(t => t.custodian === trusteeFilter);
    }

    if (dateFilterMode === 'allTime') return filtered;

    if (dateFilterMode === 'thisMonth') {
      // Current calendar month — compare accounting_period (YYYY-MM)
      const currentPeriod = new Date().toISOString().slice(0, 7); // e.g. '2026-08'
      return filtered.filter(t => {
        // Graceful fallback for pre-migration rows that have no accounting_period yet
        const period = t.accounting_period ?? t.date?.slice(0, 7) ?? '';
        return period === currentPeriod;
      });
    }

    if (dateFilterMode === 'selectedMonth') {
      // User-picked month via the month popover — dateRange holds the first/last day
      if (!dateRange.fromDate) return filtered;
      const selectedPeriod = dateRange.fromDate.slice(0, 7); // 'YYYY-MM'
      return filtered.filter(t => {
        const period = t.accounting_period ?? t.date?.slice(0, 7) ?? '';
        return period === selectedPeriod;
      });
    }

    // For custom / thisQuarter / thisFiscalYear — use date-based range as before
    const range = dateFilterMode === 'custom'
      ? dateRange
      : getDateRangeForMode(dateFilterMode, dateRange);

    if (range.fromDate) {
      filtered = filtered.filter(t => t.date >= range.fromDate);
    }
    if (range.toDate) {
      filtered = filtered.filter(t => t.date <= range.toDate);
    }

    return filtered;
  };

  // Helper function to get previous period for comparison
  const getPreviousPeriodRange = () => {
    let currentRange;
    
    if (dateFilterMode === 'custom' || dateFilterMode === 'selectedMonth') {
      currentRange = dateRange;
    } else {
      currentRange = getDateRangeForMode(dateFilterMode, dateRange);
    }
    
    if (!currentRange.fromDate || !currentRange.toDate) {
      return null;
    }
    
    const fromDate = new Date(currentRange.fromDate);
    const toDate = new Date(currentRange.toDate);
    const diffMs = toDate.getTime() - fromDate.getTime();
    const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    
    const prevFromDate = new Date(fromDate);
    prevFromDate.setFullYear(prevFromDate.getFullYear() - 1);
    
    const prevToDate = new Date(prevFromDate);
    prevToDate.setDate(prevToDate.getDate() + daysDiff - 1);
    
    return {
      fromDate: prevFromDate.toISOString().split('T')[0],
      toDate: prevToDate.toISOString().split('T')[0]
    };
  };

  // Get transactions for previous period
  const getPreviousPeriodTransactions = (): Transaction[] => {
    const prevRange = getPreviousPeriodRange();
    if (!prevRange) return [];
    
    return transactions.filter(t => 
      t.date >= prevRange.fromDate && t.date <= prevRange.toDate
    );
  };

  // Handle quick filter button clicks
  const handleQuickFilter = (mode: DateFilterMode) => {
    setDateFilterMode(mode);
    if (mode !== 'custom' && mode !== 'selectedMonth' && mode !== 'allTime') {
      const range = getDateRangeForMode(mode);
      setDateRange(range);
    } else if (mode === 'allTime') {
      setDateRange({ fromDate: '', toDate: '' });
    }
  };

  const handleCategorySelect = (option: SingleValue<CategoryOption>) => {
    const value = option?.value ?? 'Income';
    // Default to first available subcategory in the org's custom list, or classic defaults
    let subcategory = '';
    if (value === 'Income') {
      subcategory = (orgConfig.customIncomeSubcats  && orgConfig.customIncomeSubcats.length  > 0)
        ? orgConfig.customIncomeSubcats[0]
        : 'Donations';
    } else if (value === 'Expense') {
      subcategory = (orgConfig.customExpenseSubcats && orgConfig.customExpenseSubcats.length > 0)
        ? orgConfig.customExpenseSubcats[0]
        : 'Salaries';
    }
    // For Transfer, subcategory stays empty
    setFormData({
      ...formData,
      category: value,
      subcategory: subcategory,
      // Clear counterparty when switching categories to avoid stale selections
      counterparty: '',
    });
  };

  const handleSubcategorySelect = (option: SingleValue<SubcategoryOption>) => {
    const value = option?.value ?? '';
    setFormData({ ...formData, subcategory: value });
  };

  const handleCustodianSelect = (option: SingleValue<TrusteeOption>) => {
    const value = option?.value ?? '';
    setFormData({ ...formData, custodian: value });
  };

  const handleCounterpartySelect = (option: SingleValue<TrusteeOption>) => {
    const value = option?.value ?? '';
    setFormData({ ...formData, counterparty: value });
  };

  const handleLabelClick = (label: string) => {
    const currentRemarks = formData.remarks.trim();
    // Check if label already exists as a whole word in remarks (case-insensitive)
    const labelRegex = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (labelRegex.test(currentRemarks)) {
      // Label already exists, don't add duplicate
      return;
    }
    // Add label with preceding space
    const newRemarks = currentRemarks ? `${currentRemarks} ${label}` : label;
    setFormData({ ...formData, remarks: newRemarks });
  };

  // Handle delete saved counterparty
  const handleDeleteSavedCounterparty = async (cpToDelete: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Optimistic update: remove from UI immediately
    const previousCounterparties = savedCounterparties;
    const newSavedCounterparties = savedCounterparties.filter(s => s !== cpToDelete);
    setSavedCounterparties(newSavedCounterparties);
    
    try {
      const response = await apiFetch(`/api/saved-senders?sender=${encodeURIComponent(cpToDelete)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Unable to delete counterparty from server.');
      }
      
      fetchSavedCounterparties().catch(() => {
        setSavedCounterparties(previousCounterparties);
      });
    } catch (error) {
      console.error('Error deleting counterparty:', error);
      setSavedCounterparties(previousCounterparties);
    }
  };

  // Filter saved counterparties based on input
  const filteredSavedCounterparties = savedCounterparties.filter(cp =>
    cp.toLowerCase().includes(formData.counterparty.toLowerCase())
  );

  // ---- AUTH & VALIDATION ----

  const validateTransactionForm = () => {
    const errors: Record<string, string> = {};
    const labels = getFieldLabels(formData.category);

    if (!formData.date) {
      errors.date = 'Date is required';
    }
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    // Subcategory not required for Transfer
    if (formData.category !== 'Transfer' && !formData.subcategory) {
      errors.subcategory = 'Subcategory is required';
    }
    if (!formData.custodian.trim()) {
      errors.custodian = `${labels.custodianLabel} is required`;
    }
    if (!formData.counterparty.trim()) {
      errors.counterparty = `${labels.counterpartyLabel} is required`;
    }
    // For Transfer, custodian and counterparty must be different
    if (formData.category === 'Transfer' && formData.custodian.trim() && formData.counterparty.trim() && formData.custodian.trim() === formData.counterparty.trim()) {
      errors.counterparty = 'Source and destination trustee cannot be the same';
    }
    // Remarks are optional — blank will be saved as 'Not Available'
    // (no validation needed)

    if (formData.amount === '') {
      errors.amount = 'Amount is required';
    } else {
      const num = Number(formData.amount);
      if (Number.isNaN(num)) {
        errors.amount = 'Amount must be a number';
      } else if (num <= 0) {
        errors.amount = 'Amount must be greater than zero';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };



  // Ka-ching cash register sound for transaction acknowledgment
  // Place your sound file at: public/sounds/ka-ching.mp3
  const kachingAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    kachingAudioRef.current = new Audio('/sounds/ka-ching.mp3');
    kachingAudioRef.current.volume = 0.7;
  }, []);

  const playChime = () => {
    if (!playSoundOnSuccess) return;
    
    try {
      if (kachingAudioRef.current) {
        kachingAudioRef.current.currentTime = 0;
        kachingAudioRef.current.play().catch((err) => {
          console.debug('Audio playback failed:', err);
        });
      }
    } catch (error) {
      console.debug('Audio creation failed:', error);
    }
  };

  const triggerSuccessAck = () => {
    setShowSuccessAck(true);
    if (successTimer.current) {
      window.clearTimeout(successTimer.current);
    }
    successTimer.current = window.setTimeout(() => setShowSuccessAck(false), 1600);
    playChime();
  };

  useEffect(() => {
    return () => {
      if (successTimer.current) {
        window.clearTimeout(successTimer.current);
      }
    };
  }, []);

  const handleAddTransaction = async () => {
    if (!validateTransactionForm()) return;
    trackAction('action:save-txn');
    setIsSyncing(true);
    setDataError('');

    const payload = {
      ...formData,
      custodian: formData.custodian.trim(),
      counterparty: formData.counterparty.trim(),
      remarks: formData.remarks.trim() || 'Not Available',
      amount: Number(formData.amount),
    };

    try {
      const currentUserType = sessionStorage.getItem('kc_user_type') || 'admin';
      const response = await apiFetch(`/api/transactions?userType=${currentUserType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Unable to save the transaction. Please try again.');
      }

      const created: Transaction = await response.json();
      setTransactions((prev) => [created, ...prev]);
      
      // Save counterparty to server if not already present
      const trimmedCounterparty = formData.counterparty.trim();
      if (trimmedCounterparty && !savedCounterparties.includes(trimmedCounterparty) && formData.category !== 'Transfer') {
        try {
          const cpResponse = await apiFetch('/api/saved-senders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sender: trimmedCounterparty }),
          });
          
          if (cpResponse.ok) {
            fetchSavedCounterparties();
          }
        } catch (error) {
          console.error('Error saving counterparty:', error);
          if (!savedCounterparties.includes(trimmedCounterparty)) {
            setSavedCounterparties([...savedCounterparties, trimmedCounterparty].sort());
          }
        }
      }
      
      setFormData(getDefaultFormState());
      setFormErrors({});
      triggerSuccessAck();
      showToast('Transaction saved successfully!', 'success');
    } catch (error) {
      const errMsg = (error as Error).message || 'Unable to save the transaction.';
      setDataError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('Delete this transaction?')) {
      return;
    }
    trackAction('action:delete-txn');

    setIsSyncing(true);
    setDataError('');
    try {
      const currentUserType = sessionStorage.getItem('kc_user_type') || 'admin';
      const response = await apiFetch(`/api/transactions?id=${id}&userType=${currentUserType}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Unable to delete the transaction.');
      }

      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast('Transaction deleted successfully!', 'success');
    } catch (error) {
      const errMsg = (error as Error).message || 'Unable to delete the transaction.';
      setDataError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    trackAction('action:edit-txn');
    setFormData({
      date: transaction.date,
      // Populate accounting_period from the transaction; fall back gracefully for pre-migration rows
      accounting_period: transaction.accounting_period ?? transaction.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
      category: transaction.category,
      subcategory: transaction.subcategory,
      custodian: transaction.custodian || '',
      counterparty: transaction.counterparty || '',
      remarks: transaction.remarks || '',
      amount: transaction.amount.toString(),
    });
    setFormErrors({});
    setActiveTab('add'); // Switch to Add Transaction tab to show the form
    // Scroll to form
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingTransactionId(null);
    setFormData(getDefaultFormState());
    setFormErrors({});
  };

  const handleUpdateTransaction = async () => {
    if (!validateTransactionForm() || !editingTransactionId) return;
    trackAction('action:save-txn');
    setIsSyncing(true);
    setDataError('');

    // Generate timestamp from client machine in IST format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const modifiedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;

    const payload = {
      id: editingTransactionId,
      ...formData,
      custodian: formData.custodian.trim(),
      counterparty: formData.counterparty.trim(),
      remarks: formData.remarks.trim() || 'Not Available',
      amount: Number(formData.amount),
      modifiedDate: modifiedDate,
    };

    try {
      const currentUserType = sessionStorage.getItem('kc_user_type') || 'admin';
      const response = await apiFetch(`/api/transactions?userType=${currentUserType}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Unable to update the transaction. Please try again.');
      }

      const updated: Transaction = await response.json();
      // Remove old transaction and add updated one at the beginning
      setTransactions((prev) => {
        const filtered = prev.filter((t) => t.id !== editingTransactionId);
        return [updated, ...filtered];
      });
      setEditingTransactionId(null);
      setFormData(getDefaultFormState());
      setFormErrors({});
      showToast('Transaction updated successfully!', 'success');
    } catch (error) {
      const errMsg = (error as Error).message || 'Unable to update the transaction.';
      setDataError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const exportToCSV = () => {
    trackAction('action:export-csv');
    const filteredTrans = getFilteredTransactions();
    exportTransactionsToCSV({
      transactions: filteredTrans,
      filenamePrefix: `Khata_Accounts_${dateFilterMode}`,
      isAdmin,
      activeFilters: {
        dateRange: formatPeriodLabel(),
        custodians: trusteeFilter ? [trusteeFilter] : undefined,
      },
      orgName: 'KhataCloud',
    });
  };

  // Memoized filtered transactions and stats for Financial Reports tab
  const filteredTransactions = useMemo(() => getFilteredTransactions(), [transactions, dateFilterMode, dateRange, trusteeFilter]);
  const stats = useMemo(() => calculateStats(filteredTransactions), [filteredTransactions]);
  const allTimeStats = useMemo(() => calculateStats(transactions), [transactions]);
  const previousPeriodStats = useMemo(() => calculateStats(getPreviousPeriodTransactions()), [transactions, dateFilterMode, dateRange]);
  const previousRange = useMemo(() => getPreviousPeriodRange(), [dateFilterMode, dateRange]);

  const formatPeriodLabel = () => {
    if (dateFilterMode === 'custom') {
      return `${formatDisplayDateShort(dateRange.fromDate)} to ${formatDisplayDateShort(dateRange.toDate)}`;
    }
    if (dateFilterMode === 'selectedMonth' && dateRange.fromDate) {
      const parts = dateRange.fromDate.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const d = new Date(year, month, 1);
        return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }
    }
    if (dateFilterMode === 'allTime') {
      return 'All time';
    }
    const today = new Date();
    if (dateFilterMode === 'thisMonth') {
      return today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    if (dateFilterMode === 'thisQuarter') {
      const q = Math.floor(today.getMonth() / 3);
      const year = today.getFullYear();
      const startMonth = new Date(year, q * 3, 1).toLocaleString('en-IN', { month: 'short' });
      const endMonth = new Date(year, q * 3 + 2, 1).toLocaleString('en-IN', { month: 'short' });
      return `Q${q + 1} ${year} (${startMonth} – ${endMonth})`;
    }
    if (dateFilterMode === 'thisFiscalYear') {
      const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const fyEndYear = fyStartYear + 1;
      return `FY ${fyStartYear}-${fyEndYear}`;
    }
    return dateFilterMode;
  };

  const formatPreviousPeriodLabel = () => {
    if (!previousRange) return '';
    return `Same period last year: ${formatDisplayDateShort(previousRange.fromDate)} – ${formatDisplayDateShort(previousRange.toDate)}`;
  };


  // Not logged in → redirect to /auth
  // Exception: /trial — show a spinner while the auto-trial JWT fetch is in
  // progress. Once the token lands, isLoggedIn flips to true and the dashboard
  // renders. After a logout, handleLogout() itself navigates to /auth so this
  // branch is never reached post-logout.
  // Not logged in — redirect to /auth (skip in saasMode; token is set by OrgAppShell)
  if (!isLoggedIn && !saasMode) {
    if (window.location.pathname === '/trial') {
      return <LoadingScreen label="Preparing demo account…" />;
    }
    window.location.replace('/auth');
    return null;
  }

  if (isInitializing) return <LoadingScreen label="Loading your data…" />;



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {showSuccessAck && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-emerald-200 animate-ping" />
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg flex items-center justify-center text-3xl font-bold text-amber-50 animate-bounce motion-reduce:animate-none">
                ₹
              </div>
            </div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Transaction saved</div>
            <p className="text-sm text-slate-600 dark:text-gray-300">Balance and reports updated.</p>
          </div>
        </div>
      )}

      {/* Old header — hidden in saasMode (FloatingNavBar handles navigation + logout) */}
      {!saasMode && (
        <Header
          displayTitle={displayTitle}
          userType={userType}
          theme={theme}
          onThemeChange={setTheme}
          onLogout={effectiveLogout}
        />
      )}

      <div className="max-w-6xl mx-auto p-4">
        {/* Dashboard Stats - All Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Income (All Time)</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(allTimeStats.income)}</p>
          </div>
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Expenses (All Time)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(allTimeStats.expenses)}</p>
          </div>
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Balance (All Time)</p>
            <p className={`text-2xl font-bold ${allTimeStats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatCurrency(allTimeStats.balance)}
            </p>
          </div>
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Current Filter Balance</p>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatCurrency(stats.balance)}
            </p>
          </div>
        </div>

        {dataError && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {dataError}
          </div>
        )}
        {isSyncing && (
          <div             className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            theme.mode === 'dark'
              ? 'border-gray-900 bg-gray-900/50 text-gray-300'
              : (theme.palette === 'indigo' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' :
                 theme.palette === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                 theme.palette === 'purple' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                 theme.palette === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                 'border-rose-200 bg-rose-50 text-rose-700')
          }`}>
            Syncing...
          </div>
        )}

        {/* ── Tab controls ── */}
        {saasMode ? (
          /* saasMode pill: FloatingNavBar sub-menu controls view/add; nothing rendered here.
             saasMode classic: show the inline pill toggle so users can switch view/add. */
          navStyle === 'classic' && activeTab !== 'report' && (
            <div className="flex mb-6" style={{ background: 'none' }}>
              <div className="inline-flex bg-slate-900 border border-white/10 rounded-2xl p-1 gap-1 shadow-xl">
                <button
                  id="tab-view"
                  onClick={() => { handleCancelEdit(); setActiveTab('view'); trackAction('transactions:view'); }}
                  className={`
                    px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                    ${ activeTab === 'view'
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  All Transactions
                </button>
                <button
                  id="tab-add"
                  onClick={() => { if (activeTab !== 'add') handleCancelEdit(); setActiveTab('add'); trackAction('transactions:add'); }}
                  className={`
                    flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                    ${ activeTab === 'add'
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          )
        ) : (
          /* Legacy mode: original 3 tab buttons */
          <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => {
              if (activeTab !== 'add') {
                handleCancelEdit();
              }
              setActiveTab('add');
              trackAction('transactions:add');
            }}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
              activeTab === 'add'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-900 border border-gray-800 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <Plus size={18} /> Add Transaction
          </button>
          <button
            onClick={() => {
              handleCancelEdit();
              setActiveTab('view');
              trackAction('transactions:view');
            }}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === 'view'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-900 border border-gray-800 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            View Transactions
          </button>
          <button
            onClick={() => {
              handleCancelEdit();
              setActiveTab('report');
              trackAction('reports');
            }}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === 'report'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-900 border border-gray-800 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            Financial Reports
          </button>
          {/* Super-admin tab — only visible to super_admin users */}
          {userType === 'super_admin' && (
            <button
              onClick={() => { handleCancelEdit(); setActiveTab('superadmin'); }}
              className={`px-4 py-2 rounded-lg font-semibold ${
                activeTab === 'superadmin'
                  ? (theme.mode === 'dark'
                      ? 'bg-gray-900 border border-gray-800 text-white'
                      : 'bg-indigo-600 text-white')
                  : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
              }`}
            >
              ⚙️ Super Admin
            </button>
          )}
          </div>
        )}


        {/* Add Transaction Tab */}
        {activeTab === 'add' && (
          <TransactionForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            editingTransactionId={editingTransactionId}
            isSyncing={isSyncing}
            theme={theme}
            fieldLabels={fieldLabels}
            subcategoryOptions={subcategoryOptions}
            trusteeOptions={trusteeOptions}
            filteredSavedCounterparties={filteredSavedCounterparties}
            showCounterpartyDropdown={showCounterpartyDropdown}
            setShowCounterpartyDropdown={setShowCounterpartyDropdown}
            playSoundOnSuccess={playSoundOnSuccess}
            setPlaySoundOnSuccess={setPlaySoundOnSuccess}
            getPrimaryButtonClasses={getPrimaryButtonClasses}
            onCategorySelect={handleCategorySelect}
            onSubcategorySelect={handleSubcategorySelect}
            onCustodianSelect={handleCustodianSelect}
            onCounterpartySelect={handleCounterpartySelect}
            onLabelClick={handleLabelClick}
            onDeleteSavedCounterparty={handleDeleteSavedCounterparty}
            onCancelEdit={handleCancelEdit}
            onSubmit={editingTransactionId ? handleUpdateTransaction : handleAddTransaction}
          />
        )}

        {/* View Transactions Tab */}
        {activeTab === 'view' && (
          <TransactionTable
            transactions={transactions}
            trusteeOptions={trusteeOptions}
            isLoadingData={isLoadingData}
            isSyncing={isSyncing}
            isAdmin={isAdmin}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onExportCSV={exportToCSV}
          />
        )}



        {/* Financial Report Tab */}
        {activeTab === 'report' && (
          <FinancialReports
            filteredTransactions={filteredTransactions}
            dateFilterMode={dateFilterMode}
            dateRange={dateRange}
            setDateRange={setDateRange}
            setDateFilterMode={setDateFilterMode}
            isLoadingData={isLoadingData}
            theme={theme}
            stats={stats}
            previousPeriodStats={previousPeriodStats}
            previousRange={previousRange}
            trusteeFilter={trusteeFilter}
            setTrusteeFilter={setTrusteeFilter}
            trusteeOptions={trusteeOptions}
            getPrimaryButtonClasses={getPrimaryButtonClasses}
            formatPeriodLabel={formatPeriodLabel}
            formatPreviousPeriodLabel={formatPreviousPeriodLabel}
            handleQuickFilter={handleQuickFilter}
            exportToCSV={exportToCSV}
            orgConfig={orgConfig}
          />
        )}

        {/* Super-Admin Tab */}
        {activeTab === 'superadmin' && userType === 'super_admin' && (
          <SuperAdminDashboard />
        )}
      </div>

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-400'
                : toast.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-400'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-800 dark:text-indigo-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
              {toast.type === 'error' && <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
              {toast.type === 'info' && <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-4"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
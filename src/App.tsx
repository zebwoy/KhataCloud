import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { SingleValue } from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';

import type {
  Transaction,
  FormState,
  CategoryOption,
  SubcategoryOption,
  TrusteeOption,
  Entity,
  UserTypeOption,
  Theme,
} from './types';
import { getDefaultFormState } from './types';
import LoginPage from './components/LoginPage';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import FinancialReports from './components/FinancialReports';
import TransactionTable from './components/TransactionTable';
import TransactionForm from './components/TransactionForm';
import { formatCurrency, formatDisplayDateShort } from './utils/formatters';
import { calculateStats } from './utils/calculations';
import {
  getSubcategoryOptions, getFieldLabels,
  getDateRangeForMode,
  type DateFilterMode,
} from './utils/constants';

export default function AccountingSystem() {
  // Initialize login state from sessionStorage to persist across refreshes
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('madrasah_logged_in') === 'true';
  });
  const [userType, setUserType] = useState<'admin' | 'trial'>(() => {
    return (sessionStorage.getItem('madrasah_user_type') as 'admin' | 'trial') || 'trial';
  });
  const [displayTitle, setDisplayTitle] = useState<string>(() => {
    const savedUserType = (sessionStorage.getItem('madrasah_user_type') as 'admin' | 'trial') || 'trial';
    return savedUserType === 'trial' ? 'Trial account for Demo Purpose' : 'Millat Quran Learning Centre';
  });
  const [isTitleAnimating, setIsTitleAnimating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState('');
  const [formData, setFormData] = useState<FormState>(getDefaultFormState());
  const [activeTab, setActiveTab] = useState('add');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataError, setDataError] = useState('');
  const [trusteeFilter, setTrusteeFilter] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [showSuccessAck, setShowSuccessAck] = useState(false);
  const successTimer = useRef<number | null>(null);
  const [playSoundOnSuccess, setPlaySoundOnSuccess] = useState(true);
  const [trusteeOptions, setTrusteeOptions] = useState<TrusteeOption[]>([]);
  const [isInitializing, setIsInitializing] = useState(() => {
    // Initialize as true if user is already logged in (prevents showing old data on refresh)
    return sessionStorage.getItem('madrasah_logged_in') === 'true';
  });

  
  // Saved senders state (loaded from server)
  const [savedCounterparties, setSavedCounterparties] = useState<string[]>([]);
  const [showCounterpartyDropdown, setShowCounterpartyDropdown] = useState(false);
  
  // Date range filter state
  const [dateRange, setDateRange] = useState({
    fromDate: '',
    toDate: ''
  });
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('allTime');




  // Theme state
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('madrasah_theme');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { mode: 'light', palette: 'indigo' };
      }
    }
    return { mode: 'light', palette: 'indigo' };
  });


  // Apply theme to document
  useEffect(() => {
    localStorage.setItem('madrasah_theme', JSON.stringify(theme));
    const root = document.documentElement;
    root.classList.toggle('dark', theme.mode === 'dark');
    root.setAttribute('data-theme', theme.palette);
    
    // Set CSS variable for DatePicker selected color in light mode
    if (theme.mode === 'light') {
      const paletteColors = {
        indigo: '#4f46e5',
        blue: '#2563eb',
        purple: '#9333ea',
        emerald: '#059669',
        rose: '#e11d48',
      };
      root.style.setProperty('--selected-color', paletteColors[theme.palette]);
    } else {
      root.style.setProperty('--selected-color', '#1f2937');
    }
  }, [theme]);

  // Helper function to get primary button classes based on theme
  const getPrimaryButtonClasses = (isActive = true) => {
    if (!isActive) return 'bg-gray-100 dark:bg-gray-900 dark:border-gray-800 text-gray-700 dark:text-gray-300 border dark:border-gray-900';
    if (theme.mode === 'dark') {
      return 'bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white';
    }
    // Light mode - use palette
    const paletteMap = {
      indigo: 'bg-indigo-600 hover:bg-indigo-700',
      blue: 'bg-blue-600 hover:bg-blue-700',
      purple: 'bg-purple-600 hover:bg-purple-700',
      emerald: 'bg-emerald-600 hover:bg-emerald-700',
      rose: 'bg-rose-600 hover:bg-rose-700',
    };
    return paletteMap[theme.palette] + ' text-white';
  };

  // Derived values from imported utilities
  const subcategoryOptions = getSubcategoryOptions(formData.category);
  const fieldLabels = getFieldLabels(formData.category);



  // Handle user type change with animated title transition (countdown timer-like effect)
  const handleUserTypeChange = (option: SingleValue<UserTypeOption>) => {
    const newUserType = option?.value ?? 'admin';
    if (newUserType !== userType) {
      setIsTitleAnimating(true);
      // Countdown-like animation: fade out, change text, fade in
      setTimeout(() => {
        const newTitle = newUserType === 'trial' 
          ? 'Trial account for Demo Purpose' 
          : 'Millat Quran Learning Centre';
        setDisplayTitle(newTitle);
        setUserType(newUserType);
        // Fade in new title with smooth transition
        setTimeout(() => {
          setIsTitleAnimating(false);
        }, 200);
      }, 200);
    } else {
      setUserType(newUserType);
    }
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoadingData(true);
    setDataError('');
    try {
      const currentUserType = sessionStorage.getItem('madrasah_user_type') || 'admin';
      const response = await fetch(`/.netlify/functions/transactions?userType=${currentUserType}`);
      if (!response.ok) {
        throw new Error('Unable to load transactions from the server.');
      }
      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (error) {
      setDataError((error as Error).message || 'Unable to load transactions.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const fetchEntities = useCallback(async () => {
    try {
      const currentUserType = sessionStorage.getItem('madrasah_user_type') || 'admin';
      
      // Fetch trustees for custodian dropdown
      const trusteesResponse = await fetch(`/.netlify/functions/entities?userType=${currentUserType}&entityType=trustee`);

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
    const savedUserType = sessionStorage.getItem('madrasah_user_type') as 'admin' | 'trial' | null;
    if (sessionStorage.getItem('madrasah_logged_in') === 'true') {
      setIsLoggedIn(true);
      if (savedUserType) {
        setUserType(savedUserType);
        // Update displayTitle based on saved userType
        const title = savedUserType === 'trial' 
          ? 'Trial account for Demo Purpose' 
          : 'Millat Quran Learning Centre';
        setDisplayTitle(title);
      }
    }

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
      const response = await fetch('/.netlify/functions/saved-senders');
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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchSavedCounterparties();
    }
  }, [isLoggedIn, fetchSavedCounterparties]);

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
    } else {
      // Clear entities when logged out
      setTrusteeOptions([]);
    }
  }, [isLoggedIn, userType, fetchTransactions, fetchEntities]);


  // Helper function to filter transactions by date range
  const getFilteredTransactions = (): Transaction[] => {
    let filtered = transactions;
    
    if (trusteeFilter) {
      filtered = filtered.filter(t => t.custodian === trusteeFilter);
    }

    if (dateFilterMode !== 'allTime') {
      const range = dateFilterMode === 'custom' ? dateRange : getDateRangeForMode(dateFilterMode);
    
    if (range.fromDate) {
      filtered = filtered.filter(t => t.date >= range.fromDate);
    }
    if (range.toDate) {
      filtered = filtered.filter(t => t.date <= range.toDate);
      }
    }
    
    return filtered;
  };

  // Helper function to get previous period for comparison
  const getPreviousPeriodRange = () => {
    let currentRange;
    
    if (dateFilterMode === 'custom') {
      currentRange = dateRange;
    } else {
      currentRange = getDateRangeForMode(dateFilterMode);
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
    if (mode !== 'custom' && mode !== 'allTime') {
      const range = getDateRangeForMode(mode);
      setDateRange(range);
    } else if (mode === 'allTime') {
      setDateRange({ fromDate: '', toDate: '' });
    }
  };

  const handleCategorySelect = (option: SingleValue<CategoryOption>) => {
    const value = option?.value ?? 'Income';
    let subcategory = '';
    if (value === 'Income') {
      subcategory = 'Donations';
    } else if (value === 'Expense') {
      subcategory = 'Salaries';
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
      const response = await fetch(`/.netlify/functions/saved-senders?sender=${encodeURIComponent(cpToDelete)}`, {
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
    if (!formData.remarks.trim()) {
      errors.remarks = 'Remarks is required';
    } else if (formData.remarks.trim().length < 3) {
      errors.remarks = 'Remarks should be at least 3 characters';
    }

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

  const handleLogin = async (password: string) => {
    // For admin mode, require password
    if (userType === 'admin' && !password.trim()) {
      setAuthError('Enter the password');
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');

    try {
      const response = await fetch('/.netlify/functions/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userType: userType }),
      });

      if (response.ok) {
        // Clear old data immediately to prevent showing previous user's data
        setTransactions([]);
        setTrusteeOptions([]);
        setDataError('');
        
        setIsLoggedIn(true);
        sessionStorage.setItem('madrasah_logged_in', 'true');
        sessionStorage.setItem('madrasah_user_type', userType);
        // Update displayTitle based on userType
        const title = userType === 'trial' 
          ? 'Trial account for Demo Purpose' 
          : 'Millat Quran Learning Centre';
        setDisplayTitle(title);
        
        // Show loader while fetching new data
        setIsInitializing(true);
        
        // Fetch transactions and entities after login
        try {
          await Promise.all([fetchTransactions(), fetchEntities()]);
        } finally {
          setIsInitializing(false);
        }
      } else {
        const data = await response.json().catch(() => null);
        setAuthError(data?.message || 'Incorrect password. Please try again.');
      }
    } catch (error) {
      setAuthError('Unable to login right now. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    // Clear session on logout but maintain userType
    sessionStorage.removeItem('madrasah_logged_in');
    // Keep madrasah_user_type in sessionStorage to maintain userType selection
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
    setIsSyncing(true);
    setDataError('');

    const payload = {
      ...formData,
      custodian: formData.custodian.trim(),
      counterparty: formData.counterparty.trim(),
      remarks: formData.remarks.trim(),
      amount: Number(formData.amount),
    };

    try {
      const currentUserType = sessionStorage.getItem('madrasah_user_type') || 'admin';
      const response = await fetch(`/.netlify/functions/transactions?userType=${currentUserType}`, {
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
          const cpResponse = await fetch('/.netlify/functions/saved-senders', {
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
    } catch (error) {
      setDataError((error as Error).message || 'Unable to save the transaction.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('Delete this transaction?')) {
      return;
    }

    setIsSyncing(true);
    setDataError('');
    try {
      const currentUserType = sessionStorage.getItem('madrasah_user_type') || 'admin';
      const response = await fetch(`/.netlify/functions/transactions?id=${id}&userType=${currentUserType}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Unable to delete the transaction.');
      }

      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      setDataError((error as Error).message || 'Unable to delete the transaction.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setFormData({
      date: transaction.date,
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
      remarks: formData.remarks.trim(),
      amount: Number(formData.amount),
      modifiedDate: modifiedDate,
    };

    try {
      const currentUserType = sessionStorage.getItem('madrasah_user_type') || 'admin';
      const response = await fetch(`/.netlify/functions/transactions?userType=${currentUserType}`, {
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
    } catch (error) {
      setDataError((error as Error).message || 'Unable to update the transaction.');
    } finally {
      setIsSyncing(false);
    }
  };

  const exportToCSV = () => {
    const filteredTrans = getFilteredTransactions();
    const headers = ['Date', 'Category', 'Subcategory', 'Custodian', 'Counterparty', 'Amount', 'Remarks'];
    const rows = filteredTrans.map(t => [
      t.date,
      t.category,
      t.subcategory || '',
      t.custodian,
      t.counterparty,
      t.amount,
      t.remarks || ''
    ]);

    const dateRangeStr = dateFilterMode === 'custom' 
      ? `${dateRange.fromDate}_to_${dateRange.toDate}`
      : dateFilterMode;

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `madrasah_accounts_${dateRangeStr}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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


  // Login Screen
  if (!isLoggedIn) {
    return (
      <LoginPage
        userType={userType}
        displayTitle={displayTitle}
        isTitleAnimating={isTitleAnimating}
        onUserTypeChange={handleUserTypeChange}
        onLogin={handleLogin}
        isAuthenticating={isAuthenticating}
        authError={authError}
      />
    );
  }

  // Show loader while initializing after login or userType change
  if (isInitializing) {
    return <LoadingScreen />;
  }

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

      <Header
        displayTitle={displayTitle}
        userType={userType}
        theme={theme}
        onThemeChange={setTheme}
        onLogout={handleLogout}
      />

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
            Syncing with Netlify DB...
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => {
              if (activeTab !== 'add') {
                handleCancelEdit();
              }
              setActiveTab('add');
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
        </div>


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
          />
        )}
      </div>
    </div>
  );
}
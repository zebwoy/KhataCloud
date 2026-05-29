import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Edit,
  ChevronUp,
  ChevronDown,
  X,
  Filter,
  Check,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import Select, { SingleValue } from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';

import type {
  TransactionCategory,
  Transaction,
  FormState,
  CategoryOption,
  SubcategoryOption,
  TrusteeOption,
  Entity,
  UserTypeOption,
  Theme,
  ColumnFilter,
} from './types';
import { getDefaultFormState, defaultColumnFilter } from './types';
import LoginPage from './components/LoginPage';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';

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
  const [dateFilterMode, setDateFilterMode] = useState<'thisMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom'>('allTime'); // 'custom', 'thisMonth', 'thisQuarter', 'thisFiscalYear', 'allTime'



  const [tableColumnFilters, setTableColumnFilters] = useState<Record<string, ColumnFilter>>({
    date: { ...defaultColumnFilter },
    category: { ...defaultColumnFilter },
    subcategory: { ...defaultColumnFilter },
    custodian: { ...defaultColumnFilter },
    counterparty: { ...defaultColumnFilter },
    amount: { ...defaultColumnFilter },
    remarks: { ...defaultColumnFilter },
  });
  const [openFilterPopup, setOpenFilterPopup] = useState<string | null>(null);
  const [tableSortColumn, setTableSortColumn] = useState<string>('date');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableCurrentPage, setTableCurrentPage] = useState<number>(1);
  const [tablePageSize] = useState<number>(20);

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

  // ---- MASTER DATA ----

  const incomeSubcategories = ['Donations', 'Student Fees', 'Grants', 'Other Income'];
  const expenseSubcategories = ['Salaries', 'Utilities', 'Books & Materials', 'Infrastructure', 'Other Expenses'];
  const remarkLabels = ['Deposit', 'Rent', 'Legality', 'Bathroom', 'Classroom', 'Library', 'Painting', 'Fabrication', 'Cleaning', 'Plumbing'];

  const categoryOptions: CategoryOption[] = [
    { value: 'Income', label: 'Income' },
    { value: 'Expense', label: 'Expense' },
    { value: 'Transfer', label: 'Transfer' },
  ];

  const getSubcategoryOptions = (): SubcategoryOption[] => {
    if (formData.category === 'Transfer') return [];
    const list = formData.category === 'Income' ? incomeSubcategories : expenseSubcategories;
    return list.map((sub) => ({ value: sub, label: sub }));
  };
  const subcategoryOptions = getSubcategoryOptions();

  // Dynamic labels based on category for sender/receiver fields
  const getFieldLabels = (category: TransactionCategory) => {
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

  // Helper function to get date range based on filter mode
  const getDateRangeForMode = (mode: 'thisMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom') => {
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
          ? new Date(today.getFullYear(), 3, 1)  // April 1 of current year
          : new Date(today.getFullYear() - 1, 3, 1);  // April 1 of previous year
        const fiscalYearEnd = today.getMonth() >= 3
          ? new Date(today.getFullYear() + 1, 2, 31)  // March 31 of next year
          : new Date(today.getFullYear(), 2, 31);  // March 31 of current year
        return {
          fromDate: fiscalYearStart.toISOString().split('T')[0],
          toDate: fiscalYearEnd.toISOString().split('T')[0]
        };
      }
      case 'allTime':
        return { fromDate: '', toDate: '' };
      default:
        return dateRange;
    }
  };

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
  const handleQuickFilter = (mode: 'thisMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom') => {
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

  const calculateStats = (trans: Transaction[]) => {
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

  // Get category-wise breakdown
  const getCategoryBreakdown = (transList: Transaction[], category: TransactionCategory) => {
    type BreakdownRow = { sub: string; total: number; count: number };
    return transList
      .filter((t: Transaction) => t.category === category)
      .reduce<BreakdownRow[]>((acc, t) => {
        // For Reimbursement, use 'Reimbursement' as the subcategory label since it has no subcategory
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

  // Get total transfers
  const getTransferTotal = (transList: Transaction[]) => {
    return transList
      .filter(t => t.category === 'Transfer')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  };

  // Get trustee-wise ledger (proper per-trustee fund tracking)
  const getTrusteeLedger = (transList: Transaction[]) => {
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

  // Memoized filtered transactions and stats for Financial Reports tab
  const filteredTransactions = useMemo(() => getFilteredTransactions(), [transactions, dateFilterMode, dateRange, trusteeFilter]);
  const stats = useMemo(() => calculateStats(filteredTransactions), [filteredTransactions]);
  const allTimeStats = useMemo(() => calculateStats(transactions), [transactions]);
  const previousPeriodStats = useMemo(() => calculateStats(getPreviousPeriodTransactions()), [transactions, dateFilterMode, dateRange]);
  const previousRange = useMemo(() => getPreviousPeriodRange(), [dateFilterMode, dateRange]);

  // Enhanced table filtering, sorting, and pagination for View Transactions tab
  const getTableFilteredTransactions = (): Transaction[] => {
    let filtered = [...transactions];

    // Apply column filters
    Object.entries(tableColumnFilters).forEach(([column, filter]) => {
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
      let aVal: any = a[tableSortColumn as keyof Transaction];
      let bVal: any = b[tableSortColumn as keyof Transaction];

      if (tableSortColumn === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (tableSortColumn === 'amount') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (tableSortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  };

  const tableFilteredTransactions = getTableFilteredTransactions();
  const tableTotalPages = Math.ceil(tableFilteredTransactions.length / tablePageSize);
  const tablePaginatedTransactions = tableFilteredTransactions.slice(
    (tableCurrentPage - 1) * tablePageSize,
    tableCurrentPage * tablePageSize
  );

  const handleTableSort = (column: string) => {
    if (tableSortColumn === column) {
      setTableSortDirection(tableSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortColumn(column);
      setTableSortDirection('desc');
    }
    setTableCurrentPage(1); // Reset to first page on sort
  };

  const updateColumnFilter = (column: string, updates: Partial<ColumnFilter>) => {
    setTableColumnFilters(prev => ({
      ...prev,
      [column]: { ...prev[column], ...updates }
    }));
    setTableCurrentPage(1);
  };

  const clearTableFilters = () => {
    setTableColumnFilters({
      date: { ...defaultColumnFilter },
      category: { ...defaultColumnFilter },
      subcategory: { ...defaultColumnFilter },
      custodian: { ...defaultColumnFilter },
      counterparty: { ...defaultColumnFilter },
      amount: { ...defaultColumnFilter },
      remarks: { ...defaultColumnFilter },
    });
    setTableCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return Object.values(tableColumnFilters).some(filter => 
      filter.textFilter.trim() !== '' ||
      filter.selectedValues.length > 0 ||
      filter.dateFrom !== '' ||
      filter.dateTo !== '' ||
      filter.amountMin !== '' ||
      filter.amountMax !== ''
    );
  };

  const handleFilterPopupToggle = (column: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.stopPropagation();
    }
    if (openFilterPopup === column) {
      setOpenFilterPopup(null);
    } else {
      setOpenFilterPopup(column);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openFilterPopup && !(event.target as Element).closest('.filter-popup, .filter-button')) {
        setOpenFilterPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFilterPopup]);

  // Get unique values for a column (for multi-select filters)
  const getUniqueColumnValues = (column: keyof Transaction): string[] => {
    // For custodian column, use trustee entities
    if (column === 'custodian') {
      return trusteeOptions.map(opt => opt.value).sort();
    }
    
    // For other columns (including counterparty), extract unique values from transactions
    const values = new Set<string>();
    transactions.forEach(t => {
      const value = String(t[column] || '').trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  // Check if a column has active filters
  const columnHasActiveFilter = (column: string): boolean => {
    const filter = tableColumnFilters[column];
    if (!filter) return false;
    return (
      filter.textFilter.trim() !== '' ||
      filter.selectedValues.length > 0 ||
      filter.dateFrom !== '' ||
      filter.dateTo !== '' ||
      filter.amountMin !== '' ||
      filter.amountMax !== ''
    );
  };

  const formatCurrency = (value: number) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  };

  const parseLocalDate = (dateString: string) => {
    if (!dateString) return null;
    // Parse YYYY-MM-DD as a local date to avoid UTC timezone shifts
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    const fallback = new Date(dateString);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    if (!date) return dateString;

    const day = date.getDate();
    const suffix =
      day === 1 || day === 21 || day === 31 ? 'st' :
        day === 2 || day === 22 ? 'nd' :
          day === 3 || day === 23 ? 'rd' :
            'th';

    const monthYear = date.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
    const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });

    return `${day}${suffix} ${monthYear} (${weekday})`;
  };

  const formatDisplayDateShort = (dateString: string) => {
    const date = parseLocalDate(dateString);
    if (!date) return dateString || '';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

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

  // Excel-style Filter Popup Component
  const FilterPopup = ({ column, label }: { column: string; label: string }) => {
    if (openFilterPopup !== column) return null;
    
    const filter = tableColumnFilters[column];
    const uniqueValues = getUniqueColumnValues(column as keyof Transaction);
    const isDateColumn = column === 'date';
    const isAmountColumn = column === 'amount';
    const isTextColumn = !isDateColumn && !isAmountColumn;

    return (
      <>
        {/* Mobile overlay backdrop */}
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setOpenFilterPopup(null)}
        />
        <div className="filter-popup fixed md:absolute z-50 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] w-[calc(100vw-2rem)] max-w-sm md:w-80 md:max-w-none max-h-[80vh] md:max-h-96 overflow-y-auto top-1/2 md:top-full left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 md:translate-y-0 -translate-y-1/2 md:mt-1">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filter by {label}</h3>
            <button
              onClick={() => setOpenFilterPopup(null)}
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
                  handleTableSort(column);
                  setOpenFilterPopup(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-between text-gray-900 dark:text-gray-100"
              >
                <span>Sort A to Z</span>
                {tableSortColumn === column && tableSortDirection === 'asc' && (
                  <Check size={14} className="text-indigo-600" />
                )}
              </button>
              <button
                onClick={() => {
                  if (tableSortColumn === column) {
                    setTableSortDirection('desc');
                  } else {
                    setTableSortColumn(column);
                    setTableSortDirection('desc');
                  }
                  setTableCurrentPage(1);
                  setOpenFilterPopup(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-between text-gray-900 dark:text-gray-100"
              >
                <span>Sort Z to A</span>
                {tableSortColumn === column && tableSortDirection === 'desc' && (
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
                  value={{ value: filter.textOperator, label: filter.textOperator.charAt(0).toUpperCase() + filter.textOperator.slice(1) }}
                  onChange={(option) => updateColumnFilter(column, { textOperator: (option?.value || 'contains') as any })}
                  options={[
                    { value: 'contains', label: 'Contains' },
                    { value: 'equals', label: 'Equals' },
                    { value: 'starts', label: 'Starts with' },
                    { value: 'ends', label: 'Ends with' },
                  ]}
                  className="text-xs mb-2"
                  classNamePrefix="hk-select"
                />
                <input
                  type="text"
                  placeholder={`Filter ${label.toLowerCase()}...`}
                  value={filter.textFilter}
                  onChange={(e) => updateColumnFilter(column, { textFilter: e.target.value })}
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
                            updateColumnFilter(column, { selectedValues: newValues });
                          }}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
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
                    onChange={(e) => updateColumnFilter(column, { dateFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">To</label>
                  <input
                    type="date"
                    value={filter.dateTo}
                    onChange={(e) => updateColumnFilter(column, { dateTo: e.target.value })}
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
                    onChange={(e) => updateColumnFilter(column, { amountMin: e.target.value })}
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
                    onChange={(e) => updateColumnFilter(column, { amountMax: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Clear Filter Button */}
          {(columnHasActiveFilter(column)) && (
            <button
              onClick={() => {
                updateColumnFilter(column, defaultColumnFilter);
              }}
              className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg font-semibold"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>
      </>
    );
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
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {editingTransactionId ? 'Edit Transaction' : 'Add New Transaction'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Date *</label>
                  <DatePicker
                    selected={formData.date ? new Date(formData.date) : null}
                    onChange={(date: Date | null) => {
                      setFormData({
                        ...formData,
                        date: date ? date.toISOString().split('T')[0] : '',
                      });
                    }}
                    dateFormat="yyyy-MM-dd"
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                      theme.mode === 'dark' 
                        ? 'focus:ring-gray-700' 
                        : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                           theme.palette === 'blue' ? 'focus:ring-blue-500' :
                           theme.palette === 'purple' ? 'focus:ring-purple-500' :
                           theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                           'focus:ring-rose-500')
                    } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                    placeholderText="Select date"
                  />
                  {formErrors.date && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.date}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Category *</label>
                  <Select<CategoryOption>
                    options={categoryOptions}
                    value={categoryOptions.find((opt) => opt.value === formData.category)}
                    onChange={handleCategorySelect}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                    }}
                  />
                  {formErrors.category && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.category}</p>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 ${formData.category !== 'Transfer' ? 'md:grid-cols-2' : ''} gap-4`}>
                {formData.category !== 'Transfer' && (
                <div>
                  <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Subcategory *</label>
                  <Select<SubcategoryOption>
                    options={subcategoryOptions}
                    value={subcategoryOptions.find((opt) => opt.value === formData.subcategory)}
                    onChange={handleSubcategorySelect}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                    }}
                  />
                  {formErrors.subcategory && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.subcategory}</p>
                  )}
                </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                      theme.mode === 'dark' 
                        ? 'focus:ring-gray-700' 
                        : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                           theme.palette === 'blue' ? 'focus:ring-blue-500' :
                           theme.palette === 'purple' ? 'focus:ring-purple-500' :
                           theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                           'focus:ring-rose-500')
                    } text-sm bg-white dark:bg-black dark:border-gray-900 text-gray-900 dark:text-gray-100`}
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.amount}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Custodian Field — Always a trustee dropdown */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {fieldLabels.custodianLabel} *
                  </label>
                  <Select<TrusteeOption>
                    options={trusteeOptions}
                    value={trusteeOptions.find((opt) => opt.value === formData.custodian) ?? null}
                    onChange={handleCustodianSelect}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    placeholder={fieldLabels.custodianPlaceholder}
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      placeholder: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#9ca3af' : '#6b7280',
                      }),
                    }}
                  />
                  {formErrors.custodian && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.custodian}</p>
                  )}
                </div>

                {/* Counterparty Field — Dropdown for Transfer, text input for Income/Expense */}
                <div className="relative">
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {fieldLabels.counterpartyLabel} *
                  </label>
                  {formData.category === 'Transfer' ? (
                    <>
                      <Select<TrusteeOption>
                        options={trusteeOptions.filter(opt => opt.value !== formData.custodian.trim())}
                        value={trusteeOptions.find((opt) => opt.value === formData.counterparty) ?? null}
                        onChange={handleCounterpartySelect}
                        classNamePrefix="hk-select"
                        className="text-sm"
                        placeholder={fieldLabels.counterpartyPlaceholder}
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: 8,
                            borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                            minHeight: '36px',
                            backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                          }),
                          menu: (base) => ({
                            ...base,
                            backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                            borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? (theme.mode === 'dark' 
                                  ? '#1f2937' 
                                  : (theme.palette === 'indigo' ? '#4f46e5' :
                                     theme.palette === 'blue' ? '#2563eb' :
                                     theme.palette === 'purple' ? '#9333ea' :
                                     theme.palette === 'emerald' ? '#059669' :
                                     '#e11d48'))
                              : state.isFocused
                              ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                              : 'transparent',
                            color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                          }),
                          input: (base) => ({
                            ...base,
                            color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: theme.mode === 'dark' ? '#9ca3af' : '#6b7280',
                          }),
                        }}
                      />
                    </>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={fieldLabels.counterpartyPlaceholder}
                        value={formData.counterparty}
                        onChange={(e) => {
                          setFormData({ ...formData, counterparty: e.target.value });
                          setShowCounterpartyDropdown(true);
                        }}
                        onFocus={() => {
                          if (filteredSavedCounterparties.length > 0) {
                            setShowCounterpartyDropdown(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowCounterpartyDropdown(false), 200);
                        }}
                        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                          theme.mode === 'dark' 
                            ? 'focus:ring-gray-700' 
                            : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                               theme.palette === 'blue' ? 'focus:ring-blue-500' :
                               theme.palette === 'purple' ? 'focus:ring-purple-500' :
                               theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                               'focus:ring-rose-500')
                        } text-sm bg-white dark:bg-black dark:border-gray-900 text-gray-900 dark:text-gray-100`}
                      />
                      
                      {/* Saved Counterparties Dropdown */}
                      {showCounterpartyDropdown && filteredSavedCounterparties.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-900 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] max-h-60 overflow-y-auto">
                          {filteredSavedCounterparties.map((cp) => (
                            <div
                              key={cp}
                              className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                              onMouseDown={(e) => {
                                if ((e.target as HTMLElement).closest('button')) return;
                                e.preventDefault();
                                setFormData({ ...formData, counterparty: cp });
                                setShowCounterpartyDropdown(false);
                              }}
                            >
                              <span 
                                className="text-sm text-gray-900 dark:text-gray-100 flex-1"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormData({ ...formData, counterparty: cp });
                                  setShowCounterpartyDropdown(false);
                                }}
                              >
                                {cp}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSavedCounterparty(cp, e)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                title="Delete"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {formErrors.counterparty && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.counterparty}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Remarks *</label>
                
                {/* Label Buttons */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {remarkLabels.map((label) => {
                    // Check if label exists as a whole word (case-insensitive)
                    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const labelRegex = new RegExp(`\\b${escapedLabel}\\b`, 'i');
                    const isLabelInRemarks = labelRegex.test(formData.remarks);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleLabelClick(label)}
                        disabled={isLabelInRemarks}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          isLabelInRemarks
                            ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed line-through'
                            : theme.mode === 'dark'
                              ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 hover:scale-105 active:scale-95 shadow-sm'
                              : (theme.palette === 'indigo' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' :
                                 theme.palette === 'blue' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                 theme.palette === 'purple' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' :
                                 theme.palette === 'emerald' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                 'bg-rose-100 text-rose-700 hover:bg-rose-200') + ' hover:scale-105 active:scale-95 shadow-sm'
                        }`}
                        title={isLabelInRemarks ? 'Label already added' : `Add ${label}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  placeholder="Type your remarks or click labels above to add them"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                    theme.mode === 'dark' 
                      ? 'focus:ring-gray-700' 
                      : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                         theme.palette === 'blue' ? 'focus:ring-blue-500' :
                         theme.palette === 'purple' ? 'focus:ring-purple-500' :
                         theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                         'focus:ring-rose-500')
                  } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                />
                {formErrors.remarks && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.remarks}</p>
                )}
              </div>

              <div className="flex gap-3">
                {editingTransactionId && (
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSyncing}
                    className={`flex-1 bg-gray-500 dark:bg-gray-800 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 dark:hover:bg-gray-700 ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={editingTransactionId ? handleUpdateTransaction : handleAddTransaction}
                  disabled={isSyncing}
                  className={`${editingTransactionId ? 'flex-1' : 'w-full'} ${getPrimaryButtonClasses()} py-2 rounded-lg font-semibold ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSyncing 
                    ? 'Saving...' 
                    : editingTransactionId 
                      ? 'Update Transaction' 
                      : 'Add Transaction'}
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  id="success-sound"
                  type="checkbox"
                  checked={playSoundOnSuccess}
                  onChange={(e) => setPlaySoundOnSuccess(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-gray-600"
                />
                <label htmlFor="success-sound" className="select-none">
                  Play sound on successful entry
                </label>
              </div>
            </div>
          </div>
        )}

        {/* View Transactions Tab */}
        {activeTab === 'view' && (
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Showing {tableFilteredTransactions.length} of {transactions.length} transaction{tableFilteredTransactions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {hasActiveFilters() && (
                  <button
                    onClick={clearTableFilters}
                    className="bg-gray-500 dark:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600 dark:hover:bg-gray-700 text-sm"
                  >
                    <X size={16} /> Clear Filters
                  </button>
                )}
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600 text-sm"
                >
                  <Download size={18} /> Export CSV
                </button>
              </div>
            </div>

            {/* Date Filter for View Tab */}


            {isLoadingData ? (
              <p className="text-gray-500 text-center py-8">Loading transactions...</p>
            ) : tableFilteredTransactions.length === 0 ? (
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
                              onClick={() => handleTableSort('date')}
                              className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                            >
                              Date
                              {tableSortColumn === 'date' ? (
                                tableSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : null}
                            </button>
                            <button
                              onClick={(e) => handleFilterPopupToggle('date', e)}
                              className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('date') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Date"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'date' && (
                            <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                              <FilterPopup column="date" label="Date" />
                            </div>
                          )}
                        </th>
                        {/* Category Column */}
                        <th className="px-4 py-3 text-left relative">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTableSort('category')}
                              className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                            >
                              Category
                              {tableSortColumn === 'category' ? (
                                tableSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : null}
                            </button>
                            <button
                              onClick={(e) => handleFilterPopupToggle('category', e)}
                              className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('category') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Category"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'category' && (
                            <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                              <FilterPopup column="category" label="Category" />
                            </div>
                          )}
                        </th>
                        {/* Subcategory Column */}
                        <th className="px-4 py-3 text-left relative">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTableSort('subcategory')}
                              className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                            >
                              Subcategory
                              {tableSortColumn === 'subcategory' ? (
                                tableSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : null}
                            </button>
                            <button
                              onClick={(e) => handleFilterPopupToggle('subcategory', e)}
                              className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('subcategory') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Subcategory"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'subcategory' && (
                            <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                              <FilterPopup column="subcategory" label="Subcategory" />
                            </div>
                          )}
                        </th>
                        {/* Custodian Column */}
                        <th className="px-4 py-3 text-left relative">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTableSort('custodian')}
                              className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                            >
                              Custodian
                              {tableSortColumn === 'custodian' ? (
                                tableSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : null}
                            </button>
                            <button
                              onClick={(e) => handleFilterPopupToggle('custodian', e)}
                              className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('custodian') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Custodian"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'custodian' && (
                            <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                              <FilterPopup column="custodian" label="Custodian" />
                            </div>
                          )}
                        </th>
                        {/* Counterparty Column */}
                        <th className="px-4 py-3 text-left relative">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTableSort('counterparty')}
                              className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                            >
                              Counterparty
                              {tableSortColumn === 'counterparty' ? (
                                tableSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : null}
                            </button>
                            <button
                              onClick={(e) => handleFilterPopupToggle('counterparty', e)}
                              className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('counterparty') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Counterparty"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'counterparty' && (
                            <div className="absolute left-0 md:left-0 right-0 md:right-auto top-full mt-1">
                              <FilterPopup column="counterparty" label="Counterparty" />
                            </div>
                          )}
                        </th>
                        {/* Amount Column */}
                        <th className="px-4 py-3 text-right relative">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleTableSort('amount')}
                              className="text-sm font-semibold hover:text-indigo-600 flex items-center gap-1"
                            >
                              Amount
                              {tableSortColumn === 'amount' ? (
                                tableSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : null}
                            </button>
                            <button
                              onClick={(e) => handleFilterPopupToggle('amount', e)}
                              className={`filter-button p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('amount') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Amount"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'amount' && (
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
                              onClick={(e) => handleFilterPopupToggle('remarks', e)}
                              className={`filter-button ml-auto p-1.5 md:p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation ${columnHasActiveFilter('remarks') ? 'text-indigo-600' : 'text-gray-400'}`}
                              title="Filter"
                              aria-label="Filter by Remarks"
                            >
                              <Filter size={16} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                          {openFilterPopup === 'remarks' && (
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
                      {tablePaginatedTransactions.map(t => (
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
                                onClick={() => handleEditTransaction(t)}
                                disabled={isSyncing}
                                className={`text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold text-sm flex items-center gap-1 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Edit transaction"
                              >
                                <Edit size={16} />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(t.id)}
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
                {tableTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Page {tableCurrentPage} of {tableTotalPages} ({tableFilteredTransactions.length} transactions)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTableCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={tableCurrentPage === 1}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tableCurrentPage === 1
                            ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
                          }`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setTableCurrentPage(prev => Math.min(tableTotalPages, prev + 1))}
                        disabled={tableCurrentPage === tableTotalPages}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tableCurrentPage === tableTotalPages
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
        )}


        {/* Monthly Report Tab */}
        {activeTab === 'report' && (
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Report</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} 
                  {dateFilterMode !== 'allTime' ? ' for selected period' : ' (all time)'}
                </p>
              </div>
              <button
                onClick={exportToCSV}
                className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600"
              >
                <Download size={18} /> Export Report
              </button>
            </div>
            {isLoadingData && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Refreshing data from the server...</p>
            )}

            {/* Date Range Filter */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Period</p>
              
              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleQuickFilter('thisMonth')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisMonth'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handleQuickFilter('thisQuarter')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisQuarter'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Quarter
                </button>
                <button
                  onClick={() => handleQuickFilter('thisFiscalYear')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisFiscalYear'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Fiscal Year
                </button>
                <button
                  onClick={() => handleQuickFilter('allTime')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'allTime'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => {
                    if (dateFilterMode !== 'custom') {
                      // When switching to custom, preserve current range if available
                      if (dateFilterMode !== 'allTime') {
                        const currentRange = getDateRangeForMode(dateFilterMode);
                        setDateRange(currentRange);
                      }
                    }
                    setDateFilterMode('custom');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                    dateFilterMode === 'custom'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <Calendar size={14} /> Custom Range
                </button>
              </div>

              {/* Trustee Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setTrusteeFilter('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${trusteeFilter === ''
                      ? (theme.mode === 'dark'
                          ? 'bg-gray-700 text-white'
                          : getPrimaryButtonClasses() + ' text-white')
                      : 'bg-white dark:bg-black text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`}
                >
                  All Trustees
                </button>
                {trusteeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTrusteeFilter(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${trusteeFilter === option.value
                        ? (theme.mode === 'dark'
                            ? 'bg-gray-700 text-white'
                            : getPrimaryButtonClasses() + ' text-white')
                        : 'bg-white dark:bg-black text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range Inputs */}
              {dateFilterMode === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">From Date</label>
                    <DatePicker
                      selected={dateRange.fromDate ? new Date(dateRange.fromDate) : null}
                      onChange={(date: Date | null) => {
                        setDateRange({
                          ...dateRange,
                          fromDate: date ? date.toISOString().split('T')[0] : '',
                        });
                      }}
                      dateFormat="yyyy-MM-dd"
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                        theme.mode === 'dark' 
                          ? 'focus:ring-gray-700' 
                          : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                             theme.palette === 'blue' ? 'focus:ring-blue-500' :
                             theme.palette === 'purple' ? 'focus:ring-purple-500' :
                             theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                             'focus:ring-rose-500')
                      } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                      placeholderText="Select from date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">To Date</label>
                    <DatePicker
                      selected={dateRange.toDate ? new Date(dateRange.toDate) : null}
                      onChange={(date: Date | null) => {
                        setDateRange({
                          ...dateRange,
                          toDate: date ? date.toISOString().split('T')[0] : '',
                        });
                      }}
                      dateFormat="yyyy-MM-dd"
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                        theme.mode === 'dark' 
                          ? 'focus:ring-gray-700' 
                          : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                             theme.palette === 'blue' ? 'focus:ring-blue-500' :
                             theme.palette === 'purple' ? 'focus:ring-purple-500' :
                             theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                             'focus:ring-rose-500')
                      } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                      placeholderText="Select to date"
                    />
                  </div>
                </div>
              )}

              {/* Display Selected Period */}
              {dateFilterMode !== 'allTime' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Showing: {
                    dateFilterMode === 'custom' 
                      ? `${dateRange.fromDate} to ${dateRange.toDate}`
                      : dateFilterMode === 'thisMonth'
                      ? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                      : dateFilterMode === 'thisQuarter'
                      ? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`
                      : `FY ${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-${new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear()}`
                  }
                </p>
              )}
            </div>

            {/* Surplus/Deficit Badge */}
            <div className="mb-6 flex justify-center">
              <div className={`px-8 py-4 rounded-lg shadow-2xl dark:shadow-[0_15px_35px_rgba(0,0,0,0.9)] transition-all duration-300 hover:scale-105 ${stats.balance >= 0
                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                  : 'bg-gradient-to-r from-red-500 to-red-600'
              } text-white`}>
                <div className="flex items-center gap-3">
                  {stats.balance >= 0 ? (
                    <TrendingUp size={32} />
                  ) : (
                    <TrendingDown size={32} />
                  )}
                  <div>
                    <p className="text-lg font-semibold">
                      {stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT'}
                    </p>
                    <p className="text-3xl font-bold">
                      ₹{Math.abs(stats.balance).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Inflow/Outflow Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border-l-4 border-green-600 dark:border-green-700 shadow-lg dark:shadow-[0_10px_25px_rgba(34,197,94,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(34,197,94,0.3)] transition-all duration-300 hover:-translate-y-1">
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Total Inflow</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.income)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Income for selected period</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border-l-4 border-red-600 dark:border-red-700 shadow-lg dark:shadow-[0_10px_25px_rgba(239,68,68,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(239,68,68,0.3)] transition-all duration-300 hover:-translate-y-1">
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Total Outflow</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.expenses)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Expenses for selected period</p>
              </div>
              <div className={`${stats.balance >= 0 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-700 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(37,99,235,0.3)]' 
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-600 dark:border-orange-700 shadow-lg dark:shadow-[0_10px_25px_rgba(249,115,22,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(249,115,22,0.3)]'
              } rounded-lg p-6 border-l-4 transition-all duration-300 hover:-translate-y-1`}>
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Net Position</p>
                <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {formatCurrency(stats.balance)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Inflow - Outflow</p>
              </div>
            </div>

            {/* Period Comparison */}
            {previousRange && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)]">
                <h3 className="text-lg font-bold mb-4 text-blue-700 dark:text-blue-300">Period Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Current Period: {formatPeriodLabel()}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Income:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(stats.expenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                        <span className={`font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {formatCurrency(stats.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {formatPreviousPeriodLabel()}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Income:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(previousPeriodStats.income)}
                          {previousPeriodStats.income > 0 && (
                            <span className={`text-xs ml-2 ${stats.income > previousPeriodStats.income ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              ({stats.income > previousPeriodStats.income ? '+' : ''}
                              {((stats.income - previousPeriodStats.income) / previousPeriodStats.income * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(previousPeriodStats.expenses)}
                          {previousPeriodStats.expenses > 0 && (
                            <span className={`text-xs ml-2 ${stats.expenses < previousPeriodStats.expenses ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              ({stats.expenses < previousPeriodStats.expenses ? '' : '+'}
                              {((stats.expenses - previousPeriodStats.expenses) / previousPeriodStats.expenses * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                        <span className={`font-bold ${previousPeriodStats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {formatCurrency(previousPeriodStats.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category-wise Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400 flex items-center gap-2">
                  <TrendingUp size={20} /> Income Breakdown by Category
                </h3>
                {getCategoryBreakdown(filteredTransactions, 'Income').length > 0 ? (
                  <div className="space-y-2">
                    {getCategoryBreakdown(filteredTransactions, 'Income').map((item) => {
                      const percentage = stats.income > 0 ? (item.total / stats.income * 100).toFixed(1) : 0;
                      return (
                        <div key={item.sub} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(34,197,94,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(34,197,94,0.3)] transition-all duration-300">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                            <span className="font-bold text-green-600 dark:text-green-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                            <div 
                              className="bg-green-600 dark:bg-green-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentage}% of total income – {item.count} transaction{item.count !== 1 ? 's' : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-4">No income transactions in selected period</p>
                )}
              </div>

              <div>
                 <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
                  <TrendingDown size={20} /> Expense Breakdown by Category
                </h3>
                {getCategoryBreakdown(filteredTransactions, 'Expense').length > 0 ? (
                  <div className="space-y-2">
                     {getCategoryBreakdown(filteredTransactions, 'Expense').map((item) => {
                      const percentage = stats.expenses > 0 ? (item.total / stats.expenses * 100).toFixed(1) : 0;
                      return (
                          <div key={item.sub} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(239,68,68,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition-all duration-300">
                          <div className="flex justify-between items-center mb-1">
                             <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                             <span className="font-bold text-red-600 dark:text-red-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                          </div>
                           <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2">
                            <div 
                               className="bg-red-600 dark:bg-red-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                           <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentage}% of total expenses – {item.count} transaction{item.count !== 1 ? 's' : ''}</p>
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
            {getTransferTotal(filteredTransactions) > 0 && (
              <div className="mt-6">
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
                      {formatCurrency(getTransferTotal(filteredTransactions))}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                    Transfers are internal fund movements between trustees and don't affect the income/expense balance.
                  </p>
                </div>
              </div>
            )}

            {/* Trustee Ledger */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3 text-indigo-700 dark:text-indigo-400">Trustee Ledger</h3>
              {getTrusteeLedger(filteredTransactions).length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No trustee data for this period.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getTrusteeLedger(filteredTransactions).map((item) => (
                     <div
                       key={item.trustee}
                       className="rounded-lg border border-gray-200 dark:border-gray-900 bg-white dark:bg-black p-4 shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1"
                     >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Trustee</p>
                          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{item.trustee}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${item.netPosition >= 0 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                            }`}
                        >
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
        )}
      </div>
    </div>
  );
}


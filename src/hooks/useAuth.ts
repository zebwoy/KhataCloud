/**
 * useAuth.ts — manages auth state, user type selection, login/logout,
 * and animated title transitions for AccountingSystem.
 *
 * Auto-trial mode: fires when the user navigates to /trial (the demo route).
 * Calls /api/auth with userType='trial', stores the JWT in sessionStorage,
 * and sets isLoggedIn=true — AccountingSystem renders without user interaction.
 *
 * For Clerk-authenticated org members: RootApp writes the Clerk JWT to
 * sessionStorage.madrasah_auth_token before rendering AccountingSystem,
 * so isLoggedIn is already true on mount.
 */
import { useState, useEffect } from 'react';
import { SingleValue } from 'react-select';
import type { UserTypeOption } from '../types';

export type UserType = 'admin' | 'trial' | 'org_member' | 'super_admin';

export interface AuthState {
  isLoggedIn:       boolean;
  userType:         UserType;
  displayTitle:     string;
  isTitleAnimating: boolean;
  isAuthenticating: boolean;
  authError:        string;
}

export interface UseAuthReturn extends AuthState {
  handleUserTypeChange: (option: SingleValue<UserTypeOption>) => void;
  handleLogin:  (password: string, onSuccess: () => Promise<void>) => Promise<void>;
  handleLogout: () => void;
}

export default function useAuth(): UseAuthReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    !!sessionStorage.getItem('madrasah_auth_token')
  );

  const [userType, setUserType] = useState<UserType>(() =>
    (sessionStorage.getItem('madrasah_user_type') as UserType) || 'trial'
  );

  const [displayTitle, setDisplayTitle] = useState<string>(() => {
    const saved = (sessionStorage.getItem('madrasah_user_type') as UserType) || 'trial';
    return saved === 'trial' ? 'Trial account for Demo Purpose' : 'KhataCloud';
  });

  const [isTitleAnimating, setIsTitleAnimating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError]               = useState('');

  /**
   * Auto trial mode — fires when user arrives at /trial
   * (linked from the KhataCloud login screen's "Open Demo Account" button).
   * Also accepts the legacy ?trial=1 param for backward compat.
   */
  useEffect(() => {
    const isTrialRoute = window.location.pathname === '/trial';
    const isTrialParam = new URLSearchParams(window.location.search).get('trial') === '1';
    if ((!isTrialRoute && !isTrialParam) || isLoggedIn) return;

    setIsAuthenticating(true);
    setUserType('trial');

    fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: '', userType: 'trial' }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          sessionStorage.setItem('madrasah_auth_token', data.token);
          sessionStorage.setItem('madrasah_user_type', 'trial');
          setIsLoggedIn(true);
          setDisplayTitle('Trial account for Demo Purpose');
          // Clean the URL so a refresh doesn't re-trigger
          if (isTrialParam) window.history.replaceState({}, '', '/trial');
        } else {
          setAuthError('Could not start demo. Please try again.');
        }
      })
      .catch(() => setAuthError('Network error. Please try again.'))
      .finally(() => setIsAuthenticating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUserTypeChange = (option: SingleValue<UserTypeOption>) => {
    const newType = option?.value ?? 'admin';
    if (newType !== userType) {
      setIsTitleAnimating(true);
      setTimeout(() => {
        const title = newType === 'trial' ? 'Trial account for Demo Purpose' : 'KhataCloud';
        setDisplayTitle(title);
        setUserType(newType as UserType);
        setTimeout(() => setIsTitleAnimating(false), 200);
      }, 200);
    } else {
      setUserType(newType as UserType);
    }
  };

  const handleLogin = async (
    password: string,
    onSuccess: () => Promise<void>
  ): Promise<void> => {
    if (userType === 'admin' && !password.trim()) {
      setAuthError('Enter the password');
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');

    try {
      const response = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password, userType }),
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('madrasah_auth_token', data.token);
        sessionStorage.setItem('madrasah_user_type', userType);
        setIsLoggedIn(true);
        setDisplayTitle(
          userType === 'trial' ? 'Trial account for Demo Purpose' : 'KhataCloud'
        );
        await onSuccess();
      } else {
        const data = await response.json().catch(() => null);
        setAuthError(data?.message || 'Incorrect password. Please try again.');
      }
    } catch {
      setAuthError('Unable to login right now. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem('madrasah_auth_token');
    sessionStorage.removeItem('madrasah_logged_in');
    // Keep madrasah_user_type to restore the last selection
  };

  return {
    isLoggedIn, userType, displayTitle, isTitleAnimating,
    isAuthenticating, authError,
    handleUserTypeChange, handleLogin, handleLogout,
  };
}

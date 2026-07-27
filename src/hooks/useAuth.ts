/**
 * useAuth — manages authentication state, user type selection,
 * login/logout handlers, and animated title transitions.
 *
 * onLoginSuccess is called after a successful server response so
 * the caller can kick off data-fetching without coupling the hook
 * to data-fetch logic.
 */
import { useState } from 'react';
import { SingleValue } from 'react-select';
import type { UserTypeOption } from '../types';

export type UserType = 'admin' | 'trial' | 'org_member' | 'super_admin';

export interface AuthState {
  isLoggedIn: boolean;
  userType: UserType;
  displayTitle: string;
  isTitleAnimating: boolean;
  isAuthenticating: boolean;
  authError: string;
}

export interface UseAuthReturn extends AuthState {
  handleUserTypeChange: (option: SingleValue<UserTypeOption>) => void;
  handleLogin: (password: string, onSuccess: () => Promise<void>) => Promise<void>;
  handleLogout: () => void;
}

export default function useAuth(): UseAuthReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!sessionStorage.getItem('madrasah_auth_token');
  });

  const [userType, setUserType] = useState<UserType>(() => {
    return (sessionStorage.getItem('madrasah_user_type') as UserType) || 'trial';
  });

  const [displayTitle, setDisplayTitle] = useState<string>(() => {
    const saved = (sessionStorage.getItem('madrasah_user_type') as UserType) || 'trial';
    return saved === 'trial' ? 'Trial account for Demo Purpose' : 'Millat Quran Learning Centre';
  });

  const [isTitleAnimating, setIsTitleAnimating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleUserTypeChange = (option: SingleValue<UserTypeOption>) => {
    const newUserType = option?.value ?? 'admin';
    if (newUserType !== userType) {
      setIsTitleAnimating(true);
      setTimeout(() => {
        const newTitle =
          newUserType === 'trial'
            ? 'Trial account for Demo Purpose'
            : 'Millat Quran Learning Centre';
        setDisplayTitle(newTitle);
        setUserType(newUserType as UserType);
        setTimeout(() => setIsTitleAnimating(false), 200);
      }, 200);
    } else {
      setUserType(newUserType as UserType);
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
      const response = await fetch('/.netlify/functions/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userType }),
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('madrasah_auth_token', data.token);
        sessionStorage.setItem('madrasah_user_type', userType);
        setIsLoggedIn(true);
        const title =
          userType === 'trial'
            ? 'Trial account for Demo Purpose'
            : 'Millat Quran Learning Centre';
        setDisplayTitle(title);
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
    // Keep madrasah_user_type in sessionStorage to maintain userType selection
  };

  return {
    isLoggedIn,
    userType,
    displayTitle,
    isTitleAnimating,
    isAuthenticating,
    authError,
    handleUserTypeChange,
    handleLogin,
    handleLogout,
  };
}

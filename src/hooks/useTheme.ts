/**
 * useTheme — manages theme state with localStorage persistence,
 * applies dark-mode CSS class + palette CSS variables to document,
 * and provides a utility for primary button class generation.
 */
import { useState, useEffect } from 'react';
import type { Theme } from '../types';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getPrimaryButtonClasses: (isActive?: boolean) => string;
}

export default function useTheme(): UseThemeReturn {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('kc_theme') || localStorage.getItem('madrasah_theme');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { mode: 'light', palette: 'indigo' };
      }
    }
    return { mode: 'light', palette: 'indigo' };
  });

  // Persist theme and apply to document
  useEffect(() => {
    localStorage.setItem('kc_theme', JSON.stringify(theme));
    const root = document.documentElement;
    root.classList.toggle('dark', theme.mode === 'dark');
    root.setAttribute('data-theme', theme.palette);

    // Set CSS variable for DatePicker selected color
    if (theme.mode === 'light') {
      const paletteColors: Record<string, string> = {
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

  const getPrimaryButtonClasses = (isActive = true): string => {
    if (!isActive) {
      return 'bg-gray-100 dark:bg-gray-900 dark:border-gray-800 text-gray-700 dark:text-gray-300 border dark:border-gray-900';
    }
    if (theme.mode === 'dark') {
      return 'bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white';
    }
    const paletteMap: Record<string, string> = {
      indigo: 'bg-indigo-600 hover:bg-indigo-700',
      blue: 'bg-blue-600 hover:bg-blue-700',
      purple: 'bg-purple-600 hover:bg-purple-700',
      emerald: 'bg-emerald-600 hover:bg-emerald-700',
      rose: 'bg-rose-600 hover:bg-rose-700',
    };
    return paletteMap[theme.palette] + ' text-white';
  };

  return { theme, setTheme, getPrimaryButtonClasses };
}

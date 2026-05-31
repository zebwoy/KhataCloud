// ============================================================
// Theme utility functions for HisaabKitaab
// Eliminates the 50+ inline palette ternary chains
// ============================================================

import type { Theme, ColorPalette } from './types';

// Palette color maps
const paletteColors: Record<ColorPalette, {
  bg600: string;
  bg500: string;
  bg100: string;
  text700: string;
  ring500: string;
  hover200: string;
}> = {
  indigo: { bg600: 'bg-indigo-600', bg500: 'bg-indigo-500', bg100: 'bg-indigo-100', text700: 'text-indigo-700', ring500: 'focus:ring-indigo-500', hover200: 'hover:bg-indigo-200' },
  blue:   { bg600: 'bg-blue-600',   bg500: 'bg-blue-500',   bg100: 'bg-blue-100',   text700: 'text-blue-700',   ring500: 'focus:ring-blue-500',   hover200: 'hover:bg-blue-200' },
  purple: { bg600: 'bg-purple-600', bg500: 'bg-purple-500', bg100: 'bg-purple-100', text700: 'text-purple-700', ring500: 'focus:ring-purple-500', hover200: 'hover:bg-purple-200' },
  emerald:{ bg600: 'bg-emerald-600', bg500: 'bg-emerald-500', bg100: 'bg-emerald-100', text700: 'text-emerald-700', ring500: 'focus:ring-emerald-500', hover200: 'hover:bg-emerald-200' },
  rose:   { bg600: 'bg-rose-600',   bg500: 'bg-rose-500',   bg100: 'bg-rose-100',   text700: 'text-rose-700',   ring500: 'focus:ring-rose-500',   hover200: 'hover:bg-rose-200' },
};

/** Get the primary bg class for buttons (e.g., 'bg-indigo-600') */
export const getPrimaryBg = (palette: ColorPalette): string => paletteColors[palette].bg600;

/** Get the primary button class string (e.g., 'bg-indigo-600') */
export const getPrimaryButtonClass = (theme: Theme): string => {
  if (theme.mode === 'dark') return 'bg-gray-700';
  return paletteColors[theme.palette].bg600;
};

/** Get the focus ring class (e.g., 'focus:ring-indigo-500') */
export const getFocusRingClass = (theme: Theme): string => {
  if (theme.mode === 'dark') return 'focus:ring-gray-700';
  return paletteColors[theme.palette].ring500;
};

/** Get active filter toggle classes (active vs. inactive) */
export const getFilterButtonClasses = (theme: Theme, isActive: boolean): string => {
  if (isActive) {
    return theme.mode === 'dark'
      ? 'bg-gray-700 text-white'
      : `${paletteColors[theme.palette].bg600} text-white`;
  }
  return 'bg-white dark:bg-black text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900';
};

/** Get label/chip button classes (e.g., for remark labels) */
export const getLabelButtonClasses = (theme: Theme): string => {
  if (theme.mode === 'dark') return 'bg-gray-800 text-gray-200 hover:bg-gray-700';
  const p = paletteColors[theme.palette];
  return `${p.bg100} ${p.text700} ${p.hover200}`;
};

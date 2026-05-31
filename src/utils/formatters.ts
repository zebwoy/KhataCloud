/**
 * Pure formatting utilities for HisaabKitaab.
 * No React state, no side effects — safe to import anywhere.
 */

/** Format a number as INR currency (₹1,234.56) */
export const formatCurrency = (value: number): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
};

/** Parse a YYYY-MM-DD string as a local date (avoids UTC timezone shifts) */
export const parseLocalDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const fallback = new Date(dateString);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

/** Format date as "1st January 2026 (Wednesday)" */
export const formatDisplayDate = (dateString: string): string => {
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

/** Format date as "31 May 2026" */
export const formatDisplayDateShort = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  if (!date) return dateString || '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

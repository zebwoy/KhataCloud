/**
 * ui/Spinner.tsx — KhataCloud loading spinners
 *
 * PageSpinner now delegates to LoadingScreen so both App.tsx and RootApp.tsx
 * show the exact same visual loader — one design, zero divergence.
 */
import LoadingScreen from '../components/LoadingScreen';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<SpinnerSize, number> = { xs: 12, sm: 16, md: 20, lg: 28, xl: 40 };

/** Inline spinner — used inside buttons, cards, etc. */
export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return <Loader2 size={sizes[size]} className={['animate-spin text-current', className].join(' ')} />;
}

/** Full-screen centered spinner — delegates to the unified LoadingScreen */
export function PageSpinner({ label }: { label?: string }) {
  return <LoadingScreen label={label} />;
}

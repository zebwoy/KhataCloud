/**
 * ui/Spinner.tsx — KhataCloud loading spinner
 */
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<SpinnerSize, number> = { xs: 12, sm: 16, md: 20, lg: 28, xl: 40 };

export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return <Loader2 size={sizes[size]} className={['animate-spin text-current', className].join(' ')} />;
}

/** Full-screen centered spinner for page-level loading */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-950">
      <Spinner size="md" className="text-slate-600" />
      {label && <p className="text-xs text-slate-500">{label}</p>}
    </div>
  );
}

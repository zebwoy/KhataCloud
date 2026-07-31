/**
 * ui/Alert.tsx — KhataCloud alert / notification banner
 *
 * Variants: info | success | warning | error
 * Features: dismissible, optional title, icon
 */
import { useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, XCircle, X, type LucideIcon } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?:     AlertVariant;
  title?:       string;
  dismissible?: boolean;
  className?:   string;
  children:     React.ReactNode;
}

const config: Record<AlertVariant, {
  wrapper: string;
  icon: LucideIcon;
  iconClass: string;
}> = {
  info: {
    wrapper:   'bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-950/30 dark:border-violet-800/40 dark:text-violet-300',
    icon:      Info,
    iconClass: 'text-violet-500',
  },
  success: {
    wrapper:   'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300',
    icon:      CheckCircle2,
    iconClass: 'text-emerald-500',
  },
  warning: {
    wrapper:   'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-300',
    icon:      AlertTriangle,
    iconClass: 'text-amber-500',
  },
  error: {
    wrapper:   'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-300',
    icon:      XCircle,
    iconClass: 'text-red-500',
  },
};

export function Alert({ variant = 'info', title, dismissible = false, className = '', children }: AlertProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { wrapper, icon: Icon, iconClass } = config[variant];

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        wrapper,
        className,
      ].join(' ')}
    >
      <Icon size={16} className={['shrink-0 mt-0.5', iconClass].join(' ')} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity -mt-0.5 -mr-1"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

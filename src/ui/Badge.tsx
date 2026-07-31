/**
 * ui/Badge.tsx — KhataCloud status badge component
 *
 * Variants: success | warning | danger | info | neutral | pending
 * Features: optional dot indicator with pulse animation
 */

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';
export type BadgeSize    = 'sm' | 'md';

export interface BadgeProps {
  variant?:  BadgeVariant;
  size?:     BadgeSize;
  dot?:      boolean;
  pulse?:    boolean;
  children:  React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:text-emerald-400',
    dot:   'bg-emerald-500',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-600 border-amber-500/25 dark:text-amber-400',
    dot:   'bg-amber-400',
  },
  danger: {
    badge: 'bg-red-500/15 text-red-600 border-red-500/25 dark:text-red-400',
    dot:   'bg-red-500',
  },
  info: {
    badge: 'bg-violet-500/15 text-violet-600 border-violet-500/25 dark:text-violet-400',
    dot:   'bg-violet-500',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dot:   'bg-slate-400',
  },
  pending: {
    badge: 'bg-amber-500/15 text-amber-600 border-amber-500/25 dark:text-amber-400',
    dot:   'bg-amber-400',
  },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  children,
  className = '',
}: BadgeProps) {
  const { badge, dot: dotColor } = variantClasses[variant];
  return (
    <span
      className={[
        'inline-flex items-center font-semibold rounded-full border capitalize',
        badge,
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={[
            'rounded-full shrink-0',
            size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
            dotColor,
            pulse ? 'animate-pulse' : '',
          ].join(' ')}
        />
      )}
      {children}
    </span>
  );
}

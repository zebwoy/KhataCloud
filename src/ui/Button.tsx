/**
 * ui/Button.tsx — KhataCloud universal button component
 *
 * Variants: primary | secondary | ghost | danger | outline
 * Sizes:    sm | md | lg
 * Features: loading state, left/right icon slots, full-width mode
 *
 * Works on both light (product app) and dark (admin panel) surfaces.
 */
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  fullWidth?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white shadow-sm shadow-violet-900/30 disabled:bg-violet-300 dark:disabled:bg-violet-900/40',
  secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 disabled:opacity-50',
  ghost:     'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300 disabled:opacity-50',
  danger:    'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-sm disabled:opacity-50',
  outline:   'bg-transparent border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800/50 dark:text-slate-300 disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

const iconSizes: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 17 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-semibold transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
          'dark:focus-visible:ring-offset-slate-950',
          'disabled:cursor-not-allowed select-none',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          className,
        ].join(' ')}
        {...rest}
      >
        {loading ? (
          <Loader2 size={iconSizes[size]} className="animate-spin shrink-0" />
        ) : leftIcon ? (
          <span className="shrink-0 flex items-center">{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

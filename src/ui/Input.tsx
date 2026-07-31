/**
 * ui/Input.tsx — KhataCloud form input component
 *
 * Features: label, helper text, error state, left/right icon/addon slots
 * Works on both light and dark surfaces.
 */
import { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:      string;
  hint?:       string;
  error?:      string;
  leftIcon?:   React.ReactNode;
  rightSlot?:  React.ReactNode;
  fullWidth?:  boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, rightSlot, fullWidth = true, className = '', id: propId, ...rest }, ref) => {
    const autoId = useId();
    const id = propId ?? autoId;

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={[
              'w-full rounded-xl border bg-white dark:bg-slate-800/60 text-slate-900 dark:text-slate-100',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'transition-shadow duration-150',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
              error
                ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700',
              leftIcon ? 'pl-9' : 'pl-3.5',
              rightSlot ? 'pr-10' : 'pr-3.5',
              'py-2.5 text-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className,
            ].join(' ')}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...rest}
          />
          {rightSlot && (
            <span className="absolute right-3 flex items-center text-slate-400 dark:text-slate-500">
              {rightSlot}
            </span>
          )}
        </div>
        {error && (
          <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle size={11} className="shrink-0" />
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

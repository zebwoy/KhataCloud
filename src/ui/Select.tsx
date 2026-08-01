/**
 * ui/Select.tsx — KhataCloud custom dropdown select
 *
 * Replaces native <select> with a fully styled, keyboard-accessible
 * dropdown that matches the dark slate design system.
 *
 * Usage:
 *   <Select
 *     label="Plan"
 *     value={plan}
 *     onChange={setPlan}
 *     options={[
 *       { value: 'free',  label: 'Free' },
 *       { value: 'basic', label: 'Basic' },
 *     ]}
 *   />
 */
import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional descriptive text shown below the label in the dropdown */
  description?: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Label rendered above the trigger button */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Additional class names on the root wrapper */
  className?: string;
}

export function Select({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select…',
  disabled = false,
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 cursor-pointer"
        >
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          w-full flex items-center justify-between gap-3
          bg-slate-800 border rounded-xl px-4 py-2.5
          text-sm transition-all duration-150 text-left
          focus:outline-none focus:ring-2 focus:ring-indigo-500
          ${open
            ? 'border-indigo-500/70 ring-2 ring-indigo-500/30'
            : 'border-slate-700 hover:border-slate-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className={selected ? 'text-white' : 'text-slate-500'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="
            absolute z-50 left-0 right-0 mt-1.5
            bg-slate-800 border border-slate-700/80
            rounded-xl shadow-xl shadow-black/50
            overflow-hidden
            animate-in fade-in-0 zoom-in-95 duration-100
          "
        >
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`
                  w-full flex items-center justify-between gap-3
                  px-4 py-2.5 text-sm text-left transition-colors duration-100
                  ${isSelected
                    ? 'bg-indigo-600/15 text-indigo-300'
                    : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'}
                `}
              >
                <span className="flex flex-col">
                  <span>{opt.label}</span>
                  {opt.description && (
                    <span className="text-xs text-slate-500 font-normal mt-0.5">{opt.description}</span>
                  )}
                </span>
                {isSelected && <Check size={14} className="text-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

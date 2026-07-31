/**
 * ui/Separator.tsx — KhataCloud divider component
 */

export interface SeparatorProps {
  label?:      string;
  orientation?: 'horizontal' | 'vertical';
  className?:  string;
}

export function Separator({ label, orientation = 'horizontal', className = '' }: SeparatorProps) {
  if (orientation === 'vertical') {
    return <div className={['w-px bg-slate-200 dark:bg-slate-800 self-stretch', className].join(' ')} />;
  }

  if (label) {
    return (
      <div className={['flex items-center gap-3 my-2', className].join(' ')}>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  return <div className={['h-px bg-slate-200 dark:bg-slate-800 my-2', className].join(' ')} />;
}

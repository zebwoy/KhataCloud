/**
 * ui/Card.tsx — KhataCloud card / surface component
 *
 * Variants: elevated | bordered | flat
 * Surface:  auto (inherits), light, dark
 */

export type CardVariant = 'elevated' | 'bordered' | 'flat';
export type CardSurface = 'auto' | 'light' | 'dark';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  variant?:   CardVariant;
  surface?:   CardSurface;
  padding?:   CardPadding;
  className?: string;
  children:   React.ReactNode;
  onClick?:   React.MouseEventHandler<HTMLDivElement>;
}

const variantClasses: Record<CardVariant, string> = {
  elevated: 'shadow-md shadow-black/5 dark:shadow-black/30',
  bordered: 'border border-slate-200 dark:border-slate-800',
  flat:     '',
};

const surfaceClasses: Record<CardSurface, string> = {
  auto:  '',
  light: 'bg-white text-slate-900',
  dark:  'bg-slate-900 text-slate-100',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6 lg:p-8',
};

export function Card({
  variant = 'bordered',
  surface = 'auto',
  padding = 'md',
  className = '',
  children,
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-2xl overflow-hidden',
        variantClasses[variant],
        surfaceClasses[surface],
        paddingClasses[padding],
        onClick ? 'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/** Card subcomponents for structured layouts */
export function CardHeader({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={['px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between', className].join(' ')}>
      {children}
    </div>
  );
}

export function CardBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={['px-5 py-4', className].join(' ')}>{children}</div>;
}

export function CardFooter({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={['px-5 py-4 border-t border-slate-200 dark:border-slate-800', className].join(' ')}>
      {children}
    </div>
  );
}

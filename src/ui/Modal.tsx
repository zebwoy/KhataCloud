/**
 * ui/Modal.tsx — KhataCloud accessible modal dialog
 *
 * Features: backdrop blur, close on Escape, Header/Body/Footer slots, size variants
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title?:     string;
  size?:      ModalSize;
  className?: string;
  children:   React.ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-full mx-4',
};

export function Modal({ open, onClose, title, size = 'md', className = '', children }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={[
          'relative w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-black/40',
          'border border-slate-200 dark:border-slate-800',
          'flex flex-col max-h-[90vh]',
          sizeClasses[size],
          className,
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 id="modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors -mr-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function ModalBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={['px-6 py-5', className].join(' ')}>{children}</div>;
}

export function ModalFooter({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={['px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0', className].join(' ')}>
      {children}
    </div>
  );
}

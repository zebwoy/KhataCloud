/**
 * ui/Avatar.tsx — KhataCloud avatar component
 *
 * Initials-based with image fallback. Configurable size and color.
 */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name?:      string;
  src?:       string;
  size?:      AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { wrapper: string; text: string }> = {
  xs: { wrapper: 'w-6 h-6',   text: 'text-[9px]' },
  sm: { wrapper: 'w-8 h-8',   text: 'text-[11px]' },
  md: { wrapper: 'w-10 h-10', text: 'text-sm' },
  lg: { wrapper: 'w-12 h-12', text: 'text-base' },
  xl: { wrapper: 'w-16 h-16', text: 'text-xl' },
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic color from name
const COLORS = [
  'bg-violet-600', 'bg-indigo-600', 'bg-emerald-600',
  'bg-rose-600',   'bg-amber-600',  'bg-sky-600',
  'bg-pink-600',   'bg-teal-600',
];

function getColor(name?: string): string {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const { wrapper, text } = sizeClasses[size];
  const bg = getColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={[
        wrapper,
        'rounded-full flex items-center justify-center overflow-hidden shrink-0 select-none font-bold text-white',
        src ? '' : bg,
        className,
      ].join(' ')}
      aria-label={name}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={text}>{initials}</span>
      )}
    </div>
  );
}

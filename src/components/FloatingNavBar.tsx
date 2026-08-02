/**
 * FloatingNavBar.tsx — Premium floating navigation bar
 *
 * Desktop: pill-shaped, centered, fixed at top with glass morphism
 * Mobile: full-width bottom tab bar
 *
 * Features:
 * - "Admin" tab appears only for org admins
 * - Notification badge on Admin tab for pending join requests
 * - <UserButton /> from Clerk for profile / sign-out
 * - Smooth hover and active animations
 */
import { useState, useEffect } from 'react';
import { useAuth, UserButton } from '@clerk/react';
import { BookOpen, BarChart2, ShieldAlert } from 'lucide-react';

interface FloatingNavBarProps {
  isAdmin:         boolean;
  activeSection:   'transactions' | 'reports' | 'admin';
  onSectionChange: (s: 'transactions' | 'reports' | 'admin') => void;
  orgId?:          string;
}

export default function FloatingNavBar({
  isAdmin,
  activeSection,
  onSectionChange,
  orgId,
}: FloatingNavBarProps) {
  const { getToken } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending requests count every 60 seconds (org admins only)
  useEffect(() => {
    if (!isAdmin || !orgId) return;
    const fetchCount = async () => {
      try {
        const token = await getToken();
        const r = await fetch('/api/org-admin?action=pending-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const data = await r.json();
          setPendingCount(data.count ?? 0);
        }
      } catch { /* non-critical */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [isAdmin, orgId, getToken]);

  const navItems = [
    { key: 'transactions', label: 'Transactions', icon: BookOpen },
    { key: 'reports',      label: 'Reports',      icon: BarChart2 },
    ...(isAdmin ? [{ key: 'admin', label: 'Admin', icon: ShieldAlert }] : []),
  ] as { key: 'transactions' | 'reports' | 'admin'; label: string; icon: React.ElementType }[];

  return (
    <>
      {/* ── Desktop: top-center pill ── */}
      <nav className="
        hidden md:flex
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        items-center gap-1
        bg-slate-900/80 backdrop-blur-xl
        border border-white/10
        rounded-2xl px-3 py-2
        shadow-2xl shadow-black/40
      ">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 px-3 mr-1">
          <img
            src="/logo.png"
            alt="KhataCloud"
            className="w-8 h-8 rounded-xl object-cover shadow-md shadow-black/30"
          />
          <span className="text-sm font-bold text-white tracking-tight hidden lg:block">
            KhataCloud
          </span>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Nav items */}
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          const hasBadge = key === 'admin' && pendingCount > 0;
          return (
            <button
              key={key}
              id={`nav-${key}`}
              onClick={() => onSectionChange(key)}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-xl
                text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-violet-600/90 text-white shadow-lg shadow-violet-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/8'
                }
              `}
            >
              <Icon size={15} />
              {label}
              {hasBadge && (
                <span className="
                  absolute -top-1 -right-1
                  min-w-[18px] h-[18px] px-1
                  rounded-full bg-rose-500
                  text-white text-[10px] font-bold
                  flex items-center justify-center
                  animate-pulse
                ">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Clerk UserButton */}
        <div className="flex items-center px-1">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8 ring-2 ring-white/20 hover:ring-violet-400/50 transition-all',
              },
            }}
          />
        </div>
      </nav>

      {/* ── Mobile: bottom tab bar ── */}
      <nav className="
        md:hidden
        fixed bottom-0 left-0 right-0 z-50
        bg-slate-900/95 backdrop-blur-xl
        border-t border-white/10
        px-2 pb-safe
        shadow-[0_-8px_32px_rgba(0,0,0,0.5)]
      ">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = activeSection === key;
            const hasBadge = key === 'admin' && pendingCount > 0;
            return (
              <button
                key={key}
                id={`nav-mobile-${key}`}
                onClick={() => onSectionChange(key)}
                className={`
                  relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl
                  transition-all duration-200 min-w-[60px]
                  ${isActive ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'}
                `}
              >
                <div className={`
                  relative p-1.5 rounded-xl transition-all
                  ${isActive ? 'bg-violet-600/20' : ''}
                `}>
                  <Icon size={20} />
                  {hasBadge && (
                    <span className="
                      absolute -top-0.5 -right-0.5
                      min-w-[16px] h-[16px] px-0.5
                      rounded-full bg-rose-500
                      text-white text-[9px] font-bold
                      flex items-center justify-center
                    ">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
          {/* User profile button on mobile */}
          <div className="flex flex-col items-center gap-1 px-4 py-2 min-w-[60px]">
            <div className="p-1">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-7 h-7',
                  },
                }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500">Profile</span>
          </div>
        </div>
      </nav>
    </>
  );
}

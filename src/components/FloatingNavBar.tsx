/**
 * FloatingNavBar.tsx — Premium floating navigation bar
 * Reverted to commit d685080
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth, UserButton } from '@clerk/react';
import { BookOpen, BarChart2, ShieldAlert, Eye, Plus } from 'lucide-react';

export interface FloatingNavBarProps {
  isAdmin: boolean;
  activeSection: 'transactions' | 'reports' | 'admin';
  onSectionChange: (s: 'transactions' | 'reports' | 'admin') => void;
  transactionSubView: 'view' | 'add';
  onSubViewChange: (v: 'view' | 'add') => void;
  navStyle?: 'pill' | 'classic';
  orgId?: string;
  trialMode?: boolean;
}

interface SubMenuContentProps {
  transactionSubView: 'view' | 'add';
  onSubViewChange: (v: 'view' | 'add') => void;
  onClose: () => void;
}

function SubMenuContent({ transactionSubView, onSubViewChange, onClose }: SubMenuContentProps) {
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSubViewChange('view');
          onClose();
        }}
        className={`
          flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-150 w-full text-left
          ${transactionSubView === 'view'
            ? 'bg-violet-600/90 text-white shadow-lg shadow-violet-500/20'
            : 'text-slate-300 hover:text-white hover:bg-white/8'}
        `}
      >
        <Eye size={14} /> All Transactions
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSubViewChange('add');
          onClose();
        }}
        className={`
          flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-150 w-full text-left
          ${transactionSubView === 'add'
            ? 'bg-violet-600/90 text-white shadow-lg shadow-violet-500/20'
            : 'text-slate-300 hover:text-white hover:bg-white/8'}
        `}
      >
        <Plus size={14} /> New Transaction
      </button>
    </>
  );
}

// Clerk appearance config — ONLY avatarBox trigger styling.
// All popover card visuals are handled exclusively by CSS in index.css
// to avoid dual-layer conflicts (inline styles vs !important CSS).
const clerkUserButtonAppearance = {
  elements: {
    avatarBox: 'w-8 h-8 ring-2 ring-white/20 hover:ring-violet-400/50 transition-all',
  },
};

function TrialUserPopover() {
  return (
    <div
      className="
        absolute top-full mt-3 right-0 z-50
        bg-slate-900/95 backdrop-blur-xl border border-white/10
        rounded-2xl p-4 shadow-2xl shadow-black/80
        flex flex-col gap-3 min-w-[270px]
        section-enter text-left
      "
      onClick={(e) => e.stopPropagation()}
    >
      {/* User Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 ring-2 ring-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
          DA
        </div>
        <div className="overflow-hidden">
          <h4 className="text-sm font-semibold text-white truncate">Demo Administrator</h4>
          <p className="text-xs text-slate-400 truncate">demo@khata.cloud</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium">
            Demo Account • Read Only
          </span>
        </div>
      </div>

      {/* Profile Actions */}
      <div className="flex flex-col gap-1 py-1">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 bg-white/5 opacity-65 cursor-not-allowed">
          <span>Manage Account</span>
          <span className="text-[10px] text-slate-500 font-mono">(Unavailable)</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 bg-white/5 opacity-65 cursor-not-allowed">
          <span>Sign Out</span>
          <span className="text-[10px] text-slate-500 font-mono">(Demo Mode)</span>
        </div>
      </div>

      <div className="pt-2 border-t border-white/10 text-center">
        <p className="text-[11px] text-slate-400">
          Viewing interactive live demo. Settings and customisation are active.
        </p>
      </div>
    </div>
  );
}

export default function FloatingNavBar({
  isAdmin,
  activeSection,
  onSectionChange,
  transactionSubView,
  onSubViewChange,
  navStyle = 'pill',
  orgId,
  trialMode = false,
}: FloatingNavBarProps) {
  const { getToken } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showTrialUserPopover, setShowTrialUserPopover] = useState(false);
  const subMenuDesktopRef = useRef<HTMLDivElement>(null);
  const subMenuMobileRef = useRef<HTMLDivElement>(null);
  const txnBtnDesktopRef = useRef<HTMLButtonElement>(null);
  const txnBtnMobileRef = useRef<HTMLButtonElement>(null);
  const trialUserRef = useRef<HTMLDivElement>(null);

  // Poll pending requests count every 60 s (org admins only)
  useEffect(() => {
    if (!isAdmin || !orgId || trialMode) return;
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
  }, [isAdmin, orgId, getToken, trialMode]);

  // Close sub-menu & trial user popover on outside click
  useEffect(() => {
    if (!showSubMenu && !showTrialUserPopover) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inDesktopMenu = subMenuDesktopRef.current?.contains(t);
      const inMobileMenu = subMenuMobileRef.current?.contains(t);
      const inDesktopBtn = txnBtnDesktopRef.current?.contains(t);
      const inMobileBtn = txnBtnMobileRef.current?.contains(t);
      const inTrialUser = trialUserRef.current?.contains(t);

      if (!inDesktopMenu && !inMobileMenu && !inDesktopBtn && !inMobileBtn) {
        setShowSubMenu(false);
      }
      if (!inTrialUser) {
        setShowTrialUserPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSubMenu, showTrialUserPopover]);

  const handleTransactionsClick = () => {
    if (navStyle === 'pill') {
      if (activeSection !== 'transactions') {
        onSectionChange('transactions');
        onSubViewChange('view');
        setShowSubMenu(true);
      } else {
        setShowSubMenu(v => !v);
      }
    } else {
      onSectionChange('transactions');
      onSubViewChange('view');
      setShowSubMenu(false);
    }
  };

  const showAdmin = isAdmin || trialMode;

  const navItems = [
    { key: 'transactions', label: 'Transactions', icon: BookOpen },
    { key: 'reports', label: 'Reports', icon: BarChart2 },
    ...(showAdmin ? [{ key: 'admin', label: 'Admin', icon: ShieldAlert }] : []),
  ] as { key: 'transactions' | 'reports' | 'admin'; label: string; icon: React.ElementType }[];

  return (
    <>
      {/* ── Desktop: top-center pill ─────────────────────────────────────── */}
      <nav className="
        hidden md:flex
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        items-center gap-6
        bg-slate-900/70
        border border-white/10
        rounded-2xl px-10 py-1
        shadow-2xl shadow-black/50"
        style={{ backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-5 mr-3 shrink-0">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-black/30 shrink-0">
            <img src="/logo.png" alt="KhataCloud" className="w-full h-full object-cover scale-[1.18]" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight hidden lg:block">
            KhataCloud
          </span>
        </div>

        <div className="w-px h-5 bg-white/10 mx-6" />

        {/* Nav items */}
        <div className="flex items-center gap-4">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = activeSection === key;
            const hasBadge = key === 'admin' && pendingCount > 0;
            const isTxn = key === 'transactions';
            return (
              <div key={key} className="relative">
                <button
                  ref={isTxn ? txnBtnDesktopRef : undefined}
                  id={`nav-${key}`}
                  onClick={() => {
                    if (isTxn) {
                      handleTransactionsClick();
                    } else {
                      onSectionChange(key);
                      setShowSubMenu(false);
                    }
                  }}
                  className={`
                  relative flex items-center gap-2.5 rounded-xl
                  text-sm font-medium transition-all duration-200
                  ${isActive
                      ? 'px-6 py-1 bg-violet-600/90 text-white shadow-lg shadow-violet-500/25'
                      : 'px-4 py-1 text-slate-400 hover:text-white hover:bg-white/8'
                    }
                `}
                >
                  <Icon size={15} />
                  {label}
                  {/* Sub-view indicator dot */}
                  {isTxn && isActive && navStyle === 'pill' && (
                    <span className={`
                    w-1.5 h-1.5 rounded-full ml-0.5 shrink-0
                    ${transactionSubView === 'add' ? 'bg-emerald-400' : 'bg-white/30'}
                  `} />
                  )}
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

                {/* Desktop sub-menu popover */}
                {isTxn && showSubMenu && navStyle === 'pill' && (
                  <div
                    ref={subMenuDesktopRef}
                    className="
                    absolute top-full mt-3 left-0 z-50
                    bg-slate-900/70 border border-white/10
                    rounded-2xl p-1.5 shadow-2xl shadow-black/50
                    flex flex-col gap-0.5 min-w-[200px]
                    section-enter
                  "
                    style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                  >
                    <SubMenuContent
                      transactionSubView={transactionSubView}
                      onSubViewChange={onSubViewChange}
                      onClose={() => setTimeout(() => setShowSubMenu(false), 20)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="w-px h-5 bg-white/10 mx-6" />

        {/* Avatar — Clerk UserButton or trial mode popover avatar */}
        {!trialMode ? (
          <div className="flex items-center px-3">
            <UserButton appearance={clerkUserButtonAppearance} />
          </div>
        ) : (
          <div ref={trialUserRef} className="relative flex items-center px-3">
            <button
              onClick={() => setShowTrialUserPopover(v => !v)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 ring-2 ring-white/20 hover:ring-violet-400/50 transition-all flex items-center justify-center text-white font-bold text-xs shadow-md"
              title="Demo Administrator (Click for info)"
            >
              DA
            </button>
            {showTrialUserPopover && <TrialUserPopover />}
          </div>
        )}
      </nav>

      {/* ── Mobile: bottom tab bar ───────────────────────────────────────── */}
      <nav className="
        md:hidden
        fixed bottom-0 left-0 right-0 z-50
        bg-slate-900 backdrop-blur-xl
        border-t border-white/10
        shadow-[0_-8px_32px_rgba(0,0,0,0.5)]
      ">
        {/* Mobile sub-menu (floats above the tab bar) */}
        {activeSection === 'transactions' && showSubMenu && navStyle === 'pill' && (
          <div
            ref={subMenuMobileRef}
            className="
              mx-4
              bg-slate-900/70 backdrop-blur-xl border border-white/10
              rounded-2xl p-1.5 shadow-2xl shadow-black/60
              flex gap-1.5
              section-enter
            " style={{ marginTop: '1rem' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSubViewChange('view');
                setTimeout(() => setShowSubMenu(false), 20);
              }}
              className={`
                flex-1 flex items-center justify-center gap-2
                py-2.5 px-3 rounded-xl text-sm font-medium
                transition-all duration-150
                ${transactionSubView === 'view'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'}
              `}
            >
              <Eye size={14} /> All
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSubViewChange('add');
                setTimeout(() => setShowSubMenu(false), 20);
              }}
              className={`
                flex-1 flex items-center justify-center gap-2
                py-2.5 px-3 rounded-xl text-sm font-medium
                transition-all duration-150
                ${transactionSubView === 'add'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'}
              `}
            >
              <Plus size={14} /> New
            </button>
          </div>
        )}

        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = activeSection === key;
            const hasBadge = key === 'admin' && pendingCount > 0;
            const isTxn = key === 'transactions';
            return (
              <button
                key={key}
                ref={isTxn ? txnBtnMobileRef : undefined}
                id={`nav-mobile-${key}`}
                onClick={() => {
                  if (isTxn) {
                    handleTransactionsClick();
                  } else {
                    onSectionChange(key);
                    setShowSubMenu(false);
                  }
                }}
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
                {/* Green dot when in "add" sub-view */}
                {isTxn && isActive && navStyle === 'pill' && transactionSubView === 'add' && (
                  <span className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}

          {/* Profile / Settings slot */}
          {!trialMode ? (
            <div className="flex flex-col items-center gap-1 px-4 py-2 min-w-[60px]">
              <div className="p-1">
                <UserButton
                  appearance={{
                    ...clerkUserButtonAppearance,
                    elements: {
                      ...clerkUserButtonAppearance.elements,
                      avatarBox: 'w-7 h-7 ring-2 ring-white/20 hover:ring-violet-400/50 transition-all',
                    },
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-500">Settings</span>
            </div>
          ) : (
            <div ref={trialUserRef} className="relative flex flex-col items-center gap-1 px-4 py-2 min-w-[60px]">
              <button
                onClick={() => setShowTrialUserPopover(v => !v)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 ring-2 ring-white/20 hover:ring-violet-400/50 transition-all flex items-center justify-center text-white font-bold text-xs shadow-md"
                title="Demo Administrator"
              >
                DA
              </button>
              <span className="text-[10px] font-medium text-slate-400">Trial</span>
              {showTrialUserPopover && <TrialUserPopover />}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

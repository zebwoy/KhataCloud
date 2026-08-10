/**
 * FloatingNavBar.tsx — Premium floating navigation bar
 * Reverted to commit d685080
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth, UserButton } from '@clerk/react';
import { BookOpen, BarChart2, ShieldAlert, Eye, Plus, LogOut } from 'lucide-react';

export interface FloatingNavBarProps {
  isAdmin: boolean;
  activeSection: 'transactions' | 'reports' | 'admin';
  onSectionChange: (s: 'transactions' | 'reports' | 'admin') => void;
  transactionSubView: 'view' | 'add';
  onSubViewChange: (v: 'view' | 'add') => void;
  navStyle?: 'pill' | 'classic';
  orgId?: string;
  trialMode?: boolean;
  onTrialSignOut?: () => void;
}

// ── Page trail tracking ──────────────────────────────────────────────────────
const TRAIL_KEY           = '__kc_trail';
const TRAIL_LOGIN_TIME_KEY = '__kc_login_ts';  // ISO timestamp of session start

const PAGE_LABELS: Record<string, string> = {
  'transactions:view': 'All Transactions',
  'transactions:add':  'New Transaction',
  'reports':           'Reports',
  'admin:members':     'Admin › Members',
  'admin:requests':    'Admin › Requests',
  'admin:audit':       'Admin › Audit Log',
  'admin:settings':    'Admin › Settings',
  'admin':             'Admin',
};

function appendTrail(label: string) {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    // Avoid duplicating the same page twice in a row
    if (arr[arr.length - 1] !== label) arr.push(label);
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(arr));
  } catch { /* non-fatal */ }
}

function getTrail(): string {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return arr.join(' - ');
  } catch {
    return '';
  }
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


export default function FloatingNavBar({
  isAdmin,
  activeSection,
  onSectionChange,
  transactionSubView,
  onSubViewChange,
  navStyle = 'pill',
  orgId,
  trialMode = false,
  onTrialSignOut,
}: FloatingNavBarProps) {
  const { getToken, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const subMenuDesktopRef = useRef<HTMLDivElement>(null);
  const subMenuMobileRef  = useRef<HTMLDivElement>(null);
  const txnBtnDesktopRef  = useRef<HTMLButtonElement>(null);
  const txnBtnMobileRef   = useRef<HTMLButtonElement>(null);
  // Cache the Clerk JWT so sendBeacon (which can't set headers) can embed it in the body
  const cachedTokenRef = useRef<string | null>(null);

  // Seed the trail + record login timestamp on mount
  useEffect(() => {
    const initial = activeSection === 'transactions'
      ? PAGE_LABELS[`transactions:${transactionSubView}`]
      : PAGE_LABELS[activeSection] ?? activeSection;
    appendTrail(initial);
    // Store session start time (only if not already set from a previous quick reload)
    if (!sessionStorage.getItem(TRAIL_LOGIN_TIME_KEY)) {
      sessionStorage.setItem(TRAIL_LOGIN_TIME_KEY, new Date().toISOString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep cached token fresh every 50 s (Clerk default JWT lifetime is 60 s)
  useEffect(() => {
    if (trialMode) return;
    const refresh = async () => {
      try { cachedTokenRef.current = await getToken(); } catch { /* non-fatal */ }
    };
    refresh();
    const timer = setInterval(refresh, 50_000);
    return () => clearInterval(timer);
  }, [getToken, trialMode]);

  // ── pagehide: catch Clerk UserButton sign-out and browser close ────────────
  // Clerk's UserButton redirects the page, which triggers pagehide.
  // navigator.sendBeacon is guaranteed to fire even during page unload.
  useEffect(() => {
    if (trialMode) return;
    const onPageHide = () => {
      const token = cachedTokenRef.current;
      const trail = getTrail();
      const loginTs = sessionStorage.getItem(TRAIL_LOGIN_TIME_KEY);
      if (!token) return;
      const payload = JSON.stringify({ pageTrail: trail, token, loginTs });
      navigator.sendBeacon(
        '/api/org-admin?action=logout',
        new Blob([payload], { type: 'application/json' })
      );
      try {
        sessionStorage.removeItem(TRAIL_KEY);
        sessionStorage.removeItem(TRAIL_LOGIN_TIME_KEY);
      } catch { /* non-fatal */ }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [trialMode]);

  // ── Explicit logout button (trial mode or mobile sign-out button) ──────────
  const handleSignOut = async () => {
    if (trialMode) {
      sessionStorage.removeItem(TRAIL_KEY);
      sessionStorage.removeItem(TRAIL_LOGIN_TIME_KEY);
      if (onTrialSignOut) onTrialSignOut();
      else window.location.href = '/auth';
      return;
    }
    // For non-trial: pagehide will fire after signOut() redirects, so
    // the sendBeacon handler above covers it. We just trigger the redirect.
    try {
      sessionStorage.removeItem(TRAIL_KEY);
      sessionStorage.removeItem(TRAIL_LOGIN_TIME_KEY);
    } catch { /* non-fatal */ }
    await signOut({ redirectUrl: '/auth' });
  };

  // (kept for backward compat)
  const handleTrialSignOut = onTrialSignOut ?? (() => {
    sessionStorage.removeItem(TRAIL_KEY);
    sessionStorage.removeItem(TRAIL_LOGIN_TIME_KEY);
    window.location.href = '/auth';
  });
  void handleTrialSignOut;

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

  // Close sub-menu on outside click
  useEffect(() => {
    if (!showSubMenu) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inDesktopMenu = subMenuDesktopRef.current?.contains(t);
      const inMobileMenu = subMenuMobileRef.current?.contains(t);
      const inDesktopBtn = txnBtnDesktopRef.current?.contains(t);
      const inMobileBtn = txnBtnMobileRef.current?.contains(t);

      if (!inDesktopMenu && !inMobileMenu && !inDesktopBtn && !inMobileBtn) {
        setShowSubMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSubMenu]);

  const handleTransactionsClick = () => {
    if (navStyle === 'pill') {
      if (activeSection !== 'transactions') {
        onSectionChange('transactions');
        onSubViewChange('view');
        appendTrail(PAGE_LABELS['transactions:view']);
        setShowSubMenu(true);
      } else {
        setShowSubMenu(v => !v);
      }
    } else {
      onSectionChange('transactions');
      onSubViewChange('view');
      appendTrail(PAGE_LABELS['transactions:view']);
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
                      appendTrail(PAGE_LABELS[key] ?? label);
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

        {/* Avatar / Sign Out button */}
        {!trialMode ? (
          <div className="flex items-center px-3">
            <UserButton appearance={clerkUserButtonAppearance} />
          </div>
        ) : (
          <div className="flex items-center px-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 hover:text-white text-xs font-semibold transition-all shadow-sm whitespace-nowrap active:scale-95"
              title="Sign Out to /auth"
            >
              <LogOut size={14} />
              <span className="whitespace-nowrap">Sign Out</span>
            </button>
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

          {/* Profile / Sign Out slot */}
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
            <button
              type="button"
              onClick={handleTrialSignOut}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors whitespace-nowrap active:scale-95"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span className="text-xs font-semibold whitespace-nowrap">Sign Out</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

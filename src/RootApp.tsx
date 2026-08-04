/**
 * RootApp.tsx — KhataCloud SPA router
 *
 * Route table:
 *   /                   → blank (reserved for marketing)
 *   /auth               → LoginScreen or redirect to role destination
 *   /admin              → SuperAdmin dashboard
 *   /app  (+ /app/*)    → Org member / Org admin app
 *   /sso-callback       → Clerk OAuth return handler
 *   /trial              → Demo mode (no Clerk)
 *   anything else       → redirect to /auth
 *
 * Role state machine:
 *   super_admin  → /admin → SuperAdminApp
 *   org_admin    → /app  → OrgApp (with Admin tab in FloatingNavBar)
 *   org_member   → /app  → OrgApp (no Admin tab)
 *   pending      → PendingApprovalScreen (with org info + cancel option)
 *   no_org       → OrgSelectionScreen (pick org to request joining)
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser, AuthenticateWithRedirectCallback } from '@clerk/react';
import { AlertTriangle } from 'lucide-react';
import AccountingSystem from './App';
import SuperAdminApp from './SuperAdminApp';
import LoginScreen from './LoginScreen';
import FloatingNavBar from './components/FloatingNavBar';
import OrgSelectionScreen from './components/OrgSelectionScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import OrgAdminApp from './components/OrgAdmin/OrgAdminApp';
import { PageSpinner } from './ui';

export type RoleState =
  | 'checking'
  | 'super_admin'
  | 'org_admin'
  | 'org_member'
  | 'pending'
  | 'no_org'
  | 'unauthorized';

export interface WhoamiData {
  userType: string;
  orgSlug?: string;
  orgRole?: string;    // 'org:admin' | 'org:member'
  orgId?: string;
  userId?: string;
  orgName?: string;    // set when pending
  requestedAt?: string;  // set when pending
}

type RouteType = 'home' | 'auth' | 'admin' | 'sso-callback' | 'trial' | 'app' | 'unknown';

function classifyRoute(): RouteType {
  const p = window.location.pathname;
  if (p === '/') return 'home';
  if (p === '/auth' || p.startsWith('/auth/')) return 'auth';
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/sso-callback') return 'sso-callback';
  if (p === '/trial') return 'trial';
  if (p === '/app' || p.startsWith('/app/')) return 'app';
  return 'unknown';
}

export default function RootApp() {
  const route = classifyRoute();

  if (route === 'home') return null;
  if (route === 'sso-callback') return <AuthenticateWithRedirectCallback />;
  if (route === 'trial') return <TrialShell />;
  if (route === 'unknown') {
    window.location.replace('/auth');
    return <PageSpinner label="Redirecting…" />;
  }

  return <AuthenticatedShell route={route as 'auth' | 'admin' | 'app'} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TrialShell — wraps demo AccountingSystem with the same premium nav shell
// ─────────────────────────────────────────────────────────────────────────────
function TrialShell() {
  type Section = 'transactions' | 'reports' | 'admin';
  const [activeSection, setActiveSection] = useState<Section>('transactions');
  const [transactionSubView, setTransactionSubView] = useState<'view' | 'add'>('view');
  const [appReady, setAppReady] = useState(false);
  const navStyle = (localStorage.getItem('kc_nav_style') ?? 'pill') as 'pill' | 'classic';

  const handleSectionChange = (s: Section) => {
    setActiveSection(s);
    if (s !== 'transactions') setTransactionSubView('view');
  };

  const handleSubViewChange = (v: 'view' | 'add') => {
    setTransactionSubView(v);
  };

  const handleAppReady = useCallback(() => setAppReady(true), []);

  const appTab =
    activeSection === 'reports' ? 'report'
      : navStyle === 'pill' ? transactionSubView
        : 'view'; // classic: internal tabs handle view/add

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {!appReady && <PageSpinner label="Preparing demo account…" />}
      <div style={{ display: appReady ? 'block' : 'none' }}>
        <FloatingNavBar
          isAdmin={true}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          transactionSubView={transactionSubView}
          onSubViewChange={handleSubViewChange}
          navStyle={navStyle}
          trialMode
        />
        <div style={{ paddingTop: '4rem' }}>
          {/* ── Transactions + Reports panel ── */}
          <div
            style={{ display: activeSection !== 'admin' ? 'block' : 'none' }}
            className={activeSection !== 'admin' ? 'section-enter' : ''}
          >
            <AccountingSystem
              saasMode
              initialTab={appTab}
              navStyle={navStyle}
              onReady={handleAppReady}
            />
          </div>

          {/* ── Admin panel (demo view) ── */}
          <div
            style={{ display: activeSection === 'admin' ? 'block' : 'none' }}
            className={activeSection === 'admin' ? 'section-enter' : ''}
          >
            <OrgAdminApp orgSlug="demo" trialMode />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function AuthenticatedShell({ route }: { route: 'auth' | 'admin' | 'app' }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [roleState, setRoleState] = useState<RoleState>('checking');
  const [whoami, setWhoami] = useState<WhoamiData | null>(null);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setClerkTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  const checkRole = useCallback(async () => {
    setRoleState('checking');
    try {
      const token = await getToken();
      const res = await fetch('/api/admin?action=whoami', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setRoleState('unauthorized'); return; }

      const data: WhoamiData = await res.json();
      setWhoami(data);

      const { userType, orgRole } = data;
      if (userType === 'super_admin') {
        setRoleState('super_admin');
      } else if (userType === 'org_member') {
        setRoleState(orgRole === 'org:admin' ? 'org_admin' : 'org_member');
      } else if (userType === 'pending') {
        setRoleState('pending');
      } else {
        setRoleState('no_org');
      }
    } catch {
      setRoleState('unauthorized');
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) checkRole();
    if (isLoaded && !isSignedIn) setRoleState('checking');
  }, [isLoaded, isSignedIn, checkRole]);

  // Clerk timeout screen
  if (!isLoaded && clerkTimedOut) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-900/30 border border-amber-800/50 mb-5">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Auth Unavailable</h1>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            Authentication could not load. Ensure{' '}
            <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">
              VITE_CLERK_PUBLISHABLE_KEY
            </code>{' '}
            is set and the deployment is current.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium"
          >
            ↺ Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) return <PageSpinner />;

  // ── /auth ──────────────────────────────────────────────────────────────────
  if (route === 'auth') {
    if (!isSignedIn) return <LoginScreen />;
    if (roleState === 'checking') return <PageSpinner label="Signing you in…" />;
    if (roleState === 'super_admin') {
      window.history.replaceState({}, '', '/admin');
      return <SuperAdminApp />;
    }
    if (roleState === 'org_admin' || roleState === 'org_member') {
      window.history.replaceState({}, '', '/app');
      return (
        <OrgAppShell
          getToken={getToken}
          isAdmin={roleState === 'org_admin'}
          orgSlug={whoami?.orgSlug}
          orgId={whoami?.orgId}
        />
      );
    }
    if (roleState === 'pending') {
      return (
        <PendingApprovalScreen
          orgName={whoami?.orgName}
          requestedAt={whoami?.requestedAt}
          getToken={getToken}
          onCancelled={checkRole}
          onSignOut={signOut}
        />
      );
    }
    // no_org or unauthorized → org selection
    return (
      <OrgSelectionScreen
        email={user?.primaryEmailAddress?.emailAddress}
        getToken={getToken}
        onSubmitted={checkRole}
        onSignOut={signOut}
      />
    );
  }

  // ── /admin ─────────────────────────────────────────────────────────────────
  if (route === 'admin') {
    if (!isSignedIn) {
      window.history.replaceState({}, '', '/auth');
      return <LoginScreen />;
    }
    if (roleState === 'checking') return <PageSpinner label="Verifying access…" />;
    if (roleState === 'super_admin') return <SuperAdminApp />;
    // Non-SA tried to access /admin → redirect to their correct destination
    if (roleState === 'org_admin' || roleState === 'org_member') {
      window.history.replaceState({}, '', '/app');
      return (
        <OrgAppShell
          getToken={getToken}
          isAdmin={roleState === 'org_admin'}
          orgSlug={whoami?.orgSlug}
          orgId={whoami?.orgId}
        />
      );
    }
    if (roleState === 'pending') {
      return (
        <PendingApprovalScreen
          orgName={whoami?.orgName}
          requestedAt={whoami?.requestedAt}
          getToken={getToken}
          onCancelled={checkRole}
          onSignOut={signOut}
        />
      );
    }
    return (
      <OrgSelectionScreen
        email={user?.primaryEmailAddress?.emailAddress}
        getToken={getToken}
        onSubmitted={checkRole}
        onSignOut={signOut}
      />
    );
  }

  // ── /app ───────────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    window.history.replaceState({}, '', '/auth');
    return <LoginScreen />;
  }
  if (roleState === 'checking') return <PageSpinner label="Loading your account…" />;

  if (roleState === 'pending') {
    return (
      <PendingApprovalScreen
        orgName={whoami?.orgName}
        requestedAt={whoami?.requestedAt}
        getToken={getToken}
        onCancelled={checkRole}
        onSignOut={signOut}
      />
    );
  }

  if (roleState === 'no_org' || roleState === 'unauthorized') {
    return (
      <OrgSelectionScreen
        email={user?.primaryEmailAddress?.emailAddress}
        getToken={getToken}
        onSubmitted={checkRole}
        onSignOut={signOut}
      />
    );
  }

  if (roleState === 'org_admin' || roleState === 'org_member') {
    return (
      <OrgAppShell
        getToken={getToken}
        isAdmin={roleState === 'org_admin'}
        orgSlug={whoami?.orgSlug}
        orgId={whoami?.orgId}
      />
    );
  }

  // super_admin navigated to /app → let them in (viewing their own org)
  if (roleState === 'super_admin') {
    return (
      <OrgAppShell
        getToken={getToken}
        isAdmin={false}
        orgSlug={whoami?.orgSlug}
        orgId={whoami?.orgId}
      />
    );
  }

  return <PageSpinner label="Loading…" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// OrgAppShell — wrapper for org users; bridges Clerk JWT → AccountingSystem
// and renders the FloatingNavBar
// ─────────────────────────────────────────────────────────────────────────────
function OrgAppShell({
  getToken,
  isAdmin,
  orgSlug,
  orgId,
}: {
  getToken: () => Promise<string | null>;
  isAdmin: boolean;
  orgSlug?: string;
  orgId?: string;
}) {
  // Get Clerk signOut directly — no need to thread it from AuthenticatedShell
  const { signOut } = useAuth();

  type Section = 'transactions' | 'reports' | 'admin';
  const [activeSection, setActiveSection] = useState<Section>('transactions');
  const [transactionSubView, setTransactionSubView] = useState<'view' | 'add'>('view');
  const [bridged, setBridged] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const navStyle = (localStorage.getItem('kc_nav_style') ?? 'pill') as 'pill' | 'classic';

  const handleSignOut = async () => {
    sessionStorage.removeItem('madrasah_auth_token');
    sessionStorage.removeItem('madrasah_user_type');
    await signOut();
  };

  const handleSectionChange = (s: Section) => {
    setActiveSection(s);
    if (s !== 'transactions') setTransactionSubView('view');
  };

  const handleSubViewChange = (v: 'view' | 'add') => {
    setTransactionSubView(v);
  };

  const handleAppReady = useCallback(() => setAppReady(true), []);

  // Write Clerk JWT to sessionStorage for AccountingSystem's apiFetch
  // Also expose a global so apiFetch can call getToken() directly on every
  // request, preventing stale-token 401s (Clerk JWTs expire in ~60 seconds).
  useEffect(() => {
    let cancelled = false;
    const writeToken = async () => {
      try {
        const token = await getToken();
        if (token && !cancelled) {
          sessionStorage.setItem('madrasah_auth_token', token);
          sessionStorage.setItem('madrasah_user_type', 'org_member');
        }
      } finally {
        if (!cancelled) setBridged(true);
      }
    };
    writeToken();
    // Expose a global so App.tsx's apiFetch always gets a fresh token
    (window as any).__getClerkToken = () => getToken();
    // Fallback interval: refresh in sessionStorage every 45s in case the
    // global is not called (Clerk tokens expire after ~60 seconds)
    const interval = setInterval(async () => {
      const fresh = await getToken().catch(() => null);
      if (fresh) sessionStorage.setItem('madrasah_auth_token', fresh);
    }, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      delete (window as any).__getClerkToken;
    };
  }, [getToken]);

  if (!bridged) return <PageSpinner label="Loading your account…" />;

  // Determine which App.tsx internal tab to show based on activeSection + sub-view
  // NOTE: App.tsx uses 'report' (not 'reports') as the tab key
  const appTab =
    activeSection === 'reports' ? 'report'
      : navStyle === 'pill' ? transactionSubView
        : 'view'; // classic mode: internal pill toggle manages view/add

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {!appReady && <PageSpinner label="Loading your data…" />}
      <div style={{ display: appReady ? 'block' : 'none' }}>
        <FloatingNavBar
          isAdmin={isAdmin}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          transactionSubView={transactionSubView}
          onSubViewChange={handleSubViewChange}
          navStyle={navStyle}
          orgId={orgId}
        />
        {/* pt-0 on mobile (bottom nav), pt-20 on desktop (top pill nav) */}
        <div className="pt-0 md:pt-20 pb-24 md:pb-6">
          {/*
            All three panels are ALWAYS mounted — switching sections just
            toggles display:none.  No re-fetching / re-initialising.
            .section-enter plays the fade-slide animation on reveal.
          */}

          {/* ── Transactions + Reports panel ── */}
          <div
            style={{ display: activeSection !== 'admin' ? 'block' : 'none' }}
            className={activeSection !== 'admin' ? 'section-enter' : ''}
          >
            <AccountingSystem
              saasMode
              onSignOut={handleSignOut}
              initialTab={appTab}
              navStyle={navStyle}
              onReady={handleAppReady}
            />
          </div>

          {/* ── Admin panel (org admins only) ── */}
          {isAdmin && (
            <div
              style={{ display: activeSection === 'admin' ? 'block' : 'none' }}
              className={activeSection === 'admin' ? 'section-enter' : ''}
            >
              <OrgAdminApp orgSlug={orgSlug!} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

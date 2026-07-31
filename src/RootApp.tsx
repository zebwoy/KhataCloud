/**
 * RootApp.tsx — KhataCloud SPA router
 *
 * Route table:
 *   /                   → blank (reserved for future marketing page)
 *   /auth               → Login: show LoginScreen if unauthenticated,
 *                         redirect to /admin if already signed-in SA,
 *                         redirect to /app   if already signed-in org member
 *   /admin  (+ /admin/*) → SA dashboard: requires Clerk auth + super_admin role
 *   /sso-callback       → Clerk OAuth return handler → completes session → /admin
 *   /trial              → AccountingSystem in demo mode (auto-authenticates, no Clerk)
 *   /app    (+ /app/*)  → AccountingSystem for org members (requires Clerk)
 *   anything else       → redirect to /auth
 *
 * Auth state machine (AuthenticatedShell):
 *   Clerk loading       → PageSpinner
 *   Clerk timed out     → error screen
 *   Not signed in       → LoginScreen (on /auth) | redirect /auth (on /admin)
 *   Signed in, checking → PageSpinner ("Verifying access…")
 *   super_admin         → SuperAdminApp (on /admin) | redirect /admin (on /auth)
 *   org_member          → redirect /app (on /auth) | OrgAppBridge (on /app)
 *   no role             → PendingApproval screen
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser, AuthenticateWithRedirectCallback } from '@clerk/react';
import { Zap, Mail, Clock, ArrowRight } from 'lucide-react';
import AccountingSystem from './App';
import SuperAdminApp from './SuperAdminApp';
import LoginScreen from './LoginScreen';
import { PageSpinner, Button } from './ui';

type RoleState = 'checking' | 'super_admin' | 'org_member' | 'pending' | 'unauthorized';

// ── Route classification ───────────────────────────────────────────────────
type RouteType = 'home' | 'auth' | 'admin' | 'sso-callback' | 'trial' | 'app' | 'unknown';

function classifyRoute(): RouteType {
  const p = window.location.pathname;
  if (p === '/')                             return 'home';
  if (p === '/auth' || p.startsWith('/auth/'))  return 'auth';
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/sso-callback')                 return 'sso-callback';
  if (p === '/trial')                        return 'trial';
  if (p === '/app'  || p.startsWith('/app/'))   return 'app';
  return 'unknown';
}

export default function RootApp() {
  const route = classifyRoute();

  // ── / → blank (marketing page coming soon, do not redirect) ───────────────
  if (route === 'home') return null;

  // ── /sso-callback → OAuth return handler ──────────────────────────────────
  if (route === 'sso-callback') return <AuthenticateWithRedirectCallback />;

  // ── /trial → AccountingSystem in demo mode (no Clerk required) ─────────────
  // useAuth.ts auto-fires trial login when pathname === '/trial'
  if (route === 'trial') return <AccountingSystem />;

  // ── unknown → soft redirect to /auth ──────────────────────────────────────
  if (route === 'unknown') {
    window.location.replace('/auth');
    return <PageSpinner label="Redirecting…" />;
  }

  // ── /auth, /admin, /app → require Clerk ───────────────────────────────────
  return <AuthenticatedShell route={route as 'auth' | 'admin' | 'app'} />;
}

// ── AuthenticatedShell — Clerk auth layer for /auth, /admin, /app ──────────
function AuthenticatedShell({ route }: { route: 'auth' | 'admin' | 'app' }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [roleState, setRoleState] = useState<RoleState>('checking');
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  // Safety net: if Clerk never loads (CDN block, missing key, etc.)
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setClerkTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  /**
   * Role verification — calls /api/admin?action=whoami to get the user's
   * role from the database (super_admin, org_member, or none).
   */
  const checkRole = useCallback(async () => {
    setRoleState('checking');
    try {
      const token = await getToken();
      const res = await fetch('/api/admin?action=whoami', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const type: string = data.userType;
        if (type === 'super_admin') setRoleState('super_admin');
        else if (type === 'org_member') setRoleState('org_member');
        else setRoleState('pending');
      } else {
        setRoleState('unauthorized');
      }
    } catch {
      setRoleState('unauthorized');
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn)  checkRole();
    if (isLoaded && !isSignedIn) setRoleState('checking');
  }, [isLoaded, isSignedIn, checkRole]);

  // ── Clerk load timeout ─────────────────────────────────────────────────────
  if (!isLoaded && clerkTimedOut) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-900/30 border border-amber-800/50 mb-5">
            <Zap size={24} className="text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Auth Unavailable</h1>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            Authentication could not load. Ensure{' '}
            <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">
              VITE_CLERK_PUBLISHABLE_KEY
            </code>
            {' '}is set and the deployment is current.
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Route: /auth
  // ═══════════════════════════════════════════════════════════════════════════
  if (route === 'auth') {
    if (!isSignedIn) return <LoginScreen />;
    if (roleState === 'checking') return <PageSpinner label="Signing you in…" />;

    if (roleState === 'super_admin') {
      window.location.replace('/admin');
      return <PageSpinner label="Redirecting to dashboard…" />;
    }
    if (roleState === 'org_member') {
      window.location.replace('/app');
      return <PageSpinner label="Loading your account…" />;
    }
    // Signed in but not in any approved org → pending approval
    if (roleState === 'pending') {
      return <PendingApproval email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
    }
    // Not in any org at all → show access denied with option to register
    return <NoOrgScreen email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Route: /admin
  // ═══════════════════════════════════════════════════════════════════════════
  if (route === 'admin') {
    if (!isSignedIn) {
      window.location.replace('/auth');
      return <PageSpinner label="Redirecting to login…" />;
    }
    if (roleState === 'checking') return <PageSpinner label="Verifying access…" />;
    if (roleState === 'super_admin') return <SuperAdminApp />;
    if (roleState === 'org_member') {
      window.location.replace('/app');
      return <PageSpinner label="Loading your account…" />;
    }
    if (roleState === 'pending') {
      return <PendingApproval email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
    }
    return <NoOrgScreen email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Route: /app — AccountingSystem for Clerk-authenticated org members
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isSignedIn) {
    window.location.replace('/auth');
    return <PageSpinner label="Redirecting to login…" />;
  }
  if (roleState === 'checking') return <PageSpinner label="Loading your account…" />;

  if (roleState === 'org_member') return <OrgAppBridge getToken={getToken} />;

  if (roleState === 'super_admin') {
    // SA navigated to /app — let them in (SA can see the accounting view too)
    return <OrgAppBridge getToken={getToken} />;
  }

  if (roleState === 'pending') {
    return <PendingApproval email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
  }
  return <NoOrgScreen email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
}

// ── OrgAppBridge ─────────────────────────────────────────────────────────────
/**
 * Bridges Clerk authentication into AccountingSystem's sessionStorage-based
 * auth without modifying AccountingSystem's internal auth logic.
 *
 * Mechanism:
 *   1. Gets a Clerk JWT via getToken()
 *   2. Writes it to sessionStorage.madrasah_auth_token
 *   3. Writes 'org_member' to sessionStorage.madrasah_user_type
 *   4. Renders AccountingSystem (which reads sessionStorage on mount → isLoggedIn=true)
 *   5. Refreshes the token every 55 minutes (Clerk JWTs expire in 1 hour)
 *
 * This works because lib/authHelper.ts already supports Clerk JWT verification —
 * the backend verifies the Bearer token as Clerk, resolves the org slug, and
 * routes the request to the correct org schema.
 */
function OrgAppBridge({ getToken }: { getToken: () => Promise<string | null> }) {
  const [bridged, setBridged] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const writeToken = async () => {
      try {
        const token = await getToken();
        if (token && !cancelled) {
          sessionStorage.setItem('madrasah_auth_token', token);
          sessionStorage.setItem('madrasah_user_type', 'org_member');
        }
      } catch {
        // Clerk token fetch failed — AccountingSystem will redirect to /auth on its own
      } finally {
        if (!cancelled) setBridged(true);
      }
    };

    writeToken();

    // Refresh every 55 minutes so the token stays fresh (Clerk default TTL = 1hr)
    const interval = setInterval(async () => {
      const fresh = await getToken().catch(() => null);
      if (fresh) sessionStorage.setItem('madrasah_auth_token', fresh);
    }, 55 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [getToken]);

  if (!bridged) return <PageSpinner label="Loading your account…" />;
  return <AccountingSystem />;
}

// ── PendingApproval screen ────────────────────────────────────────────────────
function PendingApproval({
  email,
  onSignOut,
}: {
  email?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-900/30 border border-amber-800/50 mb-5">
          <Clock size={24} className="text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Pending Approval</h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          {email && <span className="text-slate-200 font-medium">{email}</span>}
          {email ? "'s" : 'Your'} organisation is awaiting admin approval.
          You'll get access once a super admin approves your org.
        </p>
        <p className="text-xs text-slate-600 mt-3">
          This usually takes less than 24 hours.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="outline"
            fullWidth
            onClick={() => window.location.href = 'mailto:support@khatacloud.com'}
            leftIcon={<Mail size={14} />}
          >
            Contact Support
          </Button>
          <Button variant="ghost" fullWidth onClick={onSignOut}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

// ── NoOrg screen (signed in but not in any org) ───────────────────────────────
function NoOrgScreen({
  email,
  onSignOut,
}: {
  email?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-5">
          <Zap size={24} className="text-violet-400" />
        </div>
        <h1 className="text-xl font-bold text-white">No Organisation Found</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {email && <span className="text-slate-300">{email}</span>}
          {email ? ' is' : 'Your account is'} not linked to any organisation.
          Either your org admin hasn't added you yet, or your org is pending approval.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => window.location.href = '/auth?register=1'}
            rightIcon={<ArrowRight size={14} />}
          >
            Register an Organisation
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => window.location.href = 'mailto:support@khatacloud.com'}
            leftIcon={<Mail size={14} />}
          >
            Contact Support
          </Button>
          <Button variant="ghost" fullWidth onClick={onSignOut}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

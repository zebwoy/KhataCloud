/**
 * RootApp.tsx — KhataCloud SPA router
 *
 * Route table:
 *   /                   → blank (reserved for future marketing page)
 *   /auth               → Login: show LoginScreen if unauthenticated,
 *                         redirect to /admin if already signed-in SA
 *   /admin  (+ /admin/*) → SA dashboard: requires Clerk auth + super_admin role,
 *                         redirects to /auth if not signed in
 *   /sso-callback       → Clerk OAuth return handler → completes session → /admin
 *   /app    (+ /app/*)  → AccountingSystem (org users, legacy SHA-256 auth)
 *   anything else       → redirect to /auth
 *
 * Auth state machine (AdminGate + AuthGate):
 *   Clerk loading       → PageSpinner
 *   Clerk timed out     → error screen
 *   Not signed in       → LoginScreen  (on /auth) | redirect /auth (on /admin)
 *   Signed in, checking → PageSpinner ("Verifying access…")
 *   super_admin         → SuperAdminApp (on /admin) | redirect /admin (on /auth)
 *   not super_admin     → Access Denied screen
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser, AuthenticateWithRedirectCallback } from '@clerk/react';
import { Zap, Mail } from 'lucide-react';
import AccountingSystem from './App';
import SuperAdminApp from './SuperAdminApp';
import LoginScreen from './LoginScreen';
import { PageSpinner, Button } from './ui';

type RoleState = 'checking' | 'super_admin' | 'unauthorized';

// ── Route classification ───────────────────────────────────────────────────
type RouteType = 'home' | 'auth' | 'admin' | 'sso-callback' | 'app' | 'unknown';

function classifyRoute(): RouteType {
  const p = window.location.pathname;
  if (p === '/')                          return 'home';
  if (p === '/auth' || p.startsWith('/auth/')) return 'auth';
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/sso-callback')              return 'sso-callback';
  if (p === '/app'  || p.startsWith('/app/'))   return 'app';
  return 'unknown';
}

export default function RootApp() {
  const route = classifyRoute();

  // ── / → blank (marketing page coming soon, do not redirect) ───────────────
  if (route === 'home') {
    // Return null — Vite renders <html><head>…<body></body> with no visible
    // content. The marketing team will replace this route entirely.
    return null;
  }

  // ── /sso-callback → OAuth return handler ──────────────────────────────────
  // Clerk redirects here after Google / SSO completes.
  // AuthenticateWithRedirectCallback reads the URL params, finalises the
  // session, and then follows the forceRedirectUrl set on ClerkProvider → /admin
  if (route === 'sso-callback') {
    return <AuthenticateWithRedirectCallback />;
  }

  // ── /app → legacy product (org users with own SHA-256 auth) ───────────────
  if (route === 'app') {
    return <AccountingSystem />;
  }

  // ── unknown → soft redirect to /auth ──────────────────────────────────────
  if (route === 'unknown') {
    window.location.replace('/auth');
    return <PageSpinner label="Redirecting…" />;
  }

  // ── /auth and /admin → require Clerk (rendered by AuthenticatedShell) ─────
  return <AuthenticatedShell route={route} />;
}

// ── AuthenticatedShell — shared Clerk auth layer for /auth and /admin ──────
function AuthenticatedShell({ route }: { route: 'auth' | 'admin' }) {
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

  // Role verification — called once Clerk confirms the user is signed in
  const checkRole = useCallback(async () => {
    setRoleState('checking');
    try {
      const token = await getToken();
      // Only super admins get 200 from this endpoint
      const res = await fetch('/api/admin?action=stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoleState(res.ok ? 'super_admin' : 'unauthorized');
    } catch {
      setRoleState('unauthorized');
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn)  checkRole();
    if (isLoaded && !isSignedIn) setRoleState('checking'); // reset on sign-out
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

  // ── Clerk still loading ────────────────────────────────────────────────────
  if (!isLoaded) return <PageSpinner />;

  // ═══════════════════════════════════════════════════════════════════════════
  // Route: /auth
  // ═══════════════════════════════════════════════════════════════════════════
  if (route === 'auth') {
    // Not signed in → show the login screen
    if (!isSignedIn) return <LoginScreen />;

    // Checking role after sign-in
    if (roleState === 'checking') return <PageSpinner label="Signing you in…" />;

    // Already signed in as SA → go to dashboard
    if (roleState === 'super_admin') {
      window.location.replace('/admin');
      return <PageSpinner label="Redirecting to dashboard…" />;
    }

    // Signed in but not SA → show access denied from /auth itself
    return <AccessDenied email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Route: /admin
  // ═══════════════════════════════════════════════════════════════════════════

  // Not signed in → send to login
  if (!isSignedIn) {
    window.location.replace('/auth');
    return <PageSpinner label="Redirecting to login…" />;
  }

  // Verifying role
  if (roleState === 'checking') return <PageSpinner label="Verifying access…" />;

  // Super admin → render the dashboard
  if (roleState === 'super_admin') return <SuperAdminApp />;

  // Signed in but not SA
  return <AccessDenied email={user?.primaryEmailAddress?.emailAddress} onSignOut={signOut} />;
}

// ── Access Denied screen (shared between /auth and /admin) ──────────────────
function AccessDenied({
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
        <h1 className="text-xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {email && <span className="text-slate-300">{email}</span>}
          {email ? ' is' : 'Your account is'} not provisioned as a super admin.
        </p>
        <p className="text-xs text-slate-600 mt-3 leading-relaxed">
          Organisation users should go to{' '}
          <a href="/app" className="text-violet-400 hover:underline">
            khatacloud.com/app
          </a>
          {' '}to access the accounting dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="outline"
            fullWidth
            onClick={() => { window.location.href = 'mailto:support@khatacloud.com'; }}
            leftIcon={<Mail size={14} />}
          >
            Contact Support
          </Button>
          <Button variant="ghost" fullWidth onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

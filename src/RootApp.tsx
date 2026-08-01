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
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useAuth, useUser, useClerk,
  useOrganization, useOrganizationList,
  AuthenticateWithRedirectCallback,
} from '@clerk/react';
import { Zap } from 'lucide-react';
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
  userType:    string;
  orgSlug?:    string;
  orgRole?:    string;    // 'org:admin' | 'org:member'
  orgId?:      string;
  userId?:     string;
  orgName?:    string;    // set when pending
  requestedAt?: string;  // set when pending
}

type RouteType = 'home' | 'auth' | 'admin' | 'sso-callback' | 'trial' | 'app' | 'unknown';

function classifyRoute(): RouteType {
  const p = window.location.pathname;
  if (p === '/')                              return 'home';
  if (p === '/auth' || p.startsWith('/auth/')) return 'auth';
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/sso-callback')                  return 'sso-callback';
  if (p === '/trial')                         return 'trial';
  if (p === '/app'  || p.startsWith('/app/'))  return 'app';
  return 'unknown';
}

export default function RootApp() {
  const route = classifyRoute();

  if (route === 'home')         return null;
  if (route === 'sso-callback') return <AuthenticateWithRedirectCallback />;
  if (route === 'trial')        return <AccountingSystem />;
  if (route === 'unknown') {
    window.location.replace('/auth');
    return <PageSpinner label="Redirecting…" />;
  }

  return <AuthenticatedShell route={route as 'auth' | 'admin' | 'app'} />;
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * AuthenticatedShell — org activation + role resolution
 *
 * Clerk only embeds org_id / org_role in the JWT when an organization is
 * ACTIVE in the user's session. On first sign-in (password, magic link,
 * SSO) the session starts with no active org even if the user is a member.
 *
 * Resolution order:
 *   1. Wait for Clerk (isLoaded), org list (orgsLoaded), and active-org
 *      hook (orgLoaded) to all be ready.
 *   2. If the user is signed in and has org memberships but no active org,
 *      call setActive() to activate their first org. Clerk re-renders the
 *      tree with the updated session; the effect fires again.
 *   3. Once an org is active (or the user has no orgs — SA / pending),
 *      call checkRole() which fetches /api/admin?action=whoami.
 *   4. The backend reads org_id / org_role straight from the JWT — no
 *      extra Clerk API call needed on the happy path.
 */
function AuthenticatedShell({ route }: { route: 'auth' | 'admin' | 'app' }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user }     = useUser();
  const { setActive } = useClerk();

  // Track the currently active org (null = none active)
  const { organization, isLoaded: orgLoaded } = useOrganization();

  // Full list of org memberships for this user
  const { userMemberships, isLoaded: orgsLoaded } = useOrganizationList({
    userMemberships: { pageSize: 10 },
  });

  const [roleState, setRoleState]         = useState<RoleState>('checking');
  const [whoami,    setWhoami]            = useState<WhoamiData | null>(null);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  // Clerk load timeout (8 s)
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setClerkTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  // ── Role check ─────────────────────────────────────────────────────────────
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

  // Track primitive org IDs to avoid infinite re-render loops from object identity changes
  const activeOrgId = organization?.id;
  const firstOrgId  = userMemberships?.data?.[0]?.organization?.id;
  const hasAttemptedActivationRef = useRef(false);

  // ── Main activation + role-check effect ────────────────────────────────────
  useEffect(() => {
    // Not signed in — nothing to do
    if (isLoaded && !isSignedIn) {
      setRoleState('checking');
      return;
    }

    // Wait for all three Clerk hooks to be ready
    if (!isLoaded || !orgLoaded || !orgsLoaded) return;
    if (!isSignedIn) return;

    // If user belongs to an org but none is active in session yet, activate first org
    if (!activeOrgId && firstOrgId && !hasAttemptedActivationRef.current) {
      hasAttemptedActivationRef.current = true;
      setActive({ organization: firstOrgId })
        .then(() => {
          checkRole();
        })
        .catch(() => {
          checkRole();
        });
      return;
    }

    // Org is active OR user has no orgs (SA / unassigned) OR activation was attempted
    checkRole();
  }, [isLoaded, isSignedIn, orgLoaded, orgsLoaded, activeOrgId, firstOrgId, setActive, checkRole]);

  // Clerk timeout screen
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
      window.location.replace('/admin');
      return <PageSpinner label="Redirecting to dashboard…" />;
    }
    if (roleState === 'org_admin' || roleState === 'org_member') {
      window.location.replace('/app');
      return <PageSpinner label="Loading your account…" />;
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
    if (!isSignedIn) { window.location.replace('/auth'); return null; }
    if (roleState === 'checking') return <PageSpinner label="Verifying access…" />;
    if (roleState === 'super_admin') return <SuperAdminApp />;
    // Non-SA tried to access /admin → redirect to their correct destination
    if (roleState === 'org_admin' || roleState === 'org_member') {
      window.location.replace('/app');
      return <PageSpinner label="Loading your account…" />;
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
  if (!isSignedIn) { window.location.replace('/auth'); return null; }
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
  getToken:  () => Promise<string | null>;
  isAdmin:   boolean;
  orgSlug?:  string;
  orgId?:    string;
}) {
  const [activeSection, setActiveSection] = useState<'app' | 'admin'>('app');
  const [bridged, setBridged]             = useState(false);

  // Write Clerk JWT to sessionStorage for AccountingSystem's apiFetch
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
    const interval = setInterval(async () => {
      const fresh = await getToken().catch(() => null);
      if (fresh) sessionStorage.setItem('madrasah_auth_token', fresh);
    }, 55 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [getToken]);

  if (!bridged) return <PageSpinner label="Loading your account…" />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <FloatingNavBar
        isAdmin={isAdmin}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        orgId={orgId}
      />
      {/* Top padding to clear floating navbar, bottom padding for mobile */}
      <div className="pt-20 pb-24 md:pb-6">
        {activeSection === 'admin' && isAdmin
          ? <OrgAdminApp orgSlug={orgSlug!} />
          : <AccountingSystem />
        }
      </div>
    </div>
  );
}

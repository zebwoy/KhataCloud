/**
 * RootApp.tsx — KhataCloud admin gate
 *
 * For /admin paths: Clerk auth → role check → SuperAdminApp or LoginScreen
 * For all other paths: AccountingSystem renders directly (own auth)
 *
 * AccountingSystem has its own login. Clerk is only required for /admin.
 * A full unified-login migration (org users → Clerk) is a separate future task.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { Zap, Mail } from 'lucide-react';
import AccountingSystem from './App';
import SuperAdminApp from './SuperAdminApp';
import LoginScreen from './LoginScreen';
import { PageSpinner, Button } from './ui';

type RoleState = 'checking' | 'super_admin' | 'unauthorized';

export default function RootApp() {
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user }   = useUser();
  const [roleState, setRoleState] = useState<RoleState>('checking');
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  // Bail out if Clerk never loads (missing key, network error, etc.)
  useEffect(() => {
    const t = setTimeout(() => setClerkTimedOut(true), 8000);
    if (isLoaded) clearTimeout(t);
    return () => clearTimeout(t);
  }, [isLoaded]);

  const checkRole = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/admin?action=stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoleState(res.ok ? 'super_admin' : 'unauthorized');
    } catch {
      setRoleState('unauthorized');
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn && isAdminPath) checkRole();
  }, [isLoaded, isSignedIn, isAdminPath, checkRole]);

  // ── Non-admin paths: just render the product app ─────────────────────────
  if (!isAdminPath) return <AccountingSystem />;

  // ── Admin path: Clerk timed out ───────────────────────────────────────────
  if (!isLoaded && clerkTimedOut) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-900/30 border border-amber-800/50 mb-5">
            <Zap size={24} className="text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Auth Unavailable</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Could not reach Clerk. Ensure{' '}
            <code className="text-slate-400 bg-slate-800 px-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code>
            {' '}is set and the deployment is fresh.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 text-sm text-violet-400 hover:text-violet-300 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Clerk loading ─────────────────────────────────────────────────────────
  if (!isLoaded) return <PageSpinner />;

  // ── Not signed in → unified login ─────────────────────────────────────────
  if (!isSignedIn) return <LoginScreen />;

  // ── Signed in, role check in progress ────────────────────────────────────
  if (roleState === 'checking') return <PageSpinner label="Verifying access…" />;

  // ── Super admin ───────────────────────────────────────────────────────────
  if (roleState === 'super_admin') return <SuperAdminApp />;

  // ── Not a super admin ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-5">
          <Zap size={24} className="text-violet-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          <span className="text-slate-300">{user?.primaryEmailAddress?.emailAddress}</span>
          {' '}is not a super admin.
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
          <Button variant="ghost" fullWidth onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * SuperAdminApp.tsx — Root component for the /superadmin SPA
 *
 * State machine:
 *   loading → check Better Auth session
 *     → no session          → SALogin
 *     → session, not SA     → "Access denied"
 *     → session, is SA      → SALayout + page content
 */
import { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, Lock } from 'lucide-react';
import { authClient } from './lib/authClient';
import SALogin from './components/SuperAdmin/SALogin';
import SALayout, { type SAPage } from './components/SuperAdmin/SALayout';
import SADashboard from './components/SuperAdmin/SADashboard';
import SAOrgs from './components/SuperAdmin/SAOrgs';
import SAUsers from './components/SuperAdmin/SAUsers';

type AppState = 'loading' | 'unauthenticated' | 'not_super_admin' | 'ready';

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

const saFetch = (path: string) =>
  fetch(`/.netlify/functions${path}`, { credentials: 'include' });

export default function SuperAdminApp() {
  const [state, setState] = useState<AppState>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [page, setPage] = useState<SAPage>('dashboard');

  const checkSession = useCallback(async () => {
    setState('loading');
    try {
      // 1. Check Better Auth session
      const { data: sessionData } = await authClient.getSession();

      if (!sessionData?.user?.id) {
        setState('unauthenticated');
        return;
      }

      // 2. Verify super_admin status by calling a super-admin-only endpoint
      const statsRes = await saFetch('/super-admin-stats');
      if (statsRes.status === 403) {
        setState('not_super_admin');
        setUser(sessionData.user as SessionUser);
        return;
      }
      if (!statsRes.ok) {
        // Network error or 5xx — treat as unauthenticated
        setState('unauthenticated');
        return;
      }

      setUser(sessionData.user as SessionUser);
      setState('ready');
    } catch {
      setState('unauthenticated');
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Shield size={22} className="text-indigo-400" />
          </div>
          <Loader2 size={20} className="animate-spin text-slate-600" />
        </div>
      </div>
    );
  }

  // ── Not logged in → Login page ───────────────────────────────────────────
  if (state === 'unauthenticated') {
    return <SALogin onLogin={checkSession} />;
  }

  // ── Logged in but not a super admin ─────────────────────────────────────
  if (state === 'not_super_admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-900/30 border border-red-800/50 mb-5">
            <Lock size={24} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Your account (<span className="text-slate-400">{user?.email}</span>) is not registered as a super admin.
          </p>
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Run{' '}
            <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              INSERT INTO platform.super_admins (user_id, email)
            </code>{' '}
            in Neon with your user ID to grant access.
          </p>
          <button
            onClick={() => authClient.signOut().then(checkSession)}
            className="mt-6 text-sm text-slate-500 hover:text-red-400 transition"
          >
            Sign out and try a different account
          </button>
        </div>
      </div>
    );
  }

  // ── Super admin dashboard ────────────────────────────────────────────────
  return (
    <SALayout
      page={page}
      setPage={setPage}
      userName={user?.name ?? 'Super Admin'}
      userEmail={user?.email ?? ''}
    >
      {page === 'dashboard' && <SADashboard />}
      {page === 'orgs'      && <SAOrgs />}
      {page === 'users'     && <SAUsers />}
    </SALayout>
  );
}

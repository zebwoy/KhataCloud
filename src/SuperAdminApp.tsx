/**
 * SuperAdminApp.tsx — Root component for the /superadmin SPA
 *
 * Auth state machine (Clerk-powered):
 *   isLoaded=false          → loading spinner
 *   isLoaded, !isSignedIn   → Clerk <SignIn /> embedded
 *   isSignedIn, checking    → loading spinner (verifying super_admin row)
 *   isSignedIn, not SA      → "Access denied" screen
 *   isSignedIn, is SA       → SALayout + page content
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser, SignIn } from '@clerk/react';
import { Shield, Loader2, Lock } from 'lucide-react';
import SALayout, { type SAPage } from './components/SuperAdmin/SALayout';
import SADashboard from './components/SuperAdmin/SADashboard';
import SAOrgs from './components/SuperAdmin/SAOrgs';
import SAUsers from './components/SuperAdmin/SAUsers';

type CheckState = 'pending' | 'not_super_admin' | 'ready';

export default function SuperAdminApp() {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [checkState, setCheckState] = useState<CheckState>('pending');
  const [page, setPage] = useState<SAPage>('dashboard');

  // Clerk-authenticated fetch for the super admin API
  const saFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = await getToken();
      return fetch(`/.netlify/functions${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
    },
    [getToken]
  );

  // After sign-in, verify the user is in platform.super_admins
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    setCheckState('pending');
    saFetch('/admin?action=stats').then(res => {
      if (res.ok) setCheckState('ready');
      else setCheckState('not_super_admin');
    }).catch(() => setCheckState('not_super_admin'));
  }, [isLoaded, isSignedIn, saFetch]);

  // ── Clerk not yet initialised ─────────────────────────────────────────────
  if (!isLoaded) {
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

  // ── Not signed in → Clerk embedded sign-in ───────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div
          className="pointer-events-none fixed inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/40 mb-4">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">KhataCloud</h1>
            <p className="text-sm text-slate-400 mt-1">Super Admin Control Panel</p>
          </div>
          <SignIn
            routing="hash"
            appearance={{
              variables: {
                colorPrimary: '#6366f1',
                colorBackground: '#0f172a',
                colorForeground: '#f1f5f9',
                colorMutedForeground: '#94a3b8',
                colorInput: '#1e293b',
                colorInputForeground: '#f1f5f9',
                colorDanger: '#f87171',
                colorBorder: '#334155',
                borderRadius: '0.75rem',
                fontFamily: 'Inter, system-ui, sans-serif',
              },
              elements: {
                card: 'shadow-2xl shadow-black/50',
                socialButtonsBlockButton: 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200',
                footerActionLink: 'text-indigo-400',
              },
            }}
          />
        </div>
      </div>
    );
  }

  // ── Verifying super admin status ─────────────────────────────────────────
  if (checkState === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  // ── Signed in but not a super admin ──────────────────────────────────────
  if (checkState === 'not_super_admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-900/30 border border-red-800/50 mb-5">
            <Lock size={24} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Your account (<span className="text-slate-400">{user?.primaryEmailAddress?.emailAddress}</span>) is not registered as a super admin.
          </p>
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Run{' '}
            <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              INSERT INTO platform.super_admins (user_id, email)
            </code>{' '}
            in Neon with your Clerk user ID to grant access.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-6 text-sm text-slate-500 hover:text-red-400 transition"
          >
            Sign out and try a different account
          </button>
        </div>
      </div>
    );
  }

  // ── Super admin dashboard ─────────────────────────────────────────────────
  return (
    <SALayout
      page={page}
      setPage={setPage}
      userName={user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'Super Admin'}
      userEmail={user?.primaryEmailAddress?.emailAddress ?? ''}
    >
      {page === 'dashboard' && <SADashboard />}
      {page === 'orgs'      && <SAOrgs />}
      {page === 'users'     && <SAUsers />}
    </SALayout>
  );
}

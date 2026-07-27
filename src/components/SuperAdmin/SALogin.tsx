/**
 * SALogin.tsx — Super Admin login page
 * Completely separate from the main app login.
 * Uses Better Auth email+password and Google SSO.
 */
import { useState } from 'react';
import { Eye, EyeOff, Shield, Loader2, Chrome } from 'lucide-react';
import { authClient } from '../../lib/authClient';

interface SALoginProps {
  onLogin: () => void;
}

export default function SALogin({ onLogin }: SALoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if ((result as any)?.error) {
        throw new Error((result as any).error.message || 'Sign in failed');
      }
      onLogin();
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/superadmin`,
      });
      // Redirect happens automatically
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Subtle background radial */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/40 mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Super Admin</h1>
          <p className="text-sm text-slate-400 mt-1">HisaabKitaab Control Panel</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <form onSubmit={handleEmailSignIn} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Sign in */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm shadow-lg shadow-indigo-900/30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium py-3 rounded-xl transition-all duration-200 text-sm"
          >
            {googleLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <Chrome size={16} className="text-slate-400" />}
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Bootstrap hint */}
          <p className="text-xs text-slate-600 text-center mt-6 leading-relaxed">
            First time? Sign in above, then run{' '}
            <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded">
              INSERT INTO platform.super_admins
            </code>{' '}
            in Neon with your user ID.
          </p>
        </div>
      </div>
    </div>
  );
}

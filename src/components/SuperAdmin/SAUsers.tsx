/**
 * SAUsers.tsx — User management + provisioning panel
 * Lists all org members. Lets super admin create accounts for existing users.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, RefreshCw, Eye, EyeOff,
  CheckCircle, AlertCircle, Search, X, Copy, Link2,
} from 'lucide-react';
import { useSaFetch } from '../../lib/useSaFetch';
import { Select } from '../../ui';


interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

const ROLE_BADGE: Record<string, string> = {
  owner:  'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  admin:  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  member: 'bg-slate-700/50 text-slate-400 border-slate-600/25',
};

/**
 * IMPORTANT: This component MUST be defined outside SAUsers.
 * If defined inside, every keystroke triggers a re-render which redefines
 * `Input` as a new function type — React unmounts + remounts the <input>,
 * causing immediate focus loss after the first character typed.
 */
function ProvisionInput({
  label, type = 'text', value, onChange, placeholder, required = true, children,
}: {
  label: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; required?: boolean; children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
      />
      {children}
    </div>
  );
}

export default function SAUsers() {
  const saFetch = useSaFetch();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState('');

  // Provision form state
  const [form, setForm] = useState({ name: '', email: '', password: '', orgSlug: '', role: 'member' });
  const [showPw, setShowPw] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [signInUrl, setSignInUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orgsRes = await saFetch('/admin?action=orgs');
      if (!orgsRes.ok) throw new Error('Failed to load orgs');
      const orgsData: any[] = await orgsRes.json();
      const approvedOrgs = orgsData.filter((o: any) => o.status === 'approved');
      setOrgs(approvedOrgs.map((o: any) => ({ id: o.id, name: o.name, slug: o.slug })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = (keepOrg = false) => {
    setForm({ name: '', email: '', password: '', orgSlug: keepOrg ? form.orgSlug : '', role: 'member' });
    setFormError('');
    setSignInUrl(null);
    setCopied(false);
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setSignInUrl(null);

    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
        orgSlug: form.orgSlug,
        role: form.role,
      };
      // Only send password if the SA explicitly set one
      if (form.password) payload.password = form.password;

      const res = await saFetch('/admin?action=provision', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provisioning failed');

      setSignInUrl(data.signInUrl ?? null);
      setForm(f => ({ ...f, name: '', email: '', password: '' }));
      await fetchData();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  };

  const copyLink = () => {
    if (!signInUrl) return;
    navigator.clipboard.writeText(signInUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Provision accounts for org members</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 text-sm text-slate-400 hover:text-white transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { resetForm(); setPanelOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-900/30 transition"
          >
            <UserPlus size={16} /> Provision User
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Approved orgs overview */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orgs…"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <p className="text-sm font-semibold text-white">Approved Organisations</p>
          <p className="text-xs text-slate-500 mt-0.5">Select an org in the Provision form to add members</p>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-800/30 animate-pulse" />)}
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-center text-slate-600 py-12">No approved organisations yet.</p>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {orgs
              .filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase()))
              .map(org => (
                <div key={org.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{org.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                  </div>
                  <button
                    onClick={() => {
                      resetForm();
                      setForm(f => ({ ...f, orgSlug: org.slug }));
                      setPanelOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-lg transition"
                  >
                    <UserPlus size={12} /> Add member
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Provision User slide-over panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
            {/* Panel header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <p className="text-base font-bold text-white">Provision User</p>
                <p className="text-xs text-slate-500 mt-0.5">Create a Clerk account and link to an org</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleProvision} className="flex-1 overflow-y-auto min-h-0 scroll-hidden px-6 py-6 space-y-5">
              <ProvisionInput label="Full name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmad Raza" />
              <ProvisionInput label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" />

              {/* Password field — optional */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Password <span className="normal-case font-normal text-slate-600">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank — user gets a sign-in link"
                    minLength={8}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  If left blank, a one-time sign-in link is generated. No breach-check issues.
                </p>
              </div>

              {/* Org dropdown */}
              <Select
                label="Organisation"
                value={form.orgSlug}
                onChange={v => setForm(f => ({ ...f, orgSlug: v }))}
                placeholder="Select organisation…"
                options={orgs.map(o => ({ value: o.slug, label: `${o.name} (${o.slug})` }))}
              />

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Role</label>
                <div className="flex gap-2">
                  {(['member', 'admin', 'owner'] as const).map(r => (
                    <button key={r} type="button"
                      onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition ${
                        form.role === r
                          ? ROLE_BADGE[r] + ' ring-1 ring-current'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sign-in link — shown after success */}
              {signInUrl && (
                <div className="rounded-xl border border-emerald-800/60 bg-emerald-900/15 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                    <CheckCircle size={15} /> Account created!
                  </div>
                  <p className="text-xs text-slate-400">
                    Share this one-time sign-in link with the user. It expires in 7 days.
                    They'll be signed in automatically and can set their own password.
                  </p>
                  <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                    <Link2 size={13} className="text-slate-500 shrink-0" />
                    <span className="text-xs text-slate-400 truncate flex-1 font-mono">{signInUrl}</span>
                    <button
                      type="button"
                      onClick={copyLink}
                      className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                        copied
                          ? 'bg-emerald-600/25 text-emerald-400'
                          : 'bg-indigo-600/25 text-indigo-400 hover:bg-indigo-600/40'
                      }`}
                    >
                      <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {formError}
                </div>
              )}
            </form>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3 shrink-0">
              <button type="button" onClick={() => setPanelOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-white transition">
                {signInUrl ? 'Done' : 'Cancel'}
              </button>
              {!signInUrl && (
                <button
                  onClick={handleProvision}
                  disabled={formLoading || !form.name || !form.email || !form.orgSlug}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  {formLoading ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  {formLoading ? 'Creating…' : 'Create Account'}
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

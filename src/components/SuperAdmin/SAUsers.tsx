/**
 * SAUsers.tsx — User management + provisioning panel
 * Lists all org members. Lets super admin create accounts for existing users.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, RefreshCw, Eye, EyeOff,
  CheckCircle, AlertCircle, Search, X,
} from 'lucide-react';
import { useSaFetch } from '../../lib/useSaFetch';


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
  const [formSuccess, setFormSuccess] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch orgs (for dropdown) and members (from org_members)
      const [orgsRes, statsRes] = await Promise.all([
        saFetch('/admin?action=orgs'),
        saFetch('/admin?action=stats'),
      ]);

      if (!orgsRes.ok) throw new Error('Failed to load orgs');

      const orgsData: any[] = await orgsRes.json();
      const approvedOrgs = orgsData.filter((o: any) => o.status === 'approved');
      setOrgs(approvedOrgs.map((o: any) => ({ id: o.id, name: o.name, slug: o.slug })));

      // Build member list from recentOrgs members — we need a dedicated members endpoint
      // For now derive member data from platform.org_members via a custom query
      // This is a simplified version; in a full impl you'd have GET /api/members
      if (statsRes.ok) {
        // Members list deferred — will add GET /api/members endpoint in next phase
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    try {
      const res = await saFetch('/admin?action=provision', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provisioning failed');

      setFormSuccess(data.message);
      setForm({ name: '', email: '', password: '', orgSlug: form.orgSlug, role: 'member' });
      await fetchData();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  };

  const Input = ({ label, type = 'text', value, onChange, placeholder, required = true }: any) => (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
      />
    </div>
  );

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
            onClick={() => { setPanelOpen(true); setFormError(''); setFormSuccess(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-900/30 transition"
          >
            <UserPlus size={16} /> Provision User
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Approved orgs overview (since we don't have a flat members endpoint yet) */}
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
                      setForm(f => ({ ...f, orgSlug: org.slug }));
                      setPanelOpen(true);
                      setFormError('');
                      setFormSuccess('');
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
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-white">Provision User</p>
                <p className="text-xs text-slate-500 mt-0.5">Create a Clerk account for an existing user</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleProvision} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <Input label="Full name" value={form.name} onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmad Raza" />
              <Input label="Email" type="email" value={form.email} onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" />

              {/* Password field with toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Use the same password they currently use — they can log in immediately without resetting it.
                </p>
              </div>

              {/* Org dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Organisation</label>
                <select
                  value={form.orgSlug}
                  onChange={e => setForm(f => ({ ...f, orgSlug: e.target.value }))}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                >
                  <option value="">Select organisation…</option>
                  {orgs.map(o => (
                    <option key={o.slug} value={o.slug}>{o.name} ({o.slug})</option>
                  ))}
                </select>
              </div>

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

              {/* Feedback */}
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-800/60 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-400">
                  <CheckCircle size={15} className="shrink-0 mt-0.5" /> {formSuccess}
                </div>
              )}
            </form>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={() => setPanelOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={handleProvision}
                disabled={formLoading || !form.name || !form.email || !form.password || !form.orgSlug}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition"
              >
                {formLoading ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
                {formLoading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

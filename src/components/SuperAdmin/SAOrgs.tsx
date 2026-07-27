/**
 * SAOrgs.tsx — Full organisation management table for the super admin SPA
 * Replaces the old SuperAdminDashboard.tsx placeholder.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, PauseCircle, RefreshCw,
  ChevronDown, ChevronUp, Users, Search,
} from 'lucide-react';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  plan: string;
  schema_provisioned: boolean;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  owner_user_id: string | null;
  member_count: number;
}

const saFetch = (path: string, options: RequestInit = {}) =>
  fetch(`/.netlify/functions${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } });

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  pending:   { label: 'Pending',   dot: 'bg-amber-400 animate-pulse',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  approved:  { label: 'Approved',  dot: 'bg-emerald-500',               badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected:  { label: 'Rejected',  dot: 'bg-red-500',                   badge: 'bg-red-500/15 text-red-400 border-red-500/25' },
  suspended: { label: 'Suspended', dot: 'bg-orange-400',                badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
};

const TABS = ['all', 'pending', 'approved', 'rejected', 'suspended'];

export default function SAOrgs() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saFetch('/orgs');
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setOrgs(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleAction = async (org: Org, action: 'approve' | 'reject' | 'suspend') => {
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${org.name}"?`)) return;
    setActionLoading(org.id);
    try {
      const res = await saFetch('/orgs', {
        method: 'PUT',
        body: JSON.stringify({ id: org.id, action, notes: noteInputs[org.id] }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: Org = await res.json();
      setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o));
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const q = search.toLowerCase();
  const filtered = orgs
    .filter(o => tab === 'all' || o.status === tab)
    .filter(o => !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));

  const counts: Record<string, number> = { all: orgs.length };
  for (const o of orgs) counts[o.status] = (counts[o.status] ?? 0) + 1;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organisations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage org status, plans and member access</p>
        </div>
        <button
          onClick={fetchOrgs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 text-sm text-slate-400 hover:text-white transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Status tab filter */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              tab === t
                ? 'bg-indigo-600/25 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {t} <span className="ml-1 opacity-60">{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Org list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-slate-600 py-16">No organisations found.</p>
          )}
          {filtered.map(org => {
            const st = STATUS[org.status] ?? STATUS.pending;
            const expanded = expandedId === org.id;
            const acting = actionLoading === org.id;
            return (
              <div key={org.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-800/40 transition"
                  onClick={() => setExpandedId(expanded ? null : org.id)}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${st.badge}`}>{st.label}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={12} /> {org.member_count}
                    </span>
                    <span className="text-xs text-slate-600">{formatDate(org.created_at)}</span>
                    {expanded ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-slate-800 px-5 py-5 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-xs text-slate-500 mb-1">Plan</p><p className="text-white capitalize">{org.plan}</p></div>
                      <div><p className="text-xs text-slate-500 mb-1">Schema</p><p className={org.schema_provisioned ? 'text-emerald-400' : 'text-slate-500'}>{org.schema_provisioned ? '✓ Provisioned' : 'Not yet'}</p></div>
                      <div><p className="text-xs text-slate-500 mb-1">Contact</p><p className="text-slate-300 truncate">{org.contact_email ?? '—'}</p></div>
                      <div><p className="text-xs text-slate-500 mb-1">Approved</p><p className="text-slate-300">{formatDate(org.approved_at)}</p></div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">Internal notes</label>
                      <textarea
                        rows={2}
                        value={noteInputs[org.id] ?? org.notes ?? ''}
                        onChange={e => setNoteInputs(p => ({ ...p, [org.id]: e.target.value }))}
                        placeholder="Add internal notes…"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {org.status !== 'approved' && (
                        <button onClick={() => handleAction(org, 'approve')} disabled={acting}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition">
                          <CheckCircle size={15} />
                          {org.schema_provisioned ? 'Re-approve' : 'Approve & Provision'}
                        </button>
                      )}
                      {org.status !== 'rejected' && (
                        <button onClick={() => handleAction(org, 'reject')} disabled={acting}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/20 rounded-xl text-sm font-medium disabled:opacity-50 transition">
                          <XCircle size={15} /> Reject
                        </button>
                      )}
                      {org.status === 'approved' && (
                        <button onClick={() => handleAction(org, 'suspend')} disabled={acting}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20 rounded-xl text-sm font-medium disabled:opacity-50 transition">
                          <PauseCircle size={15} /> Suspend
                        </button>
                      )}
                      {acting && <RefreshCw size={16} className="animate-spin text-slate-500 self-center" />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

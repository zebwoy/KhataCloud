/**
 * SuperAdminDashboard.tsx
 * Gated component — only rendered when userType === 'super_admin'.
 * Displays all orgs with pending/approved/rejected status and approval controls.
 */
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, PauseCircle, RefreshCw, Building2, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';

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

const apiFetch = async (url: string, options: RequestInit = {}) => {
  // Try Better Auth session cookie first (new users), then fall back to JWT token
  const token = sessionStorage.getItem('madrasah_auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers, credentials: 'include' });
};

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  approved:  { label: 'Approved',  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  rejected:  { label: 'Rejected',  color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  suspended: { label: 'Suspended', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
};

function formatDate(isoString: string | null) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function SuperAdminDashboard() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/.netlify/functions/orgs');
      if (!res.ok) throw new Error(`Failed to load orgs: ${res.status}`);
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
      const res = await apiFetch('/.netlify/functions/orgs', {
        method: 'PUT',
        body: JSON.stringify({ id: org.id, action, notes: noteInputs[org.id] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Action failed');
      }
      const updated: Org = await res.json();
      setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o));
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const pending = orgs.filter(o => o.status === 'pending');
  const filtered = filterStatus === 'all' ? orgs : orgs.filter(o => o.status === filterStatus);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="text-indigo-500" size={24} />
            Super Admin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organisation management &amp; approval queue
          </p>
        </div>
        <button
          onClick={fetchOrgs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => {
          const count = s === 'all' ? orgs.length : orgs.filter(o => o.status === s).length;
          const isActive = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                isActive
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-black hover:border-indigo-300'
              }`}
            >
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-1">{s === 'all' ? 'Total orgs' : s}</p>
            </button>
          );
        })}
      </div>

      {/* Pending callout */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-center gap-3">
          <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            {pending.length} organisation{pending.length > 1 ? 's' : ''} awaiting your approval
          </p>
        </div>
      )}

      {/* Org list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 dark:text-slate-600 py-12">No organisations found.</p>
          )}
          {filtered.map(org => {
            const cfg = STATUS_CONFIG[org.status];
            const isExpanded = expandedId === org.id;
            const isActing = actionLoading === org.id;
            return (
              <div
                key={org.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black shadow-sm overflow-hidden"
              >
                {/* Row */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : org.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      org.status === 'pending' ? 'bg-amber-400 animate-pulse' :
                      org.status === 'approved' ? 'bg-emerald-500' :
                      org.status === 'suspended' ? 'bg-orange-400' : 'bg-red-400'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{org.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Users size={12} /> {org.member_count}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Registered</p>
                        <p className="text-slate-700 dark:text-slate-300">{formatDate(org.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Plan</p>
                        <p className="text-slate-700 dark:text-slate-300 capitalize">{org.plan}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Schema</p>
                        <p className={org.schema_provisioned ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          {org.schema_provisioned ? 'Provisioned ✓' : 'Not provisioned'}
                        </p>
                      </div>
                      {org.contact_email && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-400 mb-1">Contact</p>
                          <p className="text-slate-700 dark:text-slate-300">{org.contact_email}</p>
                        </div>
                      )}
                      {org.approved_at && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Approved</p>
                          <p className="text-slate-700 dark:text-slate-300">{formatDate(org.approved_at)}</p>
                        </div>
                      )}
                    </div>

                    {/* Internal notes */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Internal notes (optional)</label>
                      <textarea
                        value={noteInputs[org.id] ?? org.notes ?? ''}
                        onChange={e => setNoteInputs(prev => ({ ...prev, [org.id]: e.target.value }))}
                        placeholder="Add notes visible only to super-admins..."
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {org.status !== 'approved' && (
                        <button
                          onClick={() => handleAction(org, 'approve')}
                          disabled={isActing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={15} />
                          {org.schema_provisioned ? 'Re-approve' : 'Approve & Provision'}
                        </button>
                      )}
                      {org.status !== 'rejected' && (
                        <button
                          onClick={() => handleAction(org, 'reject')}
                          disabled={isActing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <XCircle size={15} /> Reject
                        </button>
                      )}
                      {org.status === 'approved' && (
                        <button
                          onClick={() => handleAction(org, 'suspend')}
                          disabled={isActing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <PauseCircle size={15} /> Suspend
                        </button>
                      )}
                      {isActing && (
                        <span className="text-sm text-slate-400 flex items-center gap-2">
                          <RefreshCw size={13} className="animate-spin" /> Processing…
                        </span>
                      )}
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

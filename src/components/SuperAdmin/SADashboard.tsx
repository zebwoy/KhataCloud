/**
 * SADashboard.tsx — Super admin analytics home
 * Shows: org stats, pending queue, recent registrations, member counts.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, Clock, CheckCircle, XCircle,
  RefreshCw, TrendingUp, AlertTriangle,
} from 'lucide-react';

interface Stats {
  orgs: { total: number; pending: number; approved: number; rejected: number; suspended: number };
  members: { total: number; thisWeek: number };
  users: { total: number };
  recentOrgs: any[];
  pendingOrgs: any[];
}

const saFetch = (path: string, options: RequestInit = {}) =>
  fetch(`/.netlify/functions${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 ${accent}`}>
      <div className={`p-2.5 rounded-xl ${accent.includes('amber') ? 'bg-amber-500/15' : accent.includes('emerald') ? 'bg-emerald-500/15' : accent.includes('red') ? 'bg-red-500/15' : 'bg-indigo-500/15'}`}>
        <Icon size={20} className={accent.includes('amber') ? 'text-amber-400' : accent.includes('emerald') ? 'text-emerald-400' : accent.includes('red') ? 'text-red-400' : 'text-indigo-400'} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-white mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function SADashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saFetch('/super-admin-stats');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setStats(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleOrgAction = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this organisation?`)) return;
    setActionLoading(id);
    try {
      const res = await saFetch('/orgs', {
        method: 'PUT',
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await fetchStats();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-800/60 bg-red-900/20 p-4 text-sm text-red-400 flex items-center gap-3">
          <AlertTriangle size={16} />
          {error}
          <button onClick={fetchStats} className="ml-auto text-slate-400 hover:text-white">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Platform overview &amp; pending approvals</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 text-sm text-slate-400 hover:text-white hover:border-slate-700 transition"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orgs"     value={stats.orgs.total}        sub={`${stats.orgs.approved} active`}         icon={Building2}   accent="border-slate-800" />
        <StatCard label="Pending"         value={stats.orgs.pending}       sub={stats.orgs.pending ? 'Needs review' : 'All clear'} icon={Clock}       accent={stats.orgs.pending ? 'border-amber-800/40' : 'border-slate-800'} />
        <StatCard label="Total Members"  value={stats.members.total}      sub={`+${stats.members.thisWeek} this week`}  icon={Users}       accent="border-slate-800" />
        <StatCard label="Auth Users"     value={stats.users.total}        sub="registered accounts"                     icon={TrendingUp}  accent="border-slate-800" />
      </div>

      {/* Two column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending approvals quick-action */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Pending Approvals</h2>
            </div>
            {stats.orgs.pending > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                {stats.orgs.pending}
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-800/50">
            {stats.pendingOrgs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 text-center">No pending approvals 🎉</p>
            ) : (
              stats.pendingOrgs.map((org: any) => (
                <div key={org.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{org.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{org.slug} · {formatDate(org.created_at)}</p>
                    {org.contact_email && (
                      <p className="text-xs text-slate-500 mt-0.5">{org.contact_email}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleOrgAction(org.id, 'approve')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 rounded-lg text-xs font-medium transition disabled:opacity-50"
                    >
                      {actionLoading === org.id
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <CheckCircle size={12} />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleOrgAction(org.id, 'reject')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20 rounded-lg text-xs font-medium transition disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent registrations */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Building2 size={16} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Recent Organisations</h2>
          </div>

          <div className="divide-y divide-slate-800/50">
            {stats.recentOrgs.slice(0, 6).map((org: any) => {
              const statusColor: Record<string, string> = {
                pending:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
                approved:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                rejected:  'bg-red-500/15 text-red-400 border-red-500/20',
                suspended: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
              };
              return (
                <div key={org.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{org.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{org.slug} · {formatDate(org.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500">{org.member_count} members</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColor[org.status] ?? 'text-slate-400'}`}>
                      {org.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

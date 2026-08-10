/**
 * OAAudit.tsx — Org audit log viewer (v2)
 *
 * Features:
 *  - KPI summary cards (logins, active members, transactions, most active user) this week
 *  - Resolved user names shown instead of raw Clerk IDs
 *  - Login / Logout entries with green / slate badge
 *  - Logout entries show page trail as breadcrumb chips
 *  - Paginated log list (50 per page)
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import {
  ChevronLeft, ChevronRight, ScrollText,
  LogIn, LogOut, UserCheck, UserX, UserMinus,
  Plus, Trash2, Settings, RefreshCw,
} from 'lucide-react';
import { Spinner, Button, Badge } from '../../ui';

interface AuditEntry {
  id:           number;
  user_id:      string;
  user_name:    string | null;
  user_email:   string | null;
  user_role:    string;
  action:       string;
  entity_type:  string | null;
  entity_id:    string | null;
  target_name:  string | null;
  target_email: string | null;
  page_trail:   string | null;
  summary:      string | null;
  created_at:   string;
}

interface AuditKpi {
  loginsThisWeek:        number;
  transactionsThisWeek:  number;
  activeMembersThisWeek: number;
  mostActiveUser:        string | null;
}

// ── Action metadata ────────────────────────────────────────────────────────────
const ACTION_META: Record<string, {
  label: string;
  variant: 'success' | 'danger' | 'info' | 'neutral' | 'warning';
  Icon: React.ElementType;
}> = {
  user_login:           { label: 'Login',        variant: 'success', Icon: LogIn      },
  user_logout:          { label: 'Logout',        variant: 'neutral', Icon: LogOut     },
  provision_member:     { label: 'Provisioned',   variant: 'success', Icon: UserCheck  },
  approve_join_request: { label: 'Approved',      variant: 'success', Icon: UserCheck  },
  reject_join_request:  { label: 'Rejected',      variant: 'danger',  Icon: UserX      },
  remove_member:        { label: 'Removed',       variant: 'danger',  Icon: UserMinus  },
  change_member_role:   { label: 'Role changed',  variant: 'warning', Icon: RefreshCw  },
  create_transaction:   { label: 'Transaction',   variant: 'info',    Icon: Plus       },
  delete_transaction:   { label: 'Deleted txn',   variant: 'danger',  Icon: Trash2     },
  settings_updated:     { label: 'Settings',      variant: 'warning', Icon: Settings   },
};

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_KPI: AuditKpi = {
  loginsThisWeek: 8, transactionsThisWeek: 22,
  activeMembersThisWeek: 2, mostActiveUser: 'Rahib Khan',
};
const DEMO_ENTRIES: AuditEntry[] = [
  { id: 101, user_id: 'demo', user_name: 'Rahib Khan', user_email: 'rahib@demo.com',
    user_role: 'org:admin', action: 'create_transaction', entity_type: 'transaction',
    entity_id: null, target_name: null, target_email: null, page_trail: null,
    summary: 'Rahib Khan created Income transaction: ₹5,000 for Monthly Fees',
    created_at: new Date(Date.now() - 3600_000 * 2).toISOString() },
  { id: 102, user_id: 'demo', user_name: 'Rahib Khan', user_email: 'rahib@demo.com',
    user_role: 'org:admin', action: 'approve_join_request', entity_type: 'member',
    entity_id: null, target_name: 'Abdur Rauf', target_email: 'abdur@demo.com', page_trail: null,
    summary: 'Rahib Khan approved join request for Abdur Rauf',
    created_at: new Date(Date.now() - 3600_000 * 24).toISOString() },
  { id: 103, user_id: 'demo', user_name: 'Rahib Khan', user_email: 'rahib@demo.com',
    user_role: 'org:admin', action: 'user_logout', entity_type: null,
    entity_id: null, target_name: null, target_email: null,
    page_trail: 'All Transactions - New Transaction - Reports - Admin › Requests',
    summary: 'Rahib Khan signed out',
    created_at: new Date(Date.now() - 3600_000 * 48).toISOString() },
  { id: 104, user_id: 'demo', user_name: 'Rahib Khan', user_email: 'rahib@demo.com',
    user_role: 'org:admin', action: 'user_login', entity_type: null,
    entity_id: null, target_name: null, target_email: null, page_trail: null,
    summary: 'Rahib Khan signed in',
    created_at: new Date(Date.now() - 3600_000 * 49).toISOString() },
];

// ── KPI Card component ─────────────────────────────────────────────────────────
function KpiCard({ value, label, sub }: { value: string | number | null; label: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-[140px] bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/60 rounded-2xl px-5 py-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
        {value ?? '—'}
      </p>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Trail chips ────────────────────────────────────────────────────────────────
function TrailChips({ trail }: { trail: string }) {
  const parts = trail.split(' - ').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600/50 font-medium">
            {p}
          </span>
          {i < parts.length - 1 && (
            <span className="text-slate-300 dark:text-slate-600 text-[10px]">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Display name helper ────────────────────────────────────────────────────────
function actorLabel(e: AuditEntry): string {
  if (e.user_name) return e.user_name;
  if (e.user_email) return e.user_email;
  return e.user_id.slice(0, 12) + '…';
}
function roleLabel(role: string): string {
  if (role === 'super_admin') return 'SA';
  if (role === 'org:admin')   return 'Admin';
  return 'Member';
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { orgSlug: string; trialMode?: boolean; }

export default function OAAudit({ orgSlug: _orgSlug, trialMode = false }: Props) {
  const { getToken } = useAuth();
  const [entries,    setEntries]    = useState<AuditEntry[]>(trialMode ? DEMO_ENTRIES : []);
  const [kpi,        setKpi]        = useState<AuditKpi | null>(trialMode ? DEMO_KPI : null);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(trialMode ? DEMO_ENTRIES.length : 0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(!trialMode);

  // Fetch KPI + log page in parallel
  const fetch_ = useCallback(async (p: number) => {
    if (trialMode) return;
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [logRes, kpiRes] = await Promise.all([
        fetch(`/api/org-admin?action=audit&page=${p}`, { headers }),
        p === 1 ? fetch('/api/org-admin?action=audit-kpi', { headers }) : Promise.resolve(null),
      ]);
      if (logRes.ok) {
        const d = await logRes.json();
        setEntries(d.entries ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      }
      if (kpiRes?.ok) {
        setKpi(await kpiRes.json());
      }
    } finally { setLoading(false); }
  }, [getToken, trialMode]);

  useEffect(() => { fetch_(page); }, [fetch_, page]);

  if (loading && entries.length === 0)
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      {kpi && (
        <div className="flex flex-wrap gap-3">
          <KpiCard
            value={kpi.loginsThisWeek}
            label="Logins this week"
            sub="unique sign-in events"
          />
          <KpiCard
            value={kpi.activeMembersThisWeek}
            label="Active members"
            sub="who logged in this week"
          />
          <KpiCard
            value={kpi.transactionsThisWeek}
            label="Transactions added"
            sub="in the last 7 days"
          />
          <KpiCard
            value={kpi.mostActiveUser}
            label="Most active member"
            sub="by transactions this week"
          />
        </div>
      )}

      {/* ── Log list ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{total} total entries</p>

        {entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ScrollText size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No audit entries yet.</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {entries.map(e => {
                  const meta = ACTION_META[e.action];
                  const Icon = meta?.Icon ?? ScrollText;
                  const date = new Date(e.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  const isSession = e.action === 'user_login' || e.action === 'user_logout';

                  return (
                    <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        {/* Top row: badge + actor + role */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={meta?.variant ?? 'neutral'} size="sm">
                            <span className="flex items-center gap-1">
                              <Icon size={10} />
                              {meta?.label ?? e.action}
                            </span>
                          </Badge>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {actorLabel(e)}
                          </span>
                          <Badge variant="neutral" size="sm">
                            {roleLabel(e.user_role)}
                          </Badge>
                        </div>

                        {/* Summary */}
                        {e.summary && !isSession && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                            {e.summary}
                          </p>
                        )}

                        {/* Page trail for logout entries */}
                        {e.action === 'user_logout' && e.page_trail && (
                          <TrailChips trail={e.page_trail} />
                        )}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{date}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  leftIcon={<ChevronLeft size={14} />}
                >Prev</Button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronRight size={14} />}
                >Next</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * OAAudit.tsx — Org audit log viewer
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { Spinner, Button, Badge } from '../../ui';

interface AuditEntry {
  id:          number;
  user_id:     string;
  user_role:   string;
  action:      string;
  entity_type: string | null;
  entity_id:   string | null;
  summary:     string | null;
  created_at:  string;
}

const ACTION_LABEL: Record<string, { label: string; variant: 'success' | 'danger' | 'info' | 'neutral' | 'warning' }> = {
  provision_member:     { label: 'Provisioned',  variant: 'success' },
  approve_join_request: { label: 'Approved',     variant: 'success' },
  reject_join_request:  { label: 'Rejected',     variant: 'danger'  },
  remove_member:        { label: 'Removed',      variant: 'danger'  },
  change_member_role:   { label: 'Role changed', variant: 'warning' },
  create_transaction:   { label: 'Transaction',  variant: 'info'    },
  delete_transaction:   { label: 'Deleted txn',  variant: 'danger'  },
};

export default function OAAudit({ orgSlug: _orgSlug }: { orgSlug: string }) {
  const { getToken }      = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage]   = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch(`/api/org-admin?action=audit&page=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setEntries(d.entries ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      }
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { fetch_(page); }, [fetch_, page]);

  if (loading && entries.length === 0)
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{total} total entries</p>
      </div>

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
                const meta = ACTION_LABEL[e.action];
                const date = new Date(e.created_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                });
                return (
                  <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={meta?.variant ?? 'neutral'} size="sm">
                          {meta?.label ?? e.action}
                        </Badge>
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {e.user_id.slice(0, 12)}…
                        </span>
                        <Badge variant="neutral" size="sm">
                          {e.user_role === 'super_admin' ? 'SA' : e.user_role === 'org:admin' ? 'Admin' : 'Member'}
                        </Badge>
                      </div>
                      {e.summary && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{e.summary}</p>
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
  );
}

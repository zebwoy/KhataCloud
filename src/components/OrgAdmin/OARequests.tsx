/**
 * OARequests.tsx — Pending join requests for org admin
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { Check, X, UserCheck, Clock } from 'lucide-react';
import { Spinner, Button } from '../../ui';

interface JoinRequest {
  id:          string;
  user_id:     string;
  status:      string;
  requested_at: string;
  email?:      string;
  firstName?:  string;
  lastName?:   string;
  imageUrl?:   string;
}

interface Props {
  onCountChange: (n: number) => void;
  trialMode?: boolean;
}

const DEMO_REQUESTS: JoinRequest[] = [
  {
    id: 'req-demo-1',
    user_id: 'user-zaid',
    status: 'pending',
    requested_at: new Date().toISOString(),
    email: 'zaid@example.com',
    firstName: 'Zaid',
    lastName: 'Khan',
  },
];

export default function OARequests({ onCountChange, trialMode = false }: Props) {
  const { getToken }           = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>(trialMode ? DEMO_REQUESTS : []);
  const [loading, setLoading]   = useState(!trialMode);
  const [acting, setActing]     = useState<string | null>(null);
  const [toast, setToast]       = useState('');

  const fetch_ = useCallback(async () => {
    if (trialMode) return;
    setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch('/api/org-admin?action=requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setRequests(data);
        onCountChange(data.length);
      }
    } finally { setLoading(false); }
  }, [getToken, onCountChange, trialMode]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const act = async (requestId: string, action: 'approve' | 'reject') => {
    if (trialMode) return;
    setActing(requestId);
    try {
      const token = await getToken();
      const r = await fetch('/api/org-admin?action=request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, action }),
      });
      const d = await r.json();
      if (!r.ok) { setToast(d.error ?? 'Failed'); return; }
      setToast(action === 'approve' ? 'Member approved and added.' : 'Request rejected.');
      setTimeout(() => setToast(''), 3000);
      await fetch_();
    } finally { setActing(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div>
      {toast && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {toast}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCheck size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No pending requests</p>
          <p className="text-xs text-gray-400 mt-1">
            Enable "Accepting requests" in Settings for users to request joining.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {requests.map(req => {
              const name = req.firstName
                ? `${req.firstName} ${req.lastName ?? ''}`.trim()
                : req.user_id;
              const date = new Date(req.requested_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              });
              return (
                <li key={req.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">
                      {(req.firstName ?? req.user_id).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{name}</div>
                      {req.email && <div className="text-xs text-gray-500 dark:text-gray-400">{req.email}</div>}
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                        <Clock size={10} />
                        {date}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      id={`approve-${req.id}`}
                      variant="primary"
                      size="sm"
                      disabled={trialMode || acting === req.id}
                      onClick={() => act(req.id, 'approve')}
                      leftIcon={<Check size={13} />}
                    >
                      {trialMode ? 'Approve (Demo Mode)' : 'Approve'}
                    </Button>
                    <Button
                      id={`reject-${req.id}`}
                      variant="outline"
                      size="sm"
                      disabled={trialMode || acting === req.id}
                      onClick={() => act(req.id, 'reject')}
                      leftIcon={<X size={13} />}
                    >
                      {trialMode ? 'Reject (Demo Mode)' : 'Reject'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

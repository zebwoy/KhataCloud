/**
 * PendingApprovalScreen.tsx — Waiting for org admin approval
 *
 * Shown when user has submitted a join request that's still pending.
 * Allows the user to cancel their request and go back to org selection.
 */
import { useState } from 'react';
import { Clock, X, LogOut } from 'lucide-react';
import { Button } from '../ui';

interface Props {
  orgName?:     string;
  requestedAt?: string;
  getToken:     () => Promise<string | null>;
  onCancelled:  () => void;  // re-check role after cancel → back to OrgSelectionScreen
  onSignOut:    () => void;
}

export default function PendingApprovalScreen({
  orgName,
  requestedAt,
  getToken,
  onCancelled,
  onSignOut,
}: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState('');

  const handleCancel = async () => {
    setCancelling(true);
    setError('');
    try {
      const token = await getToken();
      const r = await fetch('/api/join-requests?action=cancel', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const data = await r.json();
        setError(data.error ?? 'Failed to cancel request');
        return;
      }
      onCancelled(); // re-check role → will show OrgSelectionScreen
    } catch (e: any) {
      setError(e.message ?? 'Network error');
    } finally {
      setCancelling(false);
    }
  };

  const submittedAt = requestedAt
    ? new Date(requestedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-900/25 border border-amber-800/40 mb-6 mx-auto">
          <Clock size={28} className="text-amber-400" />
        </div>

        <h1 className="text-2xl font-bold text-white">Pending Approval</h1>

        {orgName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-600/15 border border-violet-500/25">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-sm text-violet-300 font-medium">{orgName}</span>
          </div>
        )}

        <p className="text-sm text-slate-400 mt-4 leading-relaxed">
          Your request to join this organisation is awaiting admin approval.
          You'll get access as soon as the admin reviews it.
        </p>

        {submittedAt && (
          <p className="text-xs text-slate-600 mt-2">
            Requested on {submittedAt}
          </p>
        )}

        {/* Auto-refresh hint */}
        <p className="text-xs text-slate-600 mt-1">
          This page will reflect approval automatically when you reload.
        </p>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2">
          {/* Reload to check if approved */}
          <Button
            id="btn-check-status"
            variant="primary"
            fullWidth
            onClick={() => window.location.reload()}
          >
            Check approval status
          </Button>

          {/* Cancel and pick different org */}
          <Button
            id="btn-cancel-request"
            variant="outline"
            fullWidth
            disabled={cancelling}
            onClick={handleCancel}
            leftIcon={<X size={14} />}
          >
            {cancelling ? 'Cancelling…' : 'Cancel request — pick different org'}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={onSignOut}
            leftIcon={<LogOut size={14} />}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

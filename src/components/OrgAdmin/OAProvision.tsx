/**
 * OAProvision.tsx — Admin creates a member directly
 */
import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { UserPlus, Copy, Check, Loader2 } from 'lucide-react';
import { Input, Button, Alert } from '../../ui';

interface Props {
  onDone: () => void;
  trialMode?: boolean;
}

export default function OAProvision({ onDone, trialMode = false }: Props) {
  const { getToken } = useAuth();
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading]     = useState(false);
  const [signInUrl, setSignInUrl] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async () => {
    if (trialMode) return;
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    setLoading(true); setError(''); setSignInUrl(null);
    try {
      const token = await getToken();
      const r = await fetch('/api/org-admin?action=provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Failed to create member'); return; }
      setSignInUrl(d.signInUrl ?? null);
    } finally { setLoading(false); }
  };

  const handleCopy = () => {
    if (!signInUrl) return;
    navigator.clipboard.writeText(signInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setName(''); setEmail(''); setSignInUrl(null); setError(''); setCopied(false);
  };

  if (signInUrl) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4">
            <Check size={22} className="text-emerald-400" />
          </div>
          <h2 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-1">Member Created</h2>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
            Share this one-time sign-in link with <strong className="text-gray-700 dark:text-gray-200">{name}</strong>.
            It expires in 7 days.
          </p>

          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 mb-4 break-all text-xs text-gray-600 dark:text-gray-300 font-mono">
            {signInUrl}
          </div>

          <div className="flex gap-2">
            <Button
              id="btn-copy-link"
              variant="primary"
              fullWidth
              onClick={handleCopy}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
            >
              {copied ? 'Copied!' : 'Copy Sign-in Link'}
            </Button>
            <Button variant="outline" onClick={handleReset}>Add another</Button>
          </div>

          <Button variant="ghost" fullWidth className="mt-2" onClick={onDone}>
            View Members
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <UserPlus size={17} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Add Member</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Create an account and generate a sign-in link to share.
            </p>
          </div>
        </div>

        {trialMode && (
          <Alert variant="info" className="mb-4">
            Member invitations and provisioning are locked in demo mode.
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">{error}</Alert>
        )}

        <div className="space-y-4">
          <Input
            id="provision-name"
            label="Full Name"
            placeholder="Zaid Ahmad"
            value={name}
            disabled={trialMode}
            onChange={e => setName(e.target.value)}
          />
          <Input
            id="provision-email"
            label="Email Address"
            type="email"
            placeholder="zaid@example.com"
            value={email}
            disabled={trialMode}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
          <p className="text-xs text-gray-400 mb-4">
            The member will be added as <strong className="text-gray-500 dark:text-gray-300">Member</strong> role.
            Their account is created with a secure random password — they set their own via the sign-in link.
          </p>
          <Button
            id="btn-add-member"
            variant="primary"
            fullWidth
            disabled={trialMode || loading}
            onClick={handleSubmit}
            leftIcon={loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          >
            {trialMode ? 'Create Member (Demo Mode Locked)' : loading ? 'Creating account…' : 'Create Member & Get Link'}
          </Button>
        </div>
      </div>
    </div>
  );
}

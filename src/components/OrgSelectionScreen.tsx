/**
 * OrgSelectionScreen.tsx — "Select your organisation" screen
 *
 * Shown when a user is authenticated (valid Clerk session) but not in any org.
 * User browses orgs accepting requests, picks one, and submits a join request.
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, Building2, ArrowRight, LogOut, CheckCircle2, Loader2 } from 'lucide-react';
import { Button, Spinner } from '../ui';

interface Org {
  id:   string;
  name: string;
  slug: string;
}

interface Props {
  email?:      string;
  getToken:    () => Promise<string | null>;
  onSubmitted: () => void;
  onSignOut:   () => void;
}

export default function OrgSelectionScreen({ email, getToken, onSubmitted, onSignOut }: Props) {
  const [orgs, setOrgs]         = useState<Org[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Org | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  const fetchOrgs = useCallback(async () => {
    try {
      const r = await fetch('/api/join-requests?action=orgs');
      if (r.ok) setOrgs(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const token = await getToken();
      const r = await fetch('/api/join-requests?action=submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId: selected.id }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? 'Failed to submit request'); return; }
      onSubmitted(); // triggers re-check of role → should show PendingApprovalScreen
    } catch (e: any) {
      setError(e.message ?? 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Glass card */}
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4">
            <Building2 size={24} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Select Organisation</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            {email && <span className="text-slate-300 font-medium">{email} · </span>}
            Choose the organisation you belong to. Your request will be reviewed by the admin.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            id="org-search"
            placeholder="Search organisations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="
              w-full pl-9 pr-4 py-3
              bg-slate-800/60 border border-slate-700/50
              rounded-xl text-sm text-white placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
              transition-all
            "
          />
        </div>

        {/* Org list */}
        <div className="
          bg-slate-900/60 border border-slate-800/60
          rounded-2xl overflow-hidden mb-4
          shadow-xl
        ">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {search ? 'No organisations match your search.' : 'No organisations available to join right now.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
              {filtered.map(org => {
                const isSelected = selected?.id === org.id;
                return (
                  <li key={org.id}>
                    <button
                      id={`org-${org.slug}`}
                      onClick={() => setSelected(isSelected ? null : org)}
                      className={`
                        w-full flex items-center justify-between px-4 py-3.5
                        text-left transition-all duration-150
                        ${isSelected
                          ? 'bg-violet-600/20 text-white'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                          ${isSelected
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-700 text-slate-400'
                          }
                        `}>
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{org.name}</div>
                          <div className="text-xs text-slate-500">{org.slug}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={18} className="text-violet-400 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            id="btn-request-join"
            variant="primary"
            fullWidth
            disabled={!selected || submitting}
            onClick={handleSubmit}
            rightIcon={submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          >
            {submitting
              ? 'Submitting…'
              : selected
                ? `Request to join ${selected.name}`
                : 'Select an organisation first'
            }
          </Button>
          <Button variant="ghost" fullWidth onClick={onSignOut} leftIcon={<LogOut size={14} />}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

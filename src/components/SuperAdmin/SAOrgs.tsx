/**
 * SAOrgs.tsx — Organisation management (list, create, edit, approve/reject/suspend)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, PauseCircle, RefreshCw,
  ChevronDown, ChevronUp, Users, Search, Plus, Pencil, X,
  AlertCircle, ShieldCheck, ShieldMinus, Mail, Calendar, Crown,
} from 'lucide-react';
import { useSaFetch } from '../../lib/useSaFetch';
import { Select } from '../../ui';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  plan: string;
  schema_provisioned: boolean;
  clerk_org_id: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  owner_user_id: string | null;
  member_count: number;
}

interface OrgMember {
  userId:    string;
  firstName: string;
  lastName:  string;
  email:     string;
  imageUrl:  string;
  role:      string; // 'org:admin' | 'org:member'
  joinedAt:  number;
}

type CreateForm = { name: string; slug: string; contactEmail: string; plan: string; notes: string };
type EditForm   = { name: string; contactEmail: string; plan: string; notes: string };

const EMPTY_CREATE: CreateForm = { name: '', slug: '', contactEmail: '', plan: 'free', notes: '' };

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

const PLANS: { value: string; label: string }[] = [
  { value: 'free',       label: 'Free' },
  { value: 'basic',      label: 'Basic' },
  { value: 'pro',        label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];
const TABS  = ['all', 'pending', 'approved', 'rejected', 'suspended'] as const;

// ─── Shared field component — defined OUTSIDE to prevent re-mount on keystroke ──
function Field({
  label, value, onChange, placeholder, type = 'text', readOnly, hint,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readOnly?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-sm placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
          ${readOnly
            ? 'border-slate-700/50 text-slate-500 cursor-not-allowed'
            : 'border-slate-700 text-white'}`}
      />
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Org Members sub-component ───────────────────────────────────────────────
function OrgMembersSection({
  clerkOrgId, orgSlug,
}: {
  clerkOrgId: string; orgSlug: string;
}) {
  const saFetch = useSaFetch();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await saFetch(`/admin?action=org-members&clerkOrgId=${clerkOrgId}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setMembers(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clerkOrgId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const changeRole = async (member: OrgMember, newRole: 'org:admin' | 'org:member') => {
    const action = newRole === 'org:admin' ? 'make admin' : 'remove admin from';
    if (!window.confirm(`${action} "${member.firstName} ${member.lastName}"?`)) return;
    setRoleLoading(member.userId);
    try {
      const res = await saFetch('/admin?action=org-member-role', {
        method: 'PATCH',
        body: JSON.stringify({ clerkOrgId, userId: member.userId, role: newRole, orgSlug }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMembers(prev => prev.map(m =>
        m.userId === member.userId ? { ...m, role: newRole } : m
      ));
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setRoleLoading(null);
    }
  };

  const initials = (m: OrgMember) =>
    ((m.firstName?.[0] ?? '') + (m.lastName?.[0] ?? '')).toUpperCase() || m.email[0]?.toUpperCase() || '?';

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
      <RefreshCw size={13} className="animate-spin" /> Loading members…
    </div>
  );

  if (error) return (
    <p className="text-xs text-red-400 py-2">Failed to load members: {error}</p>
  );

  if (members.length === 0) return (
    <p className="text-xs text-slate-600 py-2">No members in this organisation yet.</p>
  );

  // Sort: admins first
  const sorted = [...members].sort((a, b) => {
    if (a.role === b.role) return a.email.localeCompare(b.email);
    return a.role === 'org:admin' ? -1 : 1;
  });

  return (
    <div className="space-y-2">
      {sorted.map(m => {
        const isAdmin = m.role === 'org:admin';
        const acting  = roleLoading === m.userId;
        return (
          <div key={m.userId}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition
              ${ isAdmin
                ? 'bg-indigo-950/30 border-indigo-800/40'
                : 'bg-slate-800/40 border-slate-700/40' }`}
          >
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${ isAdmin ? 'bg-indigo-600/30 text-indigo-300' : 'bg-slate-700 text-slate-300' }`}>
              {m.imageUrl
                ? <img src={m.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                : initials(m)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-white truncate">
                  {m.firstName} {m.lastName}
                </p>
                {isAdmin && <Crown size={11} className="text-indigo-400 shrink-0" />}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-slate-500 truncate">
                  <Mail size={10} /> {m.email}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-600">
                  <Calendar size={10} />
                  {new Date(m.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Role badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
              isAdmin
                ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                : 'bg-slate-700/50 text-slate-400 border-slate-600/40'
            }`}>
              {isAdmin ? 'Admin' : 'Member'}
            </span>

            {/* Role action — only for admins (promote) or demote current admins */}
            {acting ? (
              <RefreshCw size={14} className="animate-spin text-slate-500 shrink-0" />
            ) : isAdmin ? (
              <button
                onClick={() => changeRole(m, 'org:member')}
                title="Remove admin role"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/30
                  transition shrink-0"
              >
                <ShieldMinus size={12} /> Remove Admin
              </button>
            ) : (
              <button
                onClick={() => changeRole(m, 'org:admin')}
                title="Promote to admin"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-800/30
                  transition shrink-0"
              >
                <ShieldCheck size={12} /> Make Admin
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}


function SlideOver({ title, subtitle, onClose, children, footer }: {
  title: string; subtitle: string; onClose: () => void;
  children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <p className="text-base font-bold text-white">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 scroll-hidden px-6 py-6 space-y-5">
          {children}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 shrink-0">
          {footer}
        </div>
      </aside>
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SAOrgs() {
  const saFetch = useSaFetch();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  // Create panel
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit panel
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', contactEmail: '', plan: 'free', notes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saFetch('/admin?action=orgs');
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setOrgs(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  // ── Status action (approve / reject / suspend) ────────────────────────────
  const handleAction = async (org: Org, action: 'approve' | 'reject' | 'suspend') => {
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${org.name}"?`)) return;
    setActionLoading(org.id);
    try {
      const res = await saFetch('/admin?action=orgs', {
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

  // ── Create org ────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await saFetch('/admin?action=orgs', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          slug: createForm.slug,
          contactEmail: createForm.contactEmail || undefined,
          plan: createForm.plan,
          notes: createForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create org');
      setOrgs(prev => [data, ...prev]);
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Edit org details ──────────────────────────────────────────────────────
  const openEdit = (org: Org) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      contactEmail: org.contact_email ?? '',
      plan: org.plan,
      notes: org.notes ?? '',
    });
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrg) return;
    setEditLoading(true);
    setEditError('');
    try {
      const res = await saFetch('/admin?action=orgs', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editOrg.id,
          name: editForm.name,
          contactEmail: editForm.contactEmail || undefined,
          plan: editForm.plan,
          notes: editForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update org');
      setOrgs(prev => prev.map(o => o.id === data.id ? data : o));
      setEditOrg(null);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = orgs
    .filter(o => tab === 'all' || o.status === tab)
    .filter(o => !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));

  const counts: Record<string, number> = { all: orgs.length };
  for (const o of orgs) counts[o.status] = (counts[o.status] ?? 0) + 1;

  // ── Auto-slug from name ───────────────────────────────────────────────────
  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organisations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage org status, plans and member access</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrgs} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 text-sm text-slate-400 hover:text-white transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => { setCreateOpen(true); setCreateForm(EMPTY_CREATE); setCreateError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-900/30 transition"
          >
            <Plus size={16} /> New Organisation
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Status tabs */}
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
                    <span className="flex items-center gap-1 text-xs text-slate-500"><Users size={12} /> {org.member_count}</span>
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

                    {org.notes && (
                      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                        <p className="text-xs text-slate-500 mb-1">Notes</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{org.notes}</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">Add / update internal notes</label>
                      <textarea
                        rows={2}
                        value={noteInputs[org.id] ?? ''}
                        onChange={e => setNoteInputs(p => ({ ...p, [org.id]: e.target.value }))}
                        placeholder="Internal notes…"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* ── Members section ── */}
                    {org.clerk_org_id && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Users size={13} /> Members
                        </p>
                        <OrgMembersSection
                          clerkOrgId={org.clerk_org_id}
                          orgSlug={org.slug}
                        />
                      </div>
                    )}
                    {!org.clerk_org_id && (
                      <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Users size={12} /> No Clerk org linked — approve org first to see members.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {/* Edit details */}
                      <button
                        onClick={() => openEdit(org)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-sm font-medium transition"
                      >
                        <Pencil size={14} /> Edit Details
                      </button>

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

      {/* ── Create Org slide-over ──────────────────────────────────────────── */}
      {createOpen && (
        <SlideOver
          title="New Organisation"
          subtitle="Creates org as approved with schema provisioned immediately"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createLoading || !createForm.name || !createForm.slug}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition"
              >
                {createLoading ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
                {createLoading ? 'Creating…' : 'Create Org'}
              </button>
            </>
          }
        >
          <Field
            label="Organisation Name"
            value={createForm.name}
            onChange={v => setCreateForm(f => ({
              ...f, name: v,
              slug: f.slug === autoSlug(f.name) ? autoSlug(v) : f.slug,
            }))}
            placeholder="Al-Madrasah Al-Quraniyyah"
          />
          <Field
            label="Slug"
            value={createForm.slug}
            onChange={v => setCreateForm(f => ({ ...f, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            placeholder="al-madrasah"
            hint="Lowercase letters, numbers, hyphens. Cannot be changed later."
          />
          <Field
            label="Contact Email (optional)"
            type="email"
            value={createForm.contactEmail}
            onChange={v => setCreateForm(f => ({ ...f, contactEmail: v }))}
            placeholder="admin@org.com"
          />
          <Select label="Plan" value={createForm.plan} onChange={v => setCreateForm(f => ({ ...f, plan: v }))} options={PLANS} />
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea
              rows={3}
              value={createForm.notes}
              onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
          {createError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {createError}
            </div>
          )}
        </SlideOver>
      )}

      {/* ── Edit Org slide-over ────────────────────────────────────────────── */}
      {editOrg && (
        <SlideOver
          title="Edit Organisation"
          subtitle={`Editing: ${editOrg.slug}`}
          onClose={() => setEditOrg(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditOrg(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={editLoading || !editForm.name}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition"
              >
                {editLoading ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <Field
            label="Slug (read-only)"
            value={editOrg.slug}
            readOnly
            hint="Slug cannot be changed — it is tied to the database schema."
          />
          <Field
            label="Organisation Name"
            value={editForm.name}
            onChange={v => setEditForm(f => ({ ...f, name: v }))}
            placeholder="Organisation display name"
          />
          <Field
            label="Contact Email"
            type="email"
            value={editForm.contactEmail}
            onChange={v => setEditForm(f => ({ ...f, contactEmail: v }))}
            placeholder="admin@org.com"
          />
          <Select label="Plan" value={editForm.plan} onChange={v => setEditForm(f => ({ ...f, plan: v }))} options={PLANS} />
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea
              rows={4}
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
          {editError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {editError}
            </div>
          )}
        </SlideOver>
      )}
    </div>
  );
}

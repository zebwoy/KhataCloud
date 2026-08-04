/**
 * OAMembers.tsx — Members list for org admin
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { UserX, User } from 'lucide-react';
import { Spinner, Badge, Avatar, Button } from '../../ui';

interface Member {
  userId:    string;
  firstName: string;
  lastName:  string;
  email:     string;
  imageUrl:  string;
  role:      string;
  joinedAt:  string;
}

interface Props {
  orgSlug?: string;
  trialMode?: boolean;
}

const DEMO_MEMBERS: Member[] = [
  { userId: 'demo-1', firstName: 'Demo', lastName: 'Admin', email: 'demo@khata.cloud', imageUrl: '', role: 'org:admin', joinedAt: '2026-01-01' },
  { userId: 'demo-2', firstName: 'Abdur', lastName: 'Rauf', email: 'abdurrauf@example.com', imageUrl: '', role: 'org:member', joinedAt: '2026-01-15' },
  { userId: 'demo-3', firstName: 'Ayman', lastName: 'Shafi', email: 'ayman@example.com', imageUrl: '', role: 'org:member', joinedAt: '2026-02-01' },
  { userId: 'demo-4', firstName: 'Rahib', lastName: 'Ahmed', email: 'rahib@example.com', imageUrl: '', role: 'org:member', joinedAt: '2026-02-10' },
];

export default function OAMembers({ trialMode = false }: Props) {
  const { getToken }         = useAuth();
  const [members, setMembers] = useState<Member[]>(trialMode ? DEMO_MEMBERS : []);
  const [loading, setLoading] = useState(!trialMode);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (trialMode) return;
    setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch('/api/org-admin?action=members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setMembers(d.members ?? []);
      }
    } finally { setLoading(false); }
  }, [getToken, trialMode]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleRemove = async (member: Member) => {
    if (trialMode) return;
    if (!confirm(`Remove ${member.firstName} ${member.lastName} from this organisation?`)) return;
    setRemoving(member.userId);
    try {
      const token = await getToken();
      await fetch(`/api/org-admin?action=member&userId=${encodeURIComponent(member.userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetch_();
    } finally { setRemoving(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <User size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No members yet. Use "Add Member" to invite someone.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {members.map(m => (
              <li key={m.userId} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={m.imageUrl}
                    name={`${m.firstName} ${m.lastName}`}
                    size="md"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {m.firstName} {m.lastName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{m.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={m.role === 'org:admin' ? 'info' : 'neutral'}
                    dot
                  >
                    {m.role === 'org:admin' ? 'Admin' : 'Member'}
                  </Badge>
                  {m.role !== 'org:admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(m)}
                      disabled={trialMode || removing === m.userId}
                      leftIcon={<UserX size={13} />}
                      title={trialMode ? 'Member management is locked in demo mode' : undefined}
                    >
                      {trialMode ? 'Remove (Demo Mode)' : 'Remove'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

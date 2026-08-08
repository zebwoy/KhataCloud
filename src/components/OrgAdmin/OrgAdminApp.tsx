/**
 * OrgAdminApp.tsx — Org admin panel root
 *
 * Tabbed layout with: Members, Requests, Provision, Audit, Settings
 * Shown when org:admin clicks the "Admin" tab in FloatingNavBar.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { Users, UserCheck, UserPlus, ScrollText, Settings } from 'lucide-react';
import { Badge } from '../../ui';
import OAMembers   from './OAMembers';
import OARequests  from './OARequests';
import OAProvision from './OAProvision';
import OAAudit     from './OAAudit';
import OASettings  from './OASettings';

type AdminTab = 'members' | 'requests' | 'provision' | 'audit' | 'settings';

interface Props {
  orgSlug: string;
  trialMode?: boolean;
}

export default function OrgAdminApp({ orgSlug, trialMode = false }: Props) {
  const { getToken }      = useAuth();
  const [tab, setTab]     = useState<AdminTab>('members');
  const [pendingCount, setPendingCount] = useState(trialMode ? 1 : 0);

  useEffect(() => {
    if (trialMode) return;
    const fetchCount = async () => {
      try {
        const token = await getToken();
        const r = await fetch('/api/org-admin?action=pending-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const d = await r.json();
          setPendingCount(d.count ?? 0);
        }
      } catch { /* non-critical */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [getToken, trialMode]);

  const tabs = [
    { key: 'members',   label: 'Members',   icon: Users },
    { key: 'requests',  label: 'Requests',  icon: UserCheck,  badge: pendingCount },
    { key: 'provision', label: 'Add Member', icon: UserPlus },
    { key: 'audit',     label: 'Audit Log', icon: ScrollText },
    { key: 'settings',  label: 'Settings',  icon: Settings },
  ] as { key: AdminTab; label: string; icon: React.ElementType; badge?: number }[];

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="mb-6 pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          {trialMode && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
              Demo Mode
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage members, approve requests, and configure your organisation.
        </p>
        {trialMode && (
          <p className="text-xs font-medium text-amber-600/90 dark:text-amber-400/90 mt-2.5 flex items-center gap-1.5 animate-pulse">
            <span>✨</span> Exploring Admin Capabilities — Member actions are read-only; Customization is fully interactive!
          </p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl mb-6 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            id={`admin-tab-${key}`}
            onClick={() => setTab(key)}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-lg
              text-sm font-medium whitespace-nowrap flex-shrink-0
              transition-all duration-200
              ${tab === key
                ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
              }
            `}
          >
            <Icon size={15} />
            {label}
            {badge != null && badge > 0 && (
              <Badge variant="danger" size="sm">{badge}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'members'   && <OAMembers   trialMode={trialMode} />}
        {tab === 'requests'  && <OARequests  onCountChange={setPendingCount} trialMode={trialMode} />}
        {tab === 'provision' && <OAProvision onDone={() => setTab('members')} trialMode={trialMode} />}
        {tab === 'audit'     && <OAAudit     orgSlug={orgSlug} trialMode={trialMode} />}
        {tab === 'settings'  && <OASettings  trialMode={trialMode} />}
      </div>
    </div>
  );
}

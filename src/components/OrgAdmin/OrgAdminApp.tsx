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
      {/* Demo Banner */}
      {trialMode && (
        <div className="mb-6 p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/20 text-violet-300 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold text-[10px] uppercase tracking-wide">
              Demo Mode
            </span>
            <span>
              Exploring Admin Capabilities — Member actions are read-only; Customization is fully interactive!
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage members, approve requests, and configure your organisation.
        </p>
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

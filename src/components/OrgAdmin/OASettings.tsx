/**
 * OASettings.tsx — Org admin settings panel
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { ToggleLeft, ToggleRight, Save, Loader2, LayoutTemplate } from 'lucide-react';
import { Spinner, Input, Button, Alert } from '../../ui';

interface OrgSettings {
  id:                 string;
  name:               string;
  slug:               string;
  plan:               string;
  contact_email:      string | null;
  accepting_requests: boolean;
  notes:              string | null;
}

interface Props {
  orgSlug?: string;
  trialMode?: boolean;
}

const DEMO_SETTINGS: OrgSettings = {
  id: 'demo-org-101',
  name: 'Demo Organisation',
  slug: 'demo',
  plan: 'Enterprise (Demo)',
  contact_email: 'demo@khata.cloud',
  accepting_requests: true,
  notes: null,
};

export default function OASettings({ trialMode = false }: Props) {
  const { getToken } = useAuth();
  const [settings, setSettings]       = useState<OrgSettings | null>(trialMode ? DEMO_SETTINGS : null);
  const [loading, setLoading]         = useState(!trialMode);
  const [saving, setSaving]           = useState(false);
  const [contactEmail, setContactEmail] = useState(trialMode ? 'demo@khata.cloud' : '');
  const [accepting, setAccepting]     = useState(trialMode ? true : false);
  const [success, setSuccess]         = useState('');
  const [error, setError]             = useState('');
  const [navStyle, setNavStyle]       = useState<'pill' | 'classic'>(
    () => (localStorage.getItem('kc_nav_style') ?? 'pill') as 'pill' | 'classic'
  );

  const fetch_ = useCallback(async () => {
    if (trialMode) return;
    setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch('/api/org-admin?action=settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d: OrgSettings = await r.json();
        setSettings(d);
        setContactEmail(d.contact_email ?? '');
        setAccepting(d.accepting_requests);
      }
    } finally { setLoading(false); }
  }, [getToken, trialMode]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSave = async () => {
    if (trialMode) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const token = await getToken();
      const r = await fetch('/api/org-admin?action=settings-save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          acceptingRequests: accepting,
          contactEmail: contactEmail.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Failed to save'); return; }
      setSuccess('Settings saved.');
      setTimeout(() => setSuccess(''), 3000);
      await fetch_();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!settings) return <div className="text-center py-12 text-gray-400 text-sm">Could not load settings.</div>;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-6">

        {/* Org info (read-only) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Organisation Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{settings.name}</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Plan</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">{settings.plan}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800" />

        {/* Accepting requests toggle */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Accept Join Requests
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            When enabled, your organisation appears on the sign-up screen and users can request to join.
          </p>
          <button
            id="toggle-accepting-requests"
            onClick={() => setAccepting(v => !v)}
            className="flex items-center gap-3 w-full group"
          >
            <div className={`
              relative w-12 h-6 rounded-full transition-all duration-300
              ${accepting ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-700'}
            `}>
              <div className={`
                absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm
                transition-all duration-300
                ${accepting ? 'translate-x-6' : 'translate-x-0'}
              `} />
            </div>
            <span className={`text-sm font-medium transition-colors ${accepting ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {accepting ? 'Accepting new members' : 'Not accepting requests'}
            </span>
            {accepting
              ? <ToggleRight size={20} className="ml-auto text-violet-500" />
              : <ToggleLeft  size={20} className="ml-auto text-gray-400" />
            }
          </button>
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800" />

        {/* Contact email */}
        <div>
          <Input
            id="contact-email"
            label="Contact Email"
            type="email"
            placeholder="admin@yourorg.com"
            value={contactEmail}
            disabled={trialMode}
            onChange={e => setContactEmail(e.target.value)}
            hint="Shown to super admin for correspondence."
          />
        </div>

        {/* Feedback */}
        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Button
          id="btn-save-settings"
          variant="primary"
          fullWidth
          disabled={trialMode || saving}
          onClick={handleSave}
          leftIcon={saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        >
          {trialMode ? 'Save Settings (Demo Mode Locked)' : saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>

      {/* Customization Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 mt-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutTemplate size={14} className="text-violet-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Customization</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Configure layout and interface preferences.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Navigation Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['pill', 'classic'] as const).map(style => (
                  <button
                    key={style}
                    id={`nav-style-${style}`}
                    onClick={() => {
                      setNavStyle(style);
                      localStorage.setItem('kc_nav_style', style);
                    }}
                    className={`
                      rounded-xl border-2 p-3 text-left transition-all duration-200
                      ${ navStyle === style
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }
                    `}
                  >
                    <p className={`text-sm font-semibold mb-0.5 ${
                      navStyle === style ? 'text-violet-700 dark:text-violet-300' : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {style === 'pill' ? 'Sub-menu (Default)' : 'Classic Tabs'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {style === 'pill'
                        ? 'View / Add from nav link popup'
                        : 'Toggle inside content area'}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">
                Applies immediately. Reload the page if settings do not update.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

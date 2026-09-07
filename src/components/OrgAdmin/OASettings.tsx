/**
 * OASettings.tsx — Org admin settings panel
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { Save, Loader2, LayoutTemplate, ListPlus, X as XIcon, RotateCcw } from 'lucide-react';
import { Spinner, Input, Button, Alert } from '../../ui';
import type { NoticeboardConfig } from '../../../api/org-config';

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

  // All known default subcategories
  const DEFAULT_INCOME_SUBCATS  = ['Donations', 'Student Fees', 'Grants', 'Other Income'];
  const DEFAULT_EXPENSE_SUBCATS = ['Salaries', 'Utilities', 'Books & Materials', 'Infrastructure', 'Other Expenses'];

  // ── Custom subcategory state ─────────────────────────────────────────────
  const [customIncome,  setCustomIncome]  = useState<string[]>(DEFAULT_INCOME_SUBCATS);
  const [customExpense, setCustomExpense] = useState<string[]>(DEFAULT_EXPENSE_SUBCATS);
  const [newIncomeSub,  setNewIncomeSub]  = useState('');
  const [newExpenseSub, setNewExpenseSub] = useState('');
  const [subLoading,    setSubLoading]    = useState(!trialMode);
  const [subSaving,     setSubSaving]     = useState(false);
  const [subSuccess,    setSubSuccess]    = useState('');
  const [subError,      setSubError]      = useState('');

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

  // ── Subcategories config load ─────────────────────────────────────────────
  const fetchSubConfig = useCallback(async () => {
    if (trialMode) { setSubLoading(false); return; }
    setSubLoading(true);
    try {
      const token = await getToken();
      const r = await fetch('/api/org-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d: NoticeboardConfig = await r.json();
        setCustomIncome(d.customIncomeSubcats   ?? DEFAULT_INCOME_SUBCATS);
        setCustomExpense(d.customExpenseSubcats ?? DEFAULT_EXPENSE_SUBCATS);
      }
    } finally { setSubLoading(false); }
  }, [getToken, trialMode]);

  useEffect(() => { fetchSubConfig(); }, [fetchSubConfig]);

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

  // ── Subcategories config save ─────────────────────────────────────────────
  const handleSaveSubcategories = async () => {
    if (trialMode) return;
    setSubSaving(true); setSubError(''); setSubSuccess('');
    try {
      const token = await getToken();
      const r = await fetch('/api/org-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customIncomeSubcats:  customIncome,
          customExpenseSubcats: customExpense,
        } satisfies Partial<NoticeboardConfig>),
      });
      const d = await r.json();
      if (!r.ok) { setSubError(d.error ?? 'Failed to save subcategories'); return; }
      setSubSuccess('Subcategories saved successfully.');
      setTimeout(() => setSubSuccess(''), 3000);
    } finally { setSubSaving(false); }
  };

  // Add / remove from custom subcategory lists
  const addSub = (list: string[], setList: (v: string[]) => void, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || list.includes(trimmed)) return;
    setList([...list, trimmed]);
  };
  const removeSub = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.filter(s => s !== value));

  if (loading || subLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
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

      {/* Subcategory Management Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <ListPlus size={14} className="text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Subcategory Management</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Customise the income and expense subcategories shown when adding transactions.
        </p>

        {/* Income subcategories */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">Income Subcategories</p>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
            {customIncome.map(sub => (
              <span key={sub} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                {sub}
                <button
                  type="button"
                  disabled={trialMode}
                  onClick={() => removeSub(customIncome, setCustomIncome, sub)}
                  className="ml-0.5 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Remove"
                >
                  <XIcon size={11} />
                </button>
              </span>
            ))}
            {customIncome.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 italic">No income subcategories defined</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add income subcategory…"
              value={newIncomeSub}
              disabled={trialMode}
              onChange={e => setNewIncomeSub(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSub(customIncome, setCustomIncome, newIncomeSub);
                  setNewIncomeSub('');
                }
              }}
              className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
            <button
              type="button"
              disabled={trialMode || !newIncomeSub.trim()}
              onClick={() => { addSub(customIncome, setCustomIncome, newIncomeSub); setNewIncomeSub(''); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              disabled={trialMode}
              onClick={() => setCustomIncome(['Donations', 'Student Fees', 'Grants', 'Other Income'])}
              className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw size={13} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Expense subcategories */}
        <div>
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">Expense Subcategories</p>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
            {customExpense.map(sub => (
              <span key={sub} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium">
                {sub}
                <button
                  type="button"
                  disabled={trialMode}
                  onClick={() => removeSub(customExpense, setCustomExpense, sub)}
                  className="ml-0.5 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Remove"
                >
                  <XIcon size={11} />
                </button>
              </span>
            ))}
            {customExpense.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 italic">No expense subcategories defined</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add expense subcategory…"
              value={newExpenseSub}
              disabled={trialMode}
              onChange={e => setNewExpenseSub(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSub(customExpense, setCustomExpense, newExpenseSub);
                  setNewExpenseSub('');
                }
              }}
              className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
            <button
              type="button"
              disabled={trialMode || !newExpenseSub.trim()}
              onClick={() => { addSub(customExpense, setCustomExpense, newExpenseSub); setNewExpenseSub(''); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              disabled={trialMode}
              onClick={() => setCustomExpense(['Salaries', 'Utilities', 'Books & Materials', 'Infrastructure', 'Other Expenses'])}
              className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw size={13} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {subError && (
          <div className="mt-4">
            <Alert variant="error">{subError}</Alert>
          </div>
        )}
        {subSuccess && (
          <div className="mt-4">
            <Alert variant="success">{subSuccess}</Alert>
          </div>
        )}

        {/* Save Button for Subcategories */}
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
          <Button
            id="btn-save-subcategories"
            variant="primary"
            fullWidth
            disabled={trialMode || subSaving}
            onClick={handleSaveSubcategories}
            leftIcon={subSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          >
            {trialMode ? 'Save Subcategories (Demo Mode Locked)' : subSaving ? 'Saving…' : 'Save Subcategories'}
          </Button>
        </div>
      </div>
    </div>
  );
}

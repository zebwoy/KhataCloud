/**
 * AnalyticsPanel.tsx — Tab-switching analytics container
 *
 * Wraps multiple analytics "views" behind a pill tab bar.
 * Each view is a pure component registered in VIEWS below.
 * Adding a new view = 1 import + 1 entry in VIEWS. No other changes needed.
 *
 * Current views:
 *   breakdown   — Category/Trustee breakdown (existing FinancialReports content)
 *   noticeboard — Digital monthly whiteboard with CMS-driven public summary
 */
import { useState } from 'react';
import { LayoutGrid, ClipboardList } from 'lucide-react';
import type { Transaction, Theme } from '../types';
import type { Stats } from '../utils/calculations';
import type { DateFilterMode } from '../utils/constants';
import type { NoticeboardConfig } from '../../api/org-config';
import CategoryBreakdownView from './analytics/CategoryBreakdownView';
import NoticeboardView from './analytics/NoticeboardView';

type ViewId = 'breakdown' | 'noticeboard';

interface ViewDef {
  id: ViewId;
  label: string;
  icon: React.ElementType;
}

// ── Registry: add new views here ─────────────────────────────────────────────
const VIEWS: ViewDef[] = [
  { id: 'breakdown',   label: 'Breakdown',   icon: LayoutGrid },
  { id: 'noticeboard', label: 'Noticeboard', icon: ClipboardList },
];

interface Props {
  filteredTransactions: Transaction[];
  stats: Stats;
  dateFilterMode: DateFilterMode;
  dateRange: { fromDate: string; toDate: string };
  orgConfig: NoticeboardConfig;
  theme: Theme;
}

export default function AnalyticsPanel({
  filteredTransactions,
  stats,
  dateFilterMode,
  dateRange,
  orgConfig,
  theme,
}: Props) {
  const [activeView, setActiveView] = useState<ViewId>('breakdown');

  const sharedProps = { filteredTransactions, stats, dateFilterMode, dateRange, orgConfig, theme };

  return (
    <div>
      {/* Tab pill bar */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-gray-100 dark:bg-slate-900/70 rounded-xl w-fit border border-gray-200 dark:border-slate-800 no-print">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`analytics-tab-${id}`}
            onClick={() => setActiveView(id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 whitespace-nowrap
              ${activeView === id
                ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-slate-700'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Active view */}
      <div className="analytics-view-enter">
        {activeView === 'breakdown'   && <CategoryBreakdownView {...sharedProps} />}
        {activeView === 'noticeboard' && <NoticeboardView       {...sharedProps} />}
      </div>
    </div>
  );
}

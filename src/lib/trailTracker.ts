/**
 * trailTracker.ts — Granular page / action trail for audit log.
 *
 * Stores a list of short acronyms in sessionStorage.
 * Any component can import `trackAction()` to record what the user did.
 *
 * Acronym → Full name mapping lives here AND in OAAudit.tsx (for display).
 */

const TRAIL_KEY = '__kc_trail';

// ── Acronym registry ─────────────────────────────────────────────────────────
// Page-level
//   AT  = All Transactions     NT  = New Transaction (form)
//   R   = Reports              A   = Admin
//   AM  = Admin › Members      AR  = Admin › Requests
//   AL  = Audit Log            AS  = Admin › Settings
//
// Action-level (granular)
//   ET  = Edit Transaction     DT  = Delete Transaction
//   ST  = Save Transaction (create or update)
//   EX  = Export CSV           FR  = Filter/Search Applied
//   VD  = View Details (expanded a row)
//   ER  = Export Report

export const PAGE_META: Record<string, { short: string; long: string }> = {
  // Pages
  'transactions:view': { short: 'AT',  long: 'All Transactions' },
  'transactions:add':  { short: 'NT',  long: 'New Transaction' },
  'reports':           { short: 'R',   long: 'Reports' },
  'admin':             { short: 'A',   long: 'Admin' },
  'admin:members':     { short: 'AM',  long: 'Admin › Members' },
  'admin:requests':    { short: 'AR',  long: 'Admin › Requests' },
  'admin:audit':       { short: 'AL',  long: 'Audit Log' },
  'admin:settings':    { short: 'AS',  long: 'Admin › Settings' },
  // Actions
  'action:edit-txn':   { short: 'ET',  long: 'Edit Transaction' },
  'action:delete-txn': { short: 'DT',  long: 'Delete Transaction' },
  'action:save-txn':   { short: 'ST',  long: 'Save Transaction' },
  'action:export-csv': { short: 'EX',  long: 'Export CSV' },
  'action:filter':     { short: 'FR',  long: 'Filter / Search' },
  'action:view-detail':{ short: 'VD',  long: 'View Details' },
  'action:export-report':{ short:'ER', long: 'Export Report' },
};

/** Append an acronym to the trail. Accepts a page key (e.g. 'transactions:view')
 *  or an action key (e.g. 'action:edit-txn'). */
export function trackAction(key: string) {
  try {
    const meta = PAGE_META[key];
    const code = meta?.short ?? key;
    const raw = sessionStorage.getItem(TRAIL_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    // Avoid duplicate consecutive entries
    if (arr[arr.length - 1] !== code) arr.push(code);
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(arr));
  } catch { /* non-fatal */ }
}

/** Get the full trail as a dash-separated string (for POST to server). */
export function getTrail(): string {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return arr.join(' - ');
  } catch {
    return '';
  }
}

/** Clear the trail (on sign-out). */
export function clearTrail() {
  try { sessionStorage.removeItem(TRAIL_KEY); } catch { /* non-fatal */ }
}

/** POST the current trail to the server (updates latest login entry). */
export async function postTrailToServer(getToken: () => Promise<string | null>) {
  const trail = getTrail();
  if (!trail) return;
  const token = await getToken();
  if (!token) return;
  await fetch('/api/org-admin?action=heartbeat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pageTrail: trail }),
  });
}

/**
 * trailTracker.ts — Granular page / action trail & session lifecycle tracker for audit log.
 *
 * Manages unique sessions via sessionStorage so page refreshes stay in the SAME session
 * without generating ghost user_login entries.
 */

const TRAIL_KEY   = '__kc_trail';
const SESSION_KEY = '__kc_session_id';

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

export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `sess_${Date.now()}`;
  }
}

/** Initialize a session if not already active in sessionStorage.
 *  Only logs a new user_login entry when a BRAND NEW session is created. */
export async function ensureSession(getToken: () => Promise<string | null>, initialKey = 'transactions:view') {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem(SESSION_KEY, sid);

      const meta = PAGE_META[initialKey];
      const initialCode = meta?.short ?? initialKey;
      sessionStorage.setItem(TRAIL_KEY, JSON.stringify([initialCode]));

      const token = await getToken();
      if (token) {
        await fetch('/api/org-admin?action=session-start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId: sid, initialTrail: initialCode }),
        });
      }
    } else {
      trackAction(initialKey);
    }
  } catch { /* non-fatal */ }
}

export function trackAction(key: string) {
  try {
    const meta = PAGE_META[key];
    const code = meta?.short ?? key;
    const raw = sessionStorage.getItem(TRAIL_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (arr[arr.length - 1] !== code) arr.push(code);
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(arr));
  } catch { /* non-fatal */ }
}

export function getTrail(): string {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return arr.join(' - ');
  } catch {
    return '';
  }
}

export function clearTrail() {
  try {
    sessionStorage.removeItem(TRAIL_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* non-fatal */ }
}

export async function postTrailToServer(getToken: () => Promise<string | null>) {
  const trail = getTrail();
  if (!trail) return;
  const token = await getToken();
  if (!token) return;
  const sid = getSessionId();
  await fetch('/api/org-admin?action=heartbeat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId: sid, pageTrail: trail }),
  });
}

export async function postSessionEndToServer(getToken: () => Promise<string | null>) {
  const trail = getTrail();
  const token = await getToken();
  if (!token) return;
  const sid = getSessionId();
  await fetch('/api/org-admin?action=session-end', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId: sid, pageTrail: trail }),
  });
  clearTrail();
}

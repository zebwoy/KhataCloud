/**
 * trailTracker.ts — Granular page / action trail & session lifecycle tracker for audit log.
 *
 * Guarantees every sign-in produces a UNIQUE session GUID. When a user signs out,
 * the session is closed and marked ended. Re-logging in forces a new GUID session.
 */

const TRAIL_KEY   = '__kc_trail';
const SESSION_KEY = '__kc_session_id';
const USER_ID_KEY = '__kc_user_id';
const ENDED_KEY   = '__kc_session_ended';

let activeGetToken: (() => Promise<string | null>) | null = null;
let postDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
  'action:edit-txn':     { short: 'ET',  long: 'Edit Transaction' },
  'action:delete-txn':   { short: 'DT',  long: 'Delete Transaction' },
  'action:save-txn':     { short: 'ST',  long: 'Save Transaction' },
  'action:export-csv':   { short: 'EXT', long: 'Export Transactions' },
  'action:filter':       { short: 'FR',  long: 'Filter / Search' },
  'action:view-detail':  { short: 'VD',  long: 'View Details' },
  'action:export-report':{ short: 'EXR', long: 'Export Report' },
  'action:print-report': { short: 'PR',  long: 'Print Report' },
};

/** Generate a unique GUID for each session. */
export function generateSessionId(): string {
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `sess_${Date.now()}_${randomPart}`;
}

export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `sess_${Date.now()}`;
  }
}

/** Initialize a unique session for this sign-in.
 *  If previous session was ended or user changed, forces a brand-new GUID. */
export async function ensureSession(
  getToken: () => Promise<string | null>,
  pageKey = 'transactions:view',
  userId?: string,
  userName?: string,
  userEmail?: string
) {
  activeGetToken = getToken;
  try {
    const isEnded = sessionStorage.getItem(ENDED_KEY) === 'true';
    const storedUser = sessionStorage.getItem(USER_ID_KEY);

    // If session was previously ended (logged out), or user changed, wipe old state
    if (isEnded || !storedUser || (userId && storedUser !== userId)) {
      clearTrail();
    }

    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sessionStorage.removeItem(ENDED_KEY);
      sid = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, sid);
      if (userId) sessionStorage.setItem(USER_ID_KEY, userId);

      const meta = PAGE_META[pageKey];
      const initialCode = meta?.short ?? pageKey;
      sessionStorage.setItem(TRAIL_KEY, JSON.stringify([initialCode]));

      const token = await getToken();
      if (token) {
        await fetch('/api/org-admin?action=session-start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionId: sid,
            initialTrail: initialCode,
            userName,
            userEmail,
          }),
        });
      }
    } else {
      if (userId) sessionStorage.setItem(USER_ID_KEY, userId);
      trackAction(pageKey);
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

    // Debounced instant persistence to server (300ms)
    if (activeGetToken) {
      if (postDebounceTimer) clearTimeout(postDebounceTimer);
      postDebounceTimer = setTimeout(() => {
        if (activeGetToken) postTrailToServer(activeGetToken);
      }, 300);
    }
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
    if (postDebounceTimer) clearTimeout(postDebounceTimer);
    sessionStorage.removeItem(TRAIL_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(USER_ID_KEY);
    sessionStorage.setItem(ENDED_KEY, 'true');
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
  if (postDebounceTimer) clearTimeout(postDebounceTimer);
  const trail = getTrail();
  const token = await getToken();
  const sid = getSessionId();
  if (token && sid) {
    await fetch('/api/org-admin?action=session-end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId: sid, pageTrail: trail }),
    });
  }
  clearTrail();
}

/**
 * featureFlags.ts — Vercel Edge Config feature flag helper
 *
 * Setup:
 *   1. Vercel Dashboard → Storage → Edge Config → Create store
 *   2. Add env var EDGE_CONFIG to Vercel project settings
 *   3. Add flags as JSON keys in Edge Config dashboard
 *
 * Flag schema example (set in Vercel Edge Config dashboard):
 * {
 *   "enableFinancialReports": true,
 *   "enableCsvExport": true,
 *   "enableSuperAdmin": true,
 *   "maintenanceMode": false,
 *   "maxOrgsPerDay": 10
 * }
 *
 * Flags are read-cached client-side for performance.
 * Changing a flag in Vercel dashboard takes effect globally in seconds (no redeploy).
 */

// Cache flags in module scope to avoid repeated edge calls per component render
let flagCache: Record<string, unknown> | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadFlags(): Promise<Record<string, unknown>> {
  if (flagCache && Date.now() < cacheExpiry) return flagCache;

  try {
    // Edge Config is only available server-side in Vercel Functions.
    // On the client (browser), we fetch a lightweight API endpoint that proxies the flag.
    // For now, we use a simple fetch to a dedicated flags endpoint.
    // You can add /api/flags.ts later if you want server-side flag resolution.
    const edgeConfigUrl = import.meta.env.VITE_EDGE_CONFIG_URL;
    if (!edgeConfigUrl) {
      // Fallback: all features enabled (dev mode / no config set)
      return getDefaultFlags();
    }

    const response = await fetch(edgeConfigUrl);
    if (!response.ok) throw new Error('Edge Config unavailable');

    flagCache = await response.json();
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return flagCache!;
  } catch {
    // Fail open — don't block the app if flags are unavailable
    return getDefaultFlags();
  }
}

function getDefaultFlags(): Record<string, unknown> {
  return {
    enableFinancialReports: true,
    enableCsvExport: true,
    enableSuperAdmin: true,
    maintenanceMode: false,
  };
}

/**
 * Get a boolean feature flag.
 * Returns true if the flag is not set (fail-open default).
 */
export async function getFlag(key: string, defaultValue = true): Promise<boolean> {
  const flags = await loadFlags();
  const val = flags[key];
  if (val === undefined) return defaultValue;
  return Boolean(val);
}

/**
 * Get any feature flag value (string, number, boolean, object).
 */
export async function getFlagValue<T = unknown>(key: string, defaultValue: T): Promise<T> {
  const flags = await loadFlags();
  const val = flags[key];
  return val !== undefined ? (val as T) : defaultValue;
}

/** Invalidate the local cache (call after admin updates flags) */
export function invalidateFlagCache(): void {
  flagCache = null;
  cacheExpiry = 0;
}

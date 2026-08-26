/**
 * api/org-config.ts — Noticeboard / CMS config per org
 *
 * GET  /api/org-config   → returns the org's noticeboard config JSON (defaults if missing)
 * PUT  /api/org-config   → upserts the org's noticeboard config (org:admin only)
 *
 * Config shape (stored as JSONB under key 'noticeboard'):
 * {
 *   publicMessage:      string | null,
 *   donationLink:       string | null,
 *   hiddenSubcategories: string[],
 * }
 */
import { Client } from 'pg';
import { getAuthContext } from '../lib/authHelper.js';
import { setCors } from '../lib/vercel-handler.js';
import type { VercelReq, VercelRes } from '../lib/vercel-handler.js';

const CONFIG_KEY = 'noticeboard';

export interface NoticeboardConfig {
  publicMessage: string | null;
  donationLink: string | null;
  hiddenSubcategories: string[];
  customIncomeSubcats: string[] | null;   // null = use defaults from constants.ts
  customExpenseSubcats: string[] | null;  // null = use defaults from constants.ts
}

const DEFAULT_CONFIG: NoticeboardConfig = {
  publicMessage: null,
  donationLink: null,
  hiddenSubcategories: [],
  customIncomeSubcats: null,
  customExpenseSubcats: null,
};

const getConnectionString = () =>
  process.env.DATABASE_URL ||
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T extends Record<string, unknown>>(
  query: string,
  params: unknown[] = []
) => {
  const cs = getConnectionString();
  if (!cs) throw new Error('Database connection string is not configured.');
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    return await client.query<T>(query, params);
  } finally {
    await client.end();
  }
};

/** Ensure org_config table exists (auto-heal for orgs that haven't run migration 007). */
async function ensureTable(): Promise<void> {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS org_config (
      org_slug    VARCHAR(100) NOT NULL,
      config_key  VARCHAR(100) NOT NULL DEFAULT 'noticeboard',
      config_json JSONB        NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (org_slug, config_key)
    )
  `);
}

export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const { userType, orgSlug, orgRole } = auth;

    // Determine which org this request is for
    let slug: string | null = null;
    if (userType === 'org_member' && orgSlug) {
      slug = orgSlug;
    } else if (userType === 'trial') {
      slug = 'trial';
    } else if (userType === 'super_admin') {
      // Super admins reading their own config — gracefully return defaults
      return res.status(200).json(DEFAULT_CONFIG);
    }

    if (!slug) {
      return res.status(403).json({ message: 'No organisation context.' });
    }

    await ensureTable();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const result = await runQuery<{ config_json: NoticeboardConfig }>(
        `SELECT config_json FROM org_config WHERE org_slug = $1 AND config_key = $2 LIMIT 1`,
        [slug, CONFIG_KEY]
      );
      const config: NoticeboardConfig = result.rows[0]?.config_json ?? DEFAULT_CONFIG;
      // Ensure shape is always complete (merge defaults for forward compatibility)
      return res.status(200).json({ ...DEFAULT_CONFIG, ...config });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      // Only org:admin may write config; trial mode writes are silently accepted
      if (userType === 'org_member' && orgRole !== 'org:admin') {
        return res.status(403).json({ message: 'Only org admins can update config.' });
      }

      const body = req.body as Partial<NoticeboardConfig>;

      // Validate and sanitise
      const publicMessage   = typeof body.publicMessage === 'string' ? body.publicMessage.trim() || null : null;
      const donationLink    = typeof body.donationLink  === 'string' ? body.donationLink.trim()  || null : null;
      const hiddenSubcats   = Array.isArray(body.hiddenSubcategories)
        ? body.hiddenSubcategories.filter((s): s is string => typeof s === 'string')
        : [];
      const customIncomeSubcats  = Array.isArray(body.customIncomeSubcats)
        ? body.customIncomeSubcats.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
        : null;
      const customExpenseSubcats = Array.isArray(body.customExpenseSubcats)
        ? body.customExpenseSubcats.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
        : null;

      // Basic URL validation for donationLink
      if (donationLink) {
        try { new URL(donationLink); } catch {
          return res.status(400).json({ error: 'donationLink must be a valid URL.' });
        }
      }

      const newConfig: NoticeboardConfig = {
        publicMessage,
        donationLink,
        hiddenSubcategories: hiddenSubcats,
        customIncomeSubcats,
        customExpenseSubcats,
      };

      await runQuery(
        `INSERT INTO org_config (org_slug, config_key, config_json, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (org_slug, config_key)
         DO UPDATE SET config_json = $3::jsonb, updated_at = NOW()`,
        [slug, CONFIG_KEY, JSON.stringify(newConfig)]
      );

      return res.status(200).json(newConfig);
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[org-config] Error:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

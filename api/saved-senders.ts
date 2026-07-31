/**
 * api/saved-senders.ts — Saved counterparty autocomplete store
 *
 * GET    /api/saved-senders           → list all senders
 * POST   /api/saved-senders           → upsert a sender
 * DELETE /api/saved-senders?sender=x  → delete a sender
 *
 * Auth: Bearer token — legacy trial JWT or Clerk org_member JWT
 * Table routing:
 *   trial      → public.trial_saved_senders
 *   org_member → org_{slug}.saved_senders
 *   admin      → public.saved_senders
 */
import { Client } from 'pg';
import { getAuthContext } from '../lib/authHelper.js';
import { setCors, qp } from '../lib/vercel-handler.js';
import type { VercelReq, VercelRes } from '../lib/vercel-handler.js';

const getConnectionString = () =>
  process.env.DATABASE_URL ||
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T = unknown>(
  query: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> => {
  const client = new Client({ connectionString: getConnectionString() });
  try {
    await client.connect();
    return await client.query<T>(query, params);
  } finally {
    await client.end();
  }
};

export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { userType } = auth;
    const tableName =
      userType === 'trial'
        ? 'trial_saved_senders'
        : userType === 'org_member' && auth.orgSlug
          ? `org_${auth.orgSlug.replace(/-/g, '_')}.saved_senders`
          : 'saved_senders';

    // ── GET ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      try {
        const result = await runQuery<{ sender: string }>(
          `SELECT DISTINCT sender FROM ${tableName} ORDER BY sender ASC`
        );
        return res.status(200).json(result.rows.map(r => r.sender));
      } catch {
        // Table doesn't exist yet — return empty (will be created on first POST)
        return res.status(200).json([]);
      }
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { sender } = req.body ?? {};
      if (!sender || typeof sender !== 'string' || !sender.trim()) {
        return res.status(400).json({ error: 'sender must be a non-empty string.' });
      }
      const trimmed = sender.trim();

      // Create table if needed, then upsert
      await runQuery(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id         SERIAL PRIMARY KEY,
          sender     VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runQuery(
        `INSERT INTO ${tableName} (sender) VALUES ($1) ON CONFLICT (sender) DO NOTHING`,
        [trimmed]
      );
      return res.status(201).json({ message: 'Sender saved.', sender: trimmed });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const sender = qp(req.query, 'sender');
      if (!sender) return res.status(400).json({ error: 'sender query param is required.' });

      try {
        await runQuery(`DELETE FROM ${tableName} WHERE sender = $1`, [sender.trim()]);
      } catch {
        // Table doesn't exist — nothing to delete, that's fine
      }
      return res.status(200).json({ message: 'Sender deleted.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}

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
import { Client, QueryResultRow } from 'pg';
import { getAuthContext } from '../lib/authHelper.js';
import { setCors, qp } from '../lib/vercel-handler.js';
import type { VercelReq, VercelRes } from '../lib/vercel-handler.js';

const getConnectionString = () =>
  process.env.DATABASE_URL ||
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T extends QueryResultRow = any>(
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

    // Auto-heal table and sender_type column
    try {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id          SERIAL PRIMARY KEY,
          sender      VARCHAR(255) UNIQUE NOT NULL,
          sender_type VARCHAR(50) DEFAULT 'general',
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runQuery(`
        ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) DEFAULT 'general'
      `);
    } catch {
      // Non-fatal if schema permissions or table in creation
    }

    // ── GET ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const type = qp(req.query, 'type');
      try {
        let query = `SELECT DISTINCT sender FROM ${tableName}`;
        const params: unknown[] = [];
        if (type) {
          query += ` WHERE sender_type = $1`;
          params.push(type.trim());
        }
        query += ` ORDER BY sender ASC`;
        const result = await runQuery<{ sender: string }>(query, params);
        return res.status(200).json(result.rows.map(r => r.sender));
      } catch {
        // Table doesn't exist yet — return empty
        return res.status(200).json([]);
      }
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { sender, type } = req.body ?? {};
      if (!sender || typeof sender !== 'string' || !sender.trim()) {
        return res.status(400).json({ error: 'sender must be a non-empty string.' });
      }
      const trimmed = sender.trim();
      const senderType = (typeof type === 'string' && type.trim()) ? type.trim() : 'general';

      await runQuery(
        `INSERT INTO ${tableName} (sender, sender_type) 
         VALUES ($1, $2) 
         ON CONFLICT (sender) DO UPDATE SET sender_type = EXCLUDED.sender_type`,
        [trimmed, senderType]
      );
      return res.status(201).json({ message: 'Sender saved.', sender: trimmed, type: senderType });
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

/**
 * api/transactions.ts — CRUD for financial transactions
 *
 * GET    /api/transactions              → list transactions (date-filtered)
 * POST   /api/transactions              → create transaction
 * PUT    /api/transactions              → edit transaction (soft-delete + re-insert)
 * DELETE /api/transactions?id=<id>     → soft-delete transaction
 *
 * Auth: Bearer token — legacy trial JWT or Clerk org_member/super_admin JWT
 * Table routing:
 *   trial      → public.trial_transactions
 *   org_member → org_{slug}.transactions
 *   admin      → public.transactions
 *   super_admin→ public.transactions   (read-only by convention)
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

const runQuery = async <T extends QueryResultRow>(
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

export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const { userType } = auth;

    const getTableName = (): string => {
      if (userType === 'trial') return 'trial_transactions';
      if (userType === 'org_member' && auth.orgSlug)
        return `org_${auth.orgSlug.replace(/-/g, '_')}.transactions`;
      return 'transactions'; // admin + super_admin → public schema
    };
    const tableName = getTableName();

    // Ensure trial_transactions table exists on first access
    if (userType === 'trial') {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS trial_transactions (
          id            SERIAL PRIMARY KEY,
          date          DATE          NOT NULL,
          category      VARCHAR(20)   NOT NULL CHECK (category IN ('Income','Expense','Transfer')),
          subcategory   VARCHAR(100),
          sender        VARCHAR(255),
          receiver      VARCHAR(255),
          custodian     VARCHAR(255),
          counterparty  VARCHAR(255),
          remarks       TEXT,
          amount        DECIMAL(15,2) NOT NULL,
          created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          ModifiedDate  TIMESTAMP,
          IsDeleted     CHAR(1)       DEFAULT 'N'
        );
      `);
    }

    // ── GET ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const fromDate = qp(req.query, 'fromDate');
      const toDate   = qp(req.query, 'toDate');
      const filters: string[] = [];
      const params: unknown[] = [];

      if (fromDate) { params.push(fromDate); filters.push(`date >= $${params.length}`); }
      if (toDate)   { params.push(toDate);   filters.push(`date <= $${params.length}`); }

      const softDelete  = `(IsDeleted IS NULL OR IsDeleted != 'Y')`;
      const whereClause = filters.length
        ? `WHERE ${softDelete} AND ${filters.join(' AND ')}`
        : `WHERE ${softDelete}`;

      const result = await runQuery(
        `SELECT id, date, category, subcategory, sender, receiver,
                COALESCE(custodian, receiver)    AS custodian,
                COALESCE(counterparty, sender)   AS counterparty,
                remarks, amount, created_at, ModifiedDate AS modifieddate
         FROM ${tableName}
         ${whereClause}
         ORDER BY date DESC, created_at DESC`,
        params
      );
      return res.status(200).json(result.rows);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const payload = req.body;
      if (!payload) return res.status(400).json({ error: 'Request body is required.' });

      const required = ['date', 'category', 'custodian', 'counterparty', 'amount', 'remarks'];
      for (const f of required) {
        if (!payload[f]) return res.status(400).json({ error: `${f} is required.` });
      }
      if (payload.category !== 'Transfer' && !payload.subcategory)
        return res.status(400).json({ error: 'subcategory is required for Income/Expense.' });

      const sender: string   = payload.counterparty;
      const receiver: string = payload.custodian;

      const result = await runQuery(
        `INSERT INTO ${tableName}
           (date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, IsDeleted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'N')
         RETURNING id, date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, created_at`,
        [payload.date, payload.category, payload.subcategory || null,
         sender, receiver, payload.custodian, payload.counterparty,
         payload.remarks, payload.amount]
      );
      return res.status(201).json(result.rows[0]);
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const payload = req.body;
      if (!payload) return res.status(400).json({ error: 'Request body is required.' });

      const { id, modifiedDate, ...txData } = payload;
      if (!id) return res.status(400).json({ error: 'Transaction id is required for editing.' });

      const required = ['date', 'category', 'custodian', 'counterparty', 'amount'];
      for (const f of required) {
        if (!txData[f]) return res.status(400).json({ error: `${f} is required.` });
      }
      if (txData.category !== 'Transfer' && !txData.subcategory)
        return res.status(400).json({ error: 'subcategory is required for Income/Expense.' });
      if (!txData.remarks) txData.remarks = '';

      const sender: string   = txData.counterparty;
      const receiver: string = txData.custodian;
      const ts = modifiedDate || new Date().toISOString().replace('T', ' ').replace('Z', '');

      const cs = getConnectionString();
      if (!cs) return res.status(500).json({ error: 'Database not configured.' });

      const client = new Client({ connectionString: cs });
      try {
        await client.connect();
        await client.query('BEGIN');

        await client.query(
          `UPDATE ${tableName} SET IsDeleted='Y'
           WHERE id=$1 AND (IsDeleted IS NULL OR IsDeleted != 'Y')`,
          [Number(id)]
        );

        const insertResult = await client.query(
          `INSERT INTO ${tableName}
             (date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, ModifiedDate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamp)
           RETURNING id, date, category, subcategory, sender, receiver, custodian, counterparty,
                     remarks, amount, created_at, ModifiedDate AS modifieddate`,
          [txData.date, txData.category, txData.subcategory || null,
           sender, receiver, txData.custodian, txData.counterparty,
           txData.remarks, txData.amount, ts]
        );

        await client.query('COMMIT');
        return res.status(200).json(insertResult.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        await client.end();
      }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = qp(req.query, 'id');
      if (!id) return res.status(400).json({ error: 'Transaction id is required.' });

      await runQuery(
        `UPDATE ${tableName} SET IsDeleted='Y'
         WHERE id=$1 AND (IsDeleted IS NULL OR IsDeleted != 'Y')`,
        [Number(id)]
      );
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}

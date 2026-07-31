/**
 * api/entities.ts — Read org entities (trustees, donors, vendors)
 *
 * GET /api/entities?entityType=trustee|counterparty|donor|vendor|other
 *
 * Auth: Bearer token — legacy trial JWT or Clerk org_member JWT
 * Table routing:
 *   trial      → public.entities    (IsTrial='Y')
 *   org_member → org_{slug}.entities
 *   admin      → public.entities    (IsTrial='N')
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

interface Entity {
  id: number;
  entity_name: string;
  entity_type: 'trustee' | 'donor' | 'vendor' | 'other';
  IsDeleted: string;
  ModifiedDate: string | null;
  IsTrial: string;
  created_at: string;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { userType } = auth;
    const isTrial    = userType === 'trial' ? 'Y' : 'N';
    const entityTable = userType === 'org_member' && auth.orgSlug
      ? `org_${auth.orgSlug.replace(/-/g, '_')}.entities`
      : 'entities';

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const entityType = qp(req.query, 'entityType');

    let query = `
      SELECT id, entity_name, entity_type, IsDeleted, ModifiedDate, IsTrial, created_at
      FROM ${entityTable}
      WHERE IsDeleted = 'N' AND IsTrial = $1
    `;
    const params: unknown[] = [isTrial];

    if (entityType) {
      if (entityType === 'trustee' || entityType === 'receiver') {
        // Trustees (new and legacy type names)
        query += ` AND entity_type IN ('trustee','receiver')`;
      } else if (entityType === 'counterparty' || entityType === 'sender') {
        // All non-trustee entities
        query += ` AND entity_type NOT IN ('trustee','receiver')`;
      } else if (['donor', 'vendor', 'other'].includes(entityType)) {
        params.push(entityType);
        query += ` AND entity_type = $${params.length}`;
      }
    }

    query += ` ORDER BY entity_name ASC`;

    const cs = getConnectionString();
    if (!cs) return res.status(500).json({ error: 'Database not configured.' });

    const client = new Client({ connectionString: cs });
    try {
      await client.connect();
      const result = await client.query<Entity>(query, params);
      return res.status(200).json(result.rows);
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('Error fetching entities:', err);
    return res.status(500).json({ error: 'Failed to fetch entities' });
  }
}

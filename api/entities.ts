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

/** Module-level cache: confirmed-provisioned slugs in this Vercel instance */
const confirmedProvisioned = new Set<string>();

async function ensureOrgSchema(orgSlug: string, client: Client): Promise<void> {
  if (confirmedProvisioned.has(orgSlug)) return;
  const safeSlug = orgSlug.replace(/-/g, '_');
  const check = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = 'entities' LIMIT 1`,
    [`org_${safeSlug}`]
  );
  if ((check.rowCount ?? 0) === 0) {
    await client.query(`SELECT platform.provision_org_schema($1)`, [orgSlug]);
    console.info(`[entities] Auto-provisioned schema for org: ${orgSlug}`);
  }
  confirmedProvisioned.add(orgSlug);
}

export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { userType } = auth;

    // Reject no_org — prevents querying public.entities which doesn't exist on SaaS DB
    if (userType === 'no_org') {
      return res.status(403).json({
        error: 'No organisation assigned. Please contact your administrator.',
      });
    }
    if (userType === 'org_member' && !auth.orgSlug) {
      return res.status(403).json({
        error: 'Org schema not linked. Please ask a super-admin to complete org setup.',
      });
    }

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
      // Ensure org schema tables exist on first access (auto-heals failed migrations)
      if (userType === 'org_member' && auth.orgSlug) {
        await ensureOrgSchema(auth.orgSlug, client);
      }
      const result = await client.query<Entity>(query, params);
      return res.status(200).json(result.rows);
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('Error fetching entities:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

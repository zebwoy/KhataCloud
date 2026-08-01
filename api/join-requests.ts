/**
 * api/join-requests.ts — User-facing join request API
 *
 * Accessible by any authenticated Clerk user (org status doesn't matter).
 *
 * Routes:
 *   GET  ?action=orgs      → list orgs accepting requests (for selection screen)
 *   GET  ?action=my        → user's own request status
 *   POST ?action=submit    → submit a join request (body: { orgId })
 *   DELETE ?action=cancel  → cancel own pending request
 */
import { Client } from 'pg';
import { createClerkClient } from '@clerk/backend';
import { getAuthContext } from '../lib/authHelper.js';
import { setCors, qp } from '../lib/vercel-handler.js';
import type { VercelReq, VercelRes } from '../lib/vercel-handler.js';

const getCS = () =>
  process.env.DATABASE_URL ||
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  '';

type SubResult = { statusCode: number; body: string };
const ok  = (d: unknown, c = 200): SubResult => ({ statusCode: c, body: JSON.stringify(d) });
const err = (m: string,  c = 400): SubResult => ({ statusCode: c, body: JSON.stringify({ error: m }) });

/**
 * Verify the Clerk JWT manually to extract userId without needing full org context.
 * Handles the 'no_org' case where getAuthContext normally returns { userType: 'no_org' }.
 */
async function resolveUserId(req: VercelReq): Promise<string | null> {
  const ctx = await getAuthContext(req);
  return ctx?.userId ?? null;
}

// ─── GET orgs (public list for selection screen) ─────────────────────────────
async function getOrgs(client: Client): Promise<SubResult> {
  const r = await client.query(
    `SELECT id, name, slug FROM platform.orgs
     WHERE status='approved' AND schema_provisioned=TRUE AND accepting_requests=TRUE
     ORDER BY name ASC`
  );
  return ok(r.rows);
}

// ─── GET my request ──────────────────────────────────────────────────────────
async function getMyRequest(userId: string, client: Client): Promise<SubResult> {
  const r = await client.query(
    `SELECT jr.id, jr.status, jr.requested_at, jr.reviewed_at,
            o.name AS org_name, o.slug AS org_slug
     FROM platform.join_requests jr
     JOIN platform.orgs o ON o.id = jr.org_id
     WHERE jr.user_id = $1 AND jr.status = 'pending'
     ORDER BY jr.requested_at DESC LIMIT 1`,
    [userId]
  );
  return ok(r.rows[0] ?? null);
}

// ─── POST submit ─────────────────────────────────────────────────────────────
async function submitRequest(userId: string, req: VercelReq, client: Client): Promise<SubResult> {
  const { orgId, message } = req.body ?? {};
  if (!orgId) return err('orgId required');

  // Ensure the org exists and is accepting requests
  const org = await client.query<{ name: string; accepting_requests: boolean }>(
    `SELECT name, accepting_requests FROM platform.orgs
     WHERE id=$1 AND status='approved' AND schema_provisioned=TRUE LIMIT 1`,
    [orgId]
  );
  if (!org.rows.length) return err('Organisation not found or not approved', 404);
  if (!org.rows[0].accepting_requests)
    return err('This organisation is not currently accepting requests', 403);

  // Cancel any previously cancelled/rejected request for this org so user can re-apply
  await client.query(
    `DELETE FROM platform.join_requests
     WHERE user_id=$1 AND org_id=$2 AND status IN ('cancelled', 'rejected')`,
    [userId, orgId]
  );

  const r = await client.query<{ id: string }>(
    `INSERT INTO platform.join_requests (user_id, org_id, message)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, org_id) DO NOTHING
     RETURNING id`,
    [userId, orgId, message ?? null]
  );

  if (!r.rowCount) return err('You already have a pending request for this organisation', 409);

  return ok({
    success: true,
    requestId: r.rows[0].id,
    orgName: org.rows[0].name,
    message: 'Request submitted. Awaiting admin approval.',
  }, 201);
}

// ─── DELETE cancel ───────────────────────────────────────────────────────────
async function cancelRequest(userId: string, client: Client): Promise<SubResult> {
  const upd = await client.query(
    `UPDATE platform.join_requests
     SET status='cancelled', reviewed_at=NOW()
     WHERE user_id=$1 AND status='pending'
     RETURNING id`,
    [userId]
  );
  if (!upd.rowCount) return err('No pending request to cancel', 404);
  return ok({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = qp(req.query, 'action');
  if (!action) return res.status(400).json({ error: 'Missing ?action=' });

  const client = new Client({ connectionString: getCS() });
  try {
    await client.connect();

    // Public action — no auth required
    if (action === 'orgs') {
      const result = await getOrgs(client);
      return res.status(result.statusCode).send(result.body);
    }

    // All other actions require authentication
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });

    let result: SubResult;
    switch (action) {
      case 'my':     result = await getMyRequest(userId, client); break;
      case 'submit': result = await submitRequest(userId, req, client); break;
      case 'cancel': result = await cancelRequest(userId, client); break;
      default:       result = { statusCode: 400, body: JSON.stringify({ error: `Unknown action '${action}'` }) };
    }

    return res.status(result.statusCode).send(result.body);
  } catch (e: any) {
    console.error('[api/join-requests]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    await client.end();
  }
}

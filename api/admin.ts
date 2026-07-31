/**
 * api/admin.ts — Single consolidated admin API endpoint
 *
 * Consolidates: orgs, super-admin-stats, provision-user, register-org, whoami
 * (Vercel Hobby plan: max 12 serverless functions — consolidation keeps us under limit)
 *
 * Routes (via ?action= query param):
 *   GET  /api/admin?action=whoami           → caller's role + orgSlug (used by RootApp)
 *   GET  /api/admin?action=stats            → super admin analytics       [super_admin]
 *   GET  /api/admin?action=orgs             → list all orgs               [super_admin]
 *   GET  /api/admin?action=orgs&id=<uuid>   → single org detail           [super_admin]
 *   PUT  /api/admin?action=orgs             → approve/reject/suspend org  [super_admin]
 *   POST /api/admin?action=provision        → create Clerk user + link    [super_admin]
 *   GET  /api/admin?action=register&slug=x  → check slug availability     [any]
 *   POST /api/admin?action=register         → register new org            [authenticated]
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
  process.env.NETLIFY_DB_URL ||
  '';

const SLUG_REGEX = /^[a-z0-9][a-z0-9\-]{2,48}[a-z0-9]$/;

/** Internal sub-handler result type (converted to Vercel response by main handler) */
type SubResult = { statusCode: number; body: string };

const ok  = (data: unknown, code = 200): SubResult =>
  ({ statusCode: code, body: JSON.stringify(data) });
const err = (msg: string,  code = 400): SubResult =>
  ({ statusCode: code, body: JSON.stringify({ error: msg }) });

// ─────────────────────────────────────────────────────────────────────────────
// Whoami — returns caller's role for RootApp RBAC routing
// ─────────────────────────────────────────────────────────────────────────────
function handleWhoami(authCtx: any): SubResult {
  if (!authCtx) return err('Unauthenticated', 401);
  return ok({
    userType: authCtx.userType,
    orgSlug:  authCtx.orgSlug  ?? null,
    userId:   authCtx.userId   ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats handler
// ─────────────────────────────────────────────────────────────────────────────
async function handleStats(authCtx: any, client: Client): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin') return err('Forbidden', 403);

  const orgStatsResult = await client.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::int AS count FROM platform.orgs GROUP BY status`
  );
  const orgCounts = { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 };
  for (const row of orgStatsResult.rows) {
    const c = parseInt(row.count);
    (orgCounts as any)[row.status] = c;
    orgCounts.total += c;
  }

  const [totalM, weekM] = await Promise.all([
    client.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM platform.org_members`),
    client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM platform.org_members WHERE joined_at >= NOW() - INTERVAL '7 days'`
    ),
  ]);

  let authUserCount = 0;
  let recentAuthUsers: any[] = [];
  try {
    const [countRes, recentRes] = await Promise.all([
      client.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM "user"`),
      client.query(`SELECT id, name, email, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 5`),
    ]);
    authUserCount  = parseInt(countRes.rows[0]?.count ?? '0');
    recentAuthUsers = recentRes.rows;
  } catch {
    authUserCount = parseInt(totalM.rows[0]?.count ?? '0');
  }

  const [recentOrgs, pendingOrgs] = await Promise.all([
    client.query(`
      SELECT o.id, o.name, o.slug, o.status, o.plan,
             o.created_at, o.approved_at, o.contact_email,
             COUNT(m.id)::int AS member_count
      FROM platform.orgs o LEFT JOIN platform.org_members m ON m.org_id = o.id
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 8
    `),
    client.query(`
      SELECT o.id, o.name, o.slug, o.contact_email, o.created_at,
             COUNT(m.id)::int AS member_count
      FROM platform.orgs o LEFT JOIN platform.org_members m ON m.org_id = o.id
      WHERE o.status = 'pending' GROUP BY o.id ORDER BY o.created_at ASC
    `),
  ]);

  return ok({
    orgs:     orgCounts,
    members:  { total: parseInt(totalM.rows[0]?.count ?? '0'), thisWeek: parseInt(weekM.rows[0]?.count ?? '0') },
    users:    { total: authUserCount },
    recentOrgs:      recentOrgs.rows,
    pendingOrgs:     pendingOrgs.rows,
    recentAuthUsers,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Orgs handler — list, get, approve/reject/suspend
// ─────────────────────────────────────────────────────────────────────────────
async function handleOrgs(authCtx: any, req: VercelReq, client: Client): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin')
    return err('Forbidden — super-admin only', 403);

  if (req.method === 'GET') {
    const orgId = qp(req.query, 'id');
    if (orgId) {
      const r = await client.query(
        `SELECT o.*, COUNT(m.id)::int AS member_count, sa.email AS approved_by_email
         FROM platform.orgs o
         LEFT JOIN platform.org_members m ON m.org_id = o.id
         LEFT JOIN platform.super_admins sa ON sa.user_id = o.approved_by
         WHERE o.id = $1 GROUP BY o.id, sa.email`,
        [orgId]
      );
      return ok(r.rows[0] ?? null);
    }

    const r = await client.query(`
      SELECT o.id, o.name, o.slug, o.status, o.plan, o.schema_provisioned,
             o.contact_email, o.notes, o.created_at, o.approved_at, o.owner_user_id,
             COUNT(m.id)::int AS member_count
      FROM platform.orgs o LEFT JOIN platform.org_members m ON m.org_id = o.id
      GROUP BY o.id
      ORDER BY CASE o.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, o.created_at DESC
    `);
    return ok(r.rows);
  }

  if (req.method === 'PUT') {
    const body = req.body;
    if (!body) return err('Body required');
    const { id, action, notes } = body as {
      id: string; action: 'approve' | 'reject' | 'suspend'; notes?: string;
    };
    if (!id || !['approve', 'reject', 'suspend'].includes(action))
      return err('id and valid action required');

    const statusMap: Record<string, string> = {
      approve: 'approved', reject: 'rejected', suspend: 'suspended',
    };

    await client.query('BEGIN');
    const upd = await client.query<{ slug: string; schema_provisioned: boolean }>(
      `UPDATE platform.orgs SET status=$1,
         approved_at = CASE WHEN $1='approved' THEN NOW() ELSE approved_at END,
         approved_by = CASE WHEN $1='approved' THEN $2  ELSE approved_by  END,
         notes = COALESCE($3, notes)
       WHERE id=$4 RETURNING slug, schema_provisioned`,
      [statusMap[action], authCtx.userId, notes ?? null, id]
    );
    if (!upd.rows.length) {
      await client.query('ROLLBACK');
      return err('Org not found', 404);
    }
    if (action === 'approve' && !upd.rows[0].schema_provisioned) {
      await client.query(`SELECT platform.provision_org_schema($1)`, [upd.rows[0].slug]);
    }
    await client.query('COMMIT');

    const refreshed = await client.query(
      `SELECT o.*, COUNT(m.id)::int AS member_count FROM platform.orgs o
       LEFT JOIN platform.org_members m ON m.org_id = o.id WHERE o.id=$1 GROUP BY o.id`,
      [id]
    );
    return ok(refreshed.rows[0]);
  }

  return err('Method Not Allowed', 405);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provision user — create Clerk user + link to org
// ─────────────────────────────────────────────────────────────────────────────
async function handleProvision(authCtx: any, req: VercelReq, client: Client): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin')
    return err('Forbidden — super-admin only', 403);

  const body = req.body;
  if (!body) return err('Body required');

  const { name, email, password, orgSlug, role = 'member' } = body;
  if (!name?.trim() || !email?.trim() || !password || !orgSlug)
    return err('name, email, password, orgSlug required');
  if (password.length < 8)
    return err('Password must be ≥ 8 characters');

  const orgResult = await client.query<{ id: string }>(
    `SELECT id FROM platform.orgs WHERE slug=$1 AND status='approved' AND schema_provisioned=TRUE LIMIT 1`,
    [orgSlug]
  );
  if (!orgResult.rows.length)
    return err(`Org '${orgSlug}' not found or not approved`, 404);

  const orgId = orgResult.rows[0].id;

  // Create user in Clerk via admin API
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || '' });
  let userId: string;
  try {
    const nameParts = name.trim().split(' ');
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email.trim().toLowerCase()],
      password,
      firstName:    nameParts[0],
      lastName:     nameParts.slice(1).join(' ') || undefined,
      skipPasswordChecks: false,
    });
    userId = clerkUser.id;
  } catch (e: any) {
    const msg = String(e?.errors?.[0]?.message ?? e?.message ?? e);
    if (/already exists|duplicate|form_identifier_exists/i.test(msg))
      return err(`User '${email}' already exists in Clerk`, 409);
    throw e;
  }

  await client.query(
    `INSERT INTO platform.org_members (org_id, user_id, role)
     VALUES ($1,$2,$3) ON CONFLICT (org_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
    [orgId, userId, role]
  );

  return ok({
    success: true, userId, email, name, orgSlug, role,
    message: `User '${name}' provisioned in Clerk and linked to '${orgSlug}'.`,
  }, 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// Register org — slug check (public) + org registration (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
async function handleRegister(authCtx: any, req: VercelReq, client: Client): Promise<SubResult> {
  // GET: slug availability check (public — no auth required)
  if (req.method === 'GET') {
    const slug = qp(req.query, 'slug');
    if (!slug || !SLUG_REGEX.test(slug))
      return err('Invalid slug format. Use lowercase letters, numbers, and hyphens (4–50 chars).');
    const r = await client.query(`SELECT 1 FROM platform.orgs WHERE slug=$1 LIMIT 1`, [slug]);
    return ok({ available: r.rowCount === 0 });
  }

  if (req.method !== 'POST') return err('Method Not Allowed', 405);

  if (!authCtx || authCtx.userType === 'trial')
    return err('Sign in required to register an organisation', 401);

  const body = req.body;
  if (!body) return err('Body required');

  const { name, slug, contactEmail } = body as {
    name: string; slug: string; contactEmail?: string;
  };
  if (!name?.trim() || name.trim().length < 3)
    return err('Organisation name must be ≥ 3 characters');
  if (!slug || !SLUG_REGEX.test(slug))
    return err('Invalid slug format');

  await client.query('BEGIN');

  const slugCheck = await client.query(
    `SELECT 1 FROM platform.orgs WHERE slug=$1 LIMIT 1`, [slug]
  );
  if (slugCheck.rowCount && slugCheck.rowCount > 0) {
    await client.query('ROLLBACK');
    return err('Slug already taken', 409);
  }

  const existingOrg = await client.query(
    `SELECT o.name, o.status FROM platform.orgs o WHERE o.owner_user_id=$1 LIMIT 1`,
    [authCtx.userId]
  );
  if (existingOrg.rows.length > 0) {
    await client.query('ROLLBACK');
    const { name: eName, status } = existingOrg.rows[0];
    return err(`You already have an org (${eName}, status: ${status})`, 409);
  }

  const orgResult = await client.query<{ id: string }>(
    `INSERT INTO platform.orgs (name, slug, owner_user_id, status, plan, contact_email)
     VALUES ($1,$2,$3,'pending','free',$4) RETURNING id`,
    [name.trim(), slug, authCtx.userId, contactEmail ?? null]
  );
  await client.query(
    `INSERT INTO platform.org_members (org_id, user_id, role)
     VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,
    [orgResult.rows[0].id, authCtx.userId]
  );
  await client.query('COMMIT');

  return ok({
    id: orgResult.rows[0].id, name: name.trim(), slug, status: 'pending',
    message: 'Organisation registered and pending admin approval.',
  }, 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = qp(req.query, 'action');
  if (!action) return res.status(400).json({ error: 'Missing ?action= parameter' });

  const client = new Client({ connectionString: getCS() });

  try {
    await client.connect();
    const authCtx = await getAuthContext(req);

    let result: SubResult;
    switch (action) {
      case 'whoami':   result = handleWhoami(authCtx); break;
      case 'stats':    result = await handleStats(authCtx, client); break;
      case 'orgs':     result = await handleOrgs(authCtx, req, client); break;
      case 'provision':result = await handleProvision(authCtx, req, client); break;
      case 'register': result = await handleRegister(authCtx, req, client); break;
      default:
        result = { statusCode: 400, body: JSON.stringify({ error: `Unknown action '${action}'` }) };
    }

    return res.status(result.statusCode).send(result.body);
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[api/admin]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    await client.end();
  }
}

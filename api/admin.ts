/**
 * admin.ts — Single consolidated admin API endpoint
 *
 * Replaces: api/orgs.ts, api/super-admin-stats.ts,
 *           api/provision-user.ts, api/register-org.ts
 *
 * Reason: Vercel Hobby plan allows max 12 serverless functions.
 * Consolidating 4 files → 1 keeps us well under the limit.
 *
 * Routes (via ?action= query param):
 *   GET  /api/admin?action=stats           → super admin analytics
 *   GET  /api/admin?action=orgs            → list all orgs        [super_admin]
 *   GET  /api/admin?action=orgs&id=<uuid>  → single org detail    [super_admin]
 *   PUT  /api/admin?action=orgs            → approve/reject/suspend org [super_admin]
 *   POST /api/admin?action=provision       → create Better Auth user + link to org [super_admin]
 *   GET  /api/admin?action=register&slug=x → check slug availability [any]
 *   POST /api/admin?action=register        → register new org [authenticated]
 */
import { Handler } from '@netlify/functions';
import { Client } from 'pg';
import { getAuthContext } from '../lib/authHelper.js';
import { auth } from '../lib/betterAuth.js';
import { vercelWrapper } from '../lib/vercelWrapper.js';

const getCS = () =>
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  '';

const cors = {
  'Access-Control-Allow-Origin': process.env.BETTER_AUTH_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

const SLUG_REGEX = /^[a-z0-9][a-z0-9\-]{2,48}[a-z0-9]$/;

// ─────────────────────────────────────────────────────────────────────────────
// Stats handler (was super-admin-stats.ts)
// ─────────────────────────────────────────────────────────────────────────────
async function handleStats(authCtx: any, client: Client) {
  if (!authCtx || authCtx.userType !== 'super_admin') {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Forbidden' }) };
  }

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

  let authUserCount = 0, recentAuthUsers: any[] = [];
  try {
    const [countRes, recentRes] = await Promise.all([
      client.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM "user"`),
      client.query(`SELECT id, name, email, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 5`),
    ]);
    authUserCount = parseInt(countRes.rows[0]?.count ?? '0');
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

  return {
    statusCode: 200, headers: cors,
    body: JSON.stringify({
      orgs: orgCounts,
      members: { total: parseInt(totalM.rows[0]?.count ?? '0'), thisWeek: parseInt(weekM.rows[0]?.count ?? '0') },
      users: { total: authUserCount },
      recentOrgs: recentOrgs.rows,
      pendingOrgs: pendingOrgs.rows,
      recentAuthUsers,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orgs handler (was orgs.ts)
// ─────────────────────────────────────────────────────────────────────────────
async function handleOrgs(authCtx: any, event: any, client: Client) {
  if (!authCtx || authCtx.userType !== 'super_admin') {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Forbidden — super-admin only' }) };
  }

  if (event.httpMethod === 'GET') {
    const orgId = event.queryStringParameters?.id;
    if (orgId) {
      const r = await client.query(
        `SELECT o.*, COUNT(m.id)::int AS member_count, sa.email AS approved_by_email
         FROM platform.orgs o
         LEFT JOIN platform.org_members m ON m.org_id = o.id
         LEFT JOIN platform.super_admins sa ON sa.user_id = o.approved_by
         WHERE o.id = $1 GROUP BY o.id, sa.email`,
        [orgId]
      );
      return { statusCode: 200, headers: cors, body: JSON.stringify(r.rows[0] ?? null) };
    }

    const r = await client.query(`
      SELECT o.id, o.name, o.slug, o.status, o.plan, o.schema_provisioned,
             o.contact_email, o.notes, o.created_at, o.approved_at, o.owner_user_id,
             COUNT(m.id)::int AS member_count
      FROM platform.orgs o LEFT JOIN platform.org_members m ON m.org_id = o.id
      GROUP BY o.id
      ORDER BY CASE o.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, o.created_at DESC
    `);
    return { statusCode: 200, headers: cors, body: JSON.stringify(r.rows) };
  }

  if (event.httpMethod === 'PUT') {
    if (!event.body) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Body required' }) };
    const { id, action, notes } = JSON.parse(event.body) as { id: string; action: 'approve' | 'reject' | 'suspend'; notes?: string };
    if (!id || !['approve', 'reject', 'suspend'].includes(action)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'id and valid action required' }) };
    }

    const statusMap: Record<string, string> = { approve: 'approved', reject: 'rejected', suspend: 'suspended' };

    await client.query('BEGIN');
    const upd = await client.query<{ slug: string; schema_provisioned: boolean }>(
      `UPDATE platform.orgs SET status=$1,
         approved_at = CASE WHEN $1='approved' THEN NOW() ELSE approved_at END,
         approved_by = CASE WHEN $1='approved' THEN $2 ELSE approved_by END,
         notes = COALESCE($3, notes)
       WHERE id=$4 RETURNING slug, schema_provisioned`,
      [statusMap[action], authCtx.userId, notes ?? null, id]
    );
    if (!upd.rows.length) {
      await client.query('ROLLBACK');
      return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Org not found' }) };
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
    return { statusCode: 200, headers: cors, body: JSON.stringify(refreshed.rows[0]) };
  }

  return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provision user handler (was provision-user.ts)
// ─────────────────────────────────────────────────────────────────────────────
async function handleProvision(authCtx: any, event: any, client: Client) {
  if (!authCtx || authCtx.userType !== 'super_admin') {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Forbidden — super-admin only' }) };
  }
  if (!event.body) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Body required' }) };

  const { name, email, password, orgSlug, role = 'member' } = JSON.parse(event.body);
  if (!name?.trim() || !email?.trim() || !password || !orgSlug) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'name, email, password, orgSlug required' }) };
  }
  if (password.length < 8) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Password must be ≥ 8 characters' }) };
  }

  const orgResult = await client.query<{ id: string }>(
    `SELECT id FROM platform.orgs WHERE slug=$1 AND status='approved' AND schema_provisioned=TRUE LIMIT 1`,
    [orgSlug]
  );
  if (!orgResult.rows.length) {
    return { statusCode: 404, headers: cors, body: JSON.stringify({ error: `Org '${orgSlug}' not found or not approved` }) };
  }
  const orgId = orgResult.rows[0].id;

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { name: name.trim(), email: email.trim().toLowerCase(), password },
      asResponse: false,
    });
    userId = (result as any)?.user?.id;
    if (!userId) throw new Error('No user ID returned from Better Auth');
  } catch (signUpErr: any) {
    if (/already exists|duplicate|unique/i.test(String(signUpErr?.message ?? signUpErr))) {
      return { statusCode: 409, headers: cors, body: JSON.stringify({ error: `User '${email}' already exists` }) };
    }
    throw signUpErr;
  }

  await client.query(
    `INSERT INTO platform.org_members (org_id, user_id, role)
     VALUES ($1,$2,$3) ON CONFLICT (org_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
    [orgId, userId, role]
  );

  return {
    statusCode: 201, headers: cors,
    body: JSON.stringify({ success: true, userId, email, name, orgSlug, role,
      message: `User '${name}' provisioned and linked to '${orgSlug}'. They can sign in immediately.` }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Register org handler (was register-org.ts)
// ─────────────────────────────────────────────────────────────────────────────
async function handleRegister(authCtx: any, event: any, client: Client) {
  // GET: slug availability check (public)
  if (event.httpMethod === 'GET') {
    const slug = event.queryStringParameters?.slug;
    if (!slug || !SLUG_REGEX.test(slug)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ available: false, error: 'Invalid slug' }) };
    }
    const r = await client.query(`SELECT 1 FROM platform.orgs WHERE slug=$1 LIMIT 1`, [slug]);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ available: r.rowCount === 0 }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  if (!authCtx || authCtx.userType === 'trial') {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Sign in required' }) };
  }
  if (!event.body) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Body required' }) };

  const { name, slug, contactEmail } = JSON.parse(event.body) as { name: string; slug: string; contactEmail?: string };
  if (!name?.trim() || name.trim().length < 3) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Name must be ≥ 3 characters' }) };
  }
  if (!slug || !SLUG_REGEX.test(slug)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid slug format' }) };
  }

  await client.query('BEGIN');
  const slugCheck = await client.query(`SELECT 1 FROM platform.orgs WHERE slug=$1 LIMIT 1`, [slug]);
  if (slugCheck.rowCount && slugCheck.rowCount > 0) {
    await client.query('ROLLBACK');
    return { statusCode: 409, headers: cors, body: JSON.stringify({ error: 'Slug already taken' }) };
  }

  const existingOrg = await client.query(
    `SELECT o.name, o.status FROM platform.orgs o WHERE o.owner_user_id=$1 LIMIT 1`,
    [authCtx.userId]
  );
  if (existingOrg.rows.length > 0) {
    await client.query('ROLLBACK');
    return { statusCode: 409, headers: cors, body: JSON.stringify({
      error: `You already have an org (${existingOrg.rows[0].name}, status: ${existingOrg.rows[0].status})`
    }) };
  }

  const orgResult = await client.query<{ id: string }>(
    `INSERT INTO platform.orgs (name, slug, owner_user_id, status, plan, contact_email)
     VALUES ($1,$2,$3,'pending','free',$4) RETURNING id`,
    [name.trim(), slug, authCtx.userId, contactEmail ?? null]
  );
  await client.query(
    `INSERT INTO platform.org_members (org_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,
    [orgResult.rows[0].id, authCtx.userId]
  );
  await client.query('COMMIT');

  return {
    statusCode: 201, headers: cors,
    body: JSON.stringify({ id: orgResult.rows[0].id, name: name.trim(), slug, status: 'pending',
      message: 'Organisation registered and pending admin approval.' }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const action = event.queryStringParameters?.action;
  if (!action) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing ?action= parameter' }) };

  const client = new Client({ connectionString: getCS() });

  try {
    await client.connect();

    // register and slug-check are called before auth for GET
    const authCtx = await getAuthContext(event);

    switch (action) {
      case 'stats':    return await handleStats(authCtx, client);
      case 'orgs':     return await handleOrgs(authCtx, event, client);
      case 'provision': return await handleProvision(authCtx, event, client);
      case 'register': return await handleRegister(authCtx, event, client);
      default:
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `Unknown action '${action}'` }) };
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[api/admin]', error);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: error.message }) };
  } finally {
    await client.end();
  }
};

export default vercelWrapper(handler);

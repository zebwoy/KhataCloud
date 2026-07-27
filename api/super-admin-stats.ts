/**
 * super-admin-stats.ts — Dashboard analytics for the super admin SPA
 *
 * GET /api/super-admin-stats
 * Auth: super_admin only
 *
 * Returns:
 *   - Org counts by status
 *   - Member counts (total + this week)
 *   - Auth user count (from Better Auth user table)
 *   - Recent org registrations
 *   - Recent member joins
 *   - Pending approvals list (for quick-action in dashboard)
 */
import { Handler } from '@netlify/functions';
import { Client } from 'pg';
import { getAuthContext } from './utils/authHelper.js';
import { vercelWrapper } from './utils/vercelWrapper.js';

const getConnectionString = () =>
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  '';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.BETTER_AUTH_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const authCtx = await getAuthContext(event);
  if (!authCtx || authCtx.userType !== 'super_admin') {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const client = new Client({ connectionString: getConnectionString() });

  try {
    await client.connect();

    // Org counts by status
    const orgStatsResult = await client.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::int AS count FROM platform.orgs GROUP BY status`
    );
    const orgCounts = { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 };
    for (const row of orgStatsResult.rows) {
      const c = parseInt(row.count);
      (orgCounts as any)[row.status] = c;
      orgCounts.total += c;
    }

    // Total members + new this week
    const [totalMembersResult, weekMembersResult] = await Promise.all([
      client.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM platform.org_members`
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM platform.org_members
         WHERE joined_at >= NOW() - INTERVAL '7 days'`
      ),
    ]);

    // Auth users (Better Auth "user" table — fail gracefully if not yet initialised)
    let authUserCount = 0;
    let recentAuthUsers: any[] = [];
    try {
      const [countRes, recentRes] = await Promise.all([
        client.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM "user"`),
        client.query(
          `SELECT id, name, email, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 5`
        ),
      ]);
      authUserCount = parseInt(countRes.rows[0]?.count ?? '0');
      recentAuthUsers = recentRes.rows;
    } catch {
      // Tables not initialised yet — fall back to platform.org_members count
      authUserCount = parseInt(totalMembersResult.rows[0]?.count ?? '0');
    }

    // Recent org registrations (last 8)
    const recentOrgsResult = await client.query(`
      SELECT o.id, o.name, o.slug, o.status, o.plan,
             o.created_at, o.approved_at, o.contact_email,
             COUNT(m.id)::int AS member_count
      FROM platform.orgs o
      LEFT JOIN platform.org_members m ON m.org_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 8
    `);

    // Pending approvals specifically (for dashboard quick-action)
    const pendingResult = await client.query(`
      SELECT o.id, o.name, o.slug, o.contact_email, o.created_at,
             COUNT(m.id)::int AS member_count
      FROM platform.orgs o
      LEFT JOIN platform.org_members m ON m.org_id = o.id
      WHERE o.status = 'pending'
      GROUP BY o.id
      ORDER BY o.created_at ASC
    `);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        orgs: orgCounts,
        members: {
          total: parseInt(totalMembersResult.rows[0]?.count ?? '0'),
          thisWeek: parseInt(weekMembersResult.rows[0]?.count ?? '0'),
        },
        users: {
          total: authUserCount,
        },
        recentOrgs: recentOrgsResult.rows,
        pendingOrgs: pendingResult.rows,
        recentAuthUsers,
      }),
    };
  } catch (error: any) {
    console.error('[api/super-admin-stats]', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await client.end();
  }
};

export default vercelWrapper(handler);

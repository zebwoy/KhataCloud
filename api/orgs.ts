/**
 * orgs.ts — Super-admin API for org management
 *
 * Routes (all require super_admin auth context):
 *   GET    /api/orgs              → list all orgs with member counts
 *   GET    /api/orgs?id=<uuid>    → single org detail
 *   PUT    /api/orgs              → update org status (approve/reject/suspend)
 *
 * Body for PUT: { id: string, action: 'approve' | 'reject' | 'suspend', notes?: string }
 *
 * On 'approve': if schema not yet provisioned, calls platform.provision_org_schema()
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
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Only super_admin can access this endpoint
  const auth = await getAuthContext(event);
  if (!auth || auth.userType !== 'super_admin') {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Forbidden — super-admin access only' }),
    };
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Database not configured' }),
    };
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // ── GET: List all orgs ──────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const orgId = event.queryStringParameters?.id;

      if (orgId) {
        // Single org detail
        const result = await client.query(
          `SELECT o.*,
                  COUNT(m.id)::int AS member_count,
                  sa.email AS approved_by_email
           FROM platform.orgs o
           LEFT JOIN platform.org_members m ON m.org_id = o.id
           LEFT JOIN platform.super_admins sa ON sa.user_id = o.approved_by
           WHERE o.id = $1
           GROUP BY o.id, sa.email`,
          [orgId]
        );
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0] ?? null),
        };
      }

      // All orgs with member counts + recent user info
      const result = await client.query(`
        SELECT
          o.id,
          o.name,
          o.slug,
          o.status,
          o.plan,
          o.schema_provisioned,
          o.contact_email,
          o.notes,
          o.created_at,
          o.approved_at,
          o.owner_user_id,
          COUNT(m.id)::int AS member_count
        FROM platform.orgs o
        LEFT JOIN platform.org_members m ON m.org_id = o.id
        GROUP BY o.id
        ORDER BY
          CASE o.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
          o.created_at DESC
      `);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows),
      };
    }

    // ── PUT: Update org status ──────────────────────────────────
    if (event.httpMethod === 'PUT') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body required' }),
        };
      }

      const payload = JSON.parse(event.body);
      const { id, action, notes } = payload as {
        id: string;
        action: 'approve' | 'reject' | 'suspend';
        notes?: string;
      };

      if (!id || !['approve', 'reject', 'suspend'].includes(action)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'id and valid action (approve/reject/suspend) required' }),
        };
      }

      const statusMap: Record<string, string> = {
        approve: 'approved',
        reject: 'rejected',
        suspend: 'suspended',
      };

      await client.query('BEGIN');

      // Update org status
      const updateResult = await client.query<{ slug: string; schema_provisioned: boolean }>(
        `UPDATE platform.orgs
         SET status = $1,
             approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
             approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE approved_by END,
             notes = COALESCE($3, notes)
         WHERE id = $4
         RETURNING slug, schema_provisioned`,
        [statusMap[action], auth.userId, notes ?? null, id]
      );

      if (!updateResult.rows.length) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Org not found' }),
        };
      }

      // On approval: provision schema if not yet done
      if (action === 'approve' && !updateResult.rows[0].schema_provisioned) {
        const { slug } = updateResult.rows[0];
        await client.query(`SELECT platform.provision_org_schema($1)`, [slug]);
      }

      await client.query('COMMIT');

      // Return updated org
      const refreshed = await client.query(
        `SELECT o.*, COUNT(m.id)::int AS member_count
         FROM platform.orgs o
         LEFT JOIN platform.org_members m ON m.org_id = o.id
         WHERE o.id = $1 GROUP BY o.id`,
        [id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(refreshed.rows[0]),
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[api/orgs]', error);
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

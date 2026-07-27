/**
 * provision-user.ts — Super-admin creates org member accounts server-side
 *
 * POST /api/provision-user
 * Body: { name, email, password, orgSlug, role? }
 * Auth: super_admin session required
 *
 * Creates a Better Auth user + password credential without any email verification.
 * Then links the user to the specified org in platform.org_members.
 * The user can immediately sign in with the provided credentials.
 */
import { Handler } from '@netlify/functions';
import { Client } from 'pg';
import { getAuthContext } from './utils/authHelper.js';
import { auth } from './utils/betterAuth.js';
import { vercelWrapper } from './utils/vercelWrapper.js';

const getConnectionString = () =>
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  '';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.BETTER_AUTH_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  const authCtx = await getAuthContext(event);
  if (!authCtx || authCtx.userType !== 'super_admin') {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Forbidden — super-admin access only' }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body required' }),
    };
  }

  const { name, email, password, orgSlug, role = 'member' } = JSON.parse(event.body) as {
    name: string;
    email: string;
    password: string;
    orgSlug: string;
    role?: string;
  };

  if (!name?.trim() || !email?.trim() || !password || !orgSlug) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'name, email, password and orgSlug are all required' }),
    };
  }
  if (password.length < 8) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Password must be at least 8 characters' }),
    };
  }

  const client = new Client({ connectionString: getConnectionString() });

  try {
    await client.connect();

    // Verify org is approved and provisioned
    const orgResult = await client.query<{ id: string }>(
      `SELECT id FROM platform.orgs
       WHERE slug = $1 AND status = 'approved' AND schema_provisioned = TRUE
       LIMIT 1`,
      [orgSlug]
    );

    if (!orgResult.rows.length) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `Org '${orgSlug}' not found, not approved, or schema not provisioned`,
        }),
      };
    }

    const orgId = orgResult.rows[0].id;

    // Create Better Auth user + password credential server-side
    let userId: string;
    try {
      const result = await auth.api.signUpEmail({
        body: { name: name.trim(), email: email.trim().toLowerCase(), password },
        asResponse: false,
      });
      // Better Auth returns { user, session } or throws on error
      userId = (result as any)?.user?.id;
      if (!userId) throw new Error('Better Auth did not return a user ID');
    } catch (signUpErr: any) {
      const msg = String(signUpErr?.message ?? signUpErr);
      if (/already exists|duplicate|unique/i.test(msg)) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `A user with email '${email}' already exists. If they belong to a different org, use "re-assign" instead.`,
          }),
        };
      }
      throw signUpErr;
    }

    // Link user to org (upsert — safe to call again if already linked)
    await client.query(
      `INSERT INTO platform.org_members (org_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [orgId, userId, role]
    );

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        userId,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        orgSlug,
        role,
        message: `User '${name}' provisioned and linked to '${orgSlug}'. They can sign in immediately.`,
      }),
    };
  } catch (error: any) {
    console.error('[api/provision-user]', error);
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

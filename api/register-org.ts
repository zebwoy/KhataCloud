/**
 * register-org.ts — Org creation endpoint (called after successful sign-up)
 *
 * POST /api/register-org
 * Body: { name: string, slug: string, contactEmail?: string }
 * Auth: requires valid Better Auth session
 *
 * Creates a platform.orgs row with status='pending' and platform.org_members row.
 * Does NOT provision the schema — that happens on super-admin approval.
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
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

// Validate slug: lowercase letters, numbers, hyphens, 4–50 chars
const SLUG_REGEX = /^[a-z0-9][a-z0-9\-]{2,48}[a-z0-9]$/;

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // GET: Check if a slug is available
  if (event.httpMethod === 'GET') {
    const slug = event.queryStringParameters?.slug;
    if (!slug || !SLUG_REGEX.test(slug)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ available: false, error: 'Invalid slug format' }),
      };
    }
    const client = new Client({ connectionString: getConnectionString() });
    try {
      await client.connect();
      const result = await client.query(
        `SELECT 1 FROM platform.orgs WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ available: result.rowCount === 0 }),
      };
    } finally {
      await client.end();
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  // Must be authenticated (Better Auth session)
  const auth = await getAuthContext(event);
  if (!auth || auth.userType === 'trial') {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'You must be signed in to register an organisation' }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body required' }),
    };
  }

  const payload = JSON.parse(event.body);
  const { name, slug, contactEmail } = payload as {
    name: string;
    slug: string;
    contactEmail?: string;
  };

  // Validate inputs
  if (!name?.trim() || name.trim().length < 3) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Organisation name must be at least 3 characters' }),
    };
  }
  if (!slug || !SLUG_REGEX.test(slug)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Slug must be 4–50 characters: lowercase letters, numbers, hyphens only',
      }),
    };
  }

  const client = new Client({ connectionString: getConnectionString() });

  try {
    await client.connect();
    await client.query('BEGIN');

    // Check slug uniqueness
    const slugCheck = await client.query(
      `SELECT 1 FROM platform.orgs WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    if (slugCheck.rowCount && slugCheck.rowCount > 0) {
      await client.query('ROLLBACK');
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'This organisation ID is already taken. Please choose another.' }),
      };
    }

    // Check if user already owns an org (one org per user for now)
    const existingOrg = await client.query(
      `SELECT o.name, o.status FROM platform.orgs o
       WHERE o.owner_user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (existingOrg.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `You already have an organisation (${existingOrg.rows[0].name}, status: ${existingOrg.rows[0].status})`,
        }),
      };
    }

    // Create org record
    const orgResult = await client.query<{ id: string }>(
      `INSERT INTO platform.orgs (name, slug, owner_user_id, status, plan, contact_email)
       VALUES ($1, $2, $3, 'pending', 'free', $4)
       RETURNING id`,
      [name.trim(), slug, auth.userId, contactEmail ?? null]
    );
    const orgId = orgResult.rows[0].id;

    // Add creator as owner member
    await client.query(
      `INSERT INTO platform.org_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [orgId, auth.userId]
    );

    await client.query('COMMIT');

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        id: orgId,
        name: name.trim(),
        slug,
        status: 'pending',
        message: 'Your organisation has been registered and is pending admin approval. You will be notified once approved.',
      }),
    };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[api/register-org]', error);
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

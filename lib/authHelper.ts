/**
 * lib/authHelper.ts — Dual-stack auth context resolver
 * Lives outside api/ so Vercel does not count it as a serverless function.
 */
import { HandlerEvent } from '@netlify/functions';
import { verifyJwt } from './jwt.js';
import { Client } from 'pg';

export interface AuthContext {
  userType: 'admin' | 'trial' | 'org_member' | 'super_admin';
  orgSlug?: string;
  userId?: string;
}

const getPooledConnectionString = () =>
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  '';

async function resolveOrgContext(
  userId: string
): Promise<{ orgSlug: string | null; isSuperAdmin: boolean }> {
  const connectionString = getPooledConnectionString();
  if (!connectionString) return { orgSlug: null, isSuperAdmin: false };

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const saResult = await client.query(
      `SELECT 1 FROM platform.super_admins WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (saResult.rowCount && saResult.rowCount > 0) return { orgSlug: null, isSuperAdmin: true };

    const memberResult = await client.query<{ slug: string }>(
      `SELECT o.slug FROM platform.org_members m
       JOIN platform.orgs o ON o.id = m.org_id
       WHERE m.user_id = $1 AND o.status = 'approved' AND o.schema_provisioned = TRUE
       LIMIT 1`,
      [userId]
    );
    return { orgSlug: memberResult.rows[0]?.slug ?? null, isSuperAdmin: false };
  } finally {
    await client.end();
  }
}

export async function getAuthContext(event: HandlerEvent): Promise<AuthContext | null> {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const payload = verifyJwt(parts[1]);
      if (payload?.userType) return { userType: payload.userType as 'admin' | 'trial' };
    }
  }

  const cookieHeader = event.headers['cookie'] || event.headers['Cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
    if (match) {
      try {
        const { auth } = await import('./betterAuth.js');
        const fakeRequest = new Request(
          `${process.env.BETTER_AUTH_URL || 'https://app.local'}/api/auth-better/get-session`,
          { headers: { cookie: cookieHeader } }
        );
        const sessionResult = await auth.api.getSession({ headers: fakeRequest.headers });
        if (sessionResult?.user?.id) {
          const userId = sessionResult.user.id;
          const { orgSlug, isSuperAdmin } = await resolveOrgContext(userId);
          if (isSuperAdmin) return { userType: 'super_admin', userId };
          if (orgSlug) return { userType: 'org_member', orgSlug, userId };
          return null;
        }
      } catch (err) {
        console.error('[authHelper] session verification failed:', err);
      }
    }
  }
  return null;
}

export function getAuthContextSync(event: HandlerEvent): Pick<AuthContext, 'userType'> | null {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  const payload = verifyJwt(parts[1]);
  if (!payload?.userType) return null;
  return { userType: payload.userType as 'admin' | 'trial' };
}

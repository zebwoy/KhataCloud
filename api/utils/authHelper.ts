/**
 * authHelper.ts — Dual-stack auth context resolver
 *
 * Resolution order:
 *   1. Authorization: Bearer <jwt>  → old SHA-256/HS256 path (admin / trial) [UNCHANGED]
 *   2. better-auth.session_token cookie → Better Auth session (org_member / super_admin) [NEW]
 *
 * All existing API handlers using getAuthContext() continue to work with
 * no changes — they just get a richer AuthContext when the user is an org member.
 */
import { HandlerEvent } from '@netlify/functions';
import { verifyJwt } from './jwt.js';
import { Client } from 'pg';

export interface AuthContext {
  /** User category — determines which table/schema to query */
  userType: 'admin' | 'trial' | 'org_member' | 'super_admin';
  /** For org_member: the org's slug (e.g. 'millat-qlc') → schema = org_millat_qlc */
  orgSlug?: string;
  /** Better Auth user ID (undefined for old JWT users) */
  userId?: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const getPooledConnectionString = () =>
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  '';

/** Resolves org slug + super-admin status from the platform schema for a given user ID */
async function resolveOrgContext(
  userId: string
): Promise<{ orgSlug: string | null; isSuperAdmin: boolean }> {
  const connectionString = getPooledConnectionString();
  if (!connectionString) return { orgSlug: null, isSuperAdmin: false };

  const client = new Client({ connectionString });
  try {
    await client.connect();

    // Check super_admin first (fastest gate)
    const saResult = await client.query(
      `SELECT 1 FROM platform.super_admins WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (saResult.rowCount && saResult.rowCount > 0) {
      return { orgSlug: null, isSuperAdmin: true };
    }

    // Check org membership
    const memberResult = await client.query<{ slug: string }>(
      `SELECT o.slug
       FROM platform.org_members m
       JOIN platform.orgs o ON o.id = m.org_id
       WHERE m.user_id = $1
         AND o.status = 'approved'
         AND o.schema_provisioned = TRUE
       LIMIT 1`,
      [userId]
    );
    const orgSlug = memberResult.rows[0]?.slug ?? null;
    return { orgSlug, isSuperAdmin: false };
  } finally {
    await client.end();
  }
}

// ----------------------------------------------------------------
// Main export — used by all API handlers
// ----------------------------------------------------------------

export async function getAuthContext(event: HandlerEvent): Promise<AuthContext | null> {
  // ── Path 1: Old JWT (Bearer token) ────────────────────────────
  const authHeader =
    event.headers['authorization'] || event.headers['Authorization'];

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const payload = verifyJwt(parts[1]);
      if (payload && payload.userType) {
        // Legacy tokens: userType is 'admin' or 'trial'
        return { userType: payload.userType as 'admin' | 'trial' };
      }
    }
  }

  // ── Path 2: Better Auth session cookie ────────────────────────
  const cookieHeader = event.headers['cookie'] || event.headers['Cookie'];
  if (cookieHeader) {
    // Extract the Better Auth session token from cookie string
    const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
    if (match) {
      try {
        // Dynamically import to avoid loading Better Auth on every cold start
        // when the request uses the old JWT path (which is more common currently)
        const { auth } = await import('./betterAuth.js');

        // Build a minimal Request for Better Auth session verification
        const fakeRequest = new Request(
          `${process.env.BETTER_AUTH_URL || 'https://app.local'}/api/auth-better/get-session`,
          {
            headers: { cookie: cookieHeader },
          }
        );
        const sessionResult = await auth.api.getSession({ headers: fakeRequest.headers });

        if (sessionResult?.user?.id) {
          const userId = sessionResult.user.id;
          const { orgSlug, isSuperAdmin } = await resolveOrgContext(userId);

          if (isSuperAdmin) {
            return { userType: 'super_admin', userId };
          }
          if (orgSlug) {
            return { userType: 'org_member', orgSlug, userId };
          }
          // Authenticated but no approved org yet (pending approval)
          return null;
        }
      } catch (err) {
        console.error('[authHelper] Better Auth session verification failed:', err);
      }
    }
  }

  return null;
}

// ── Synchronous variant for backward compatibility ─────────────
// Some handlers call getAuthContext synchronously. This shim handles
// them — it only supports the old JWT path (which is synchronous).
// Handlers that need org_member support must use the async version.
export function getAuthContextSync(event: HandlerEvent): Pick<AuthContext, 'userType'> | null {
  const authHeader =
    event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  const payload = verifyJwt(parts[1]);
  if (!payload || !payload.userType) return null;

  return { userType: payload.userType as 'admin' | 'trial' };
}

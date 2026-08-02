/**
 * lib/authHelper.ts — Dual-stack auth context resolver
 *
 * Resolution order:
 *   1. Bearer token → try legacy SHA-256 JWT  (trial mode)
 *   2. Bearer token → try Clerk JWT
 *      a. super_admin? → check platform.super_admins
 *      b. In a Clerk org? → resolve slug from JWT claim (fast) or DB (fallback)
 *      c. No org in JWT → return { userType: 'no_org', userId }
 *   3. Neither → return null (unauthenticated)
 *
 * NOTE: org:admin vs org:member is determined by `orgRole` from the JWT.
 * Both share userType='org_member' for backward compatibility with existing
 * data APIs. The `orgRole` field distinguishes them where needed.
 */
import { verifyJwt } from './jwt.js';
import { verifyToken, createClerkClient as mkClerkClient } from '@clerk/backend';
import { Client } from 'pg';

export interface AuthContext {
  userType: 'admin' | 'trial' | 'org_member' | 'super_admin' | 'no_org';
  orgSlug?: string;
  orgId?: string;      // Clerk org ID (org_xxx)
  orgRole?: string;    // 'org:admin' | 'org:member' — from Clerk JWT
  userId?: string;
}

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
}

const getConnectionString = () =>
  process.env.DATABASE_URL ||
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

/** Check super_admins table */
async function checkSuperAdmin(userId: string): Promise<boolean> {
  const cs = getConnectionString();
  if (!cs) return false;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    const r = await client.query(
      `SELECT 1 FROM platform.super_admins WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

/**
 * Resolve org slug for a given Clerk org ID.
 * Fast path: use `orgSlugFromToken` custom JWT claim (available once JWT template is configured).
 * Fallback: query platform.orgs WHERE clerk_org_id = $1
 */
async function resolveOrgSlug(
  clerkOrgId: string,
  orgSlugFromToken?: string
): Promise<string | null> {
  // Fast path — JWT template injects org_slug from org.publicMetadata
  // IMPORTANT: validate the value before trusting it. Clerk JWT templates that
  // haven't resolved (e.g. no active org session) can inject the raw Handlebars
  // placeholder "{{org.publicMetadata.slug}}" as a literal string. If we use it
  // as-is, the table name becomes org_{{...}}.transactions → PostgreSQL 42601.
  const VALID_SLUG = /^[a-z0-9][a-z0-9-]{1,49}$/;
  if (orgSlugFromToken && VALID_SLUG.test(orgSlugFromToken)) {
    return orgSlugFromToken;
  }

  // Fallback — DB lookup (used before JWT template is configured)
  const cs = getConnectionString();
  if (!cs) return null;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    const r = await client.query<{ slug: string }>(
      `SELECT slug FROM platform.orgs
       WHERE clerk_org_id = $1 AND status = 'approved' AND schema_provisioned = TRUE
       LIMIT 1`,
      [clerkOrgId]
    );
    return r.rows[0]?.slug ?? null;
  } finally {
    await client.end();
  }
}

function extractBearerToken(req: HttpRequest): string | null {
  const raw = req.headers['authorization'] || req.headers['Authorization'];
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parts = value.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

export async function getAuthContext(req: HttpRequest): Promise<AuthContext | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  // ── 1. Legacy SHA-256 JWT (trial / old admin mode) ────────────────────────
  const legacyPayload = verifyJwt(token);
  if (legacyPayload?.userType) {
    return { userType: legacyPayload.userType as 'admin' | 'trial' };
  }

  // ── 2. Clerk JWT ──────────────────────────────────────────────────────────
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
    });
    const userId        = payload.sub;
    let clerkOrgId      = (payload as any).org_id   as string | undefined;
    let clerkOrgRole    = (payload as any).org_role  as string | undefined;
    // Custom claim injected by JWT template (Clerk Dashboard → Configure → Sessions):
    //   { "org_slug": "{{org.publicMetadata.slug}}" }
    const orgSlugFromToken = (payload as any).org_slug as string | undefined;

    // Super admin check (always first)
    const isSA = await checkSuperAdmin(userId);
    if (isSA) return { userType: 'super_admin', userId };

    // ── Fallback: if no active org in JWT, query Clerk for memberships ──────
    // Clerk only puts org_id/org_role in the JWT when the user has an active org
    // session. On first sign-in (e.g. via provisioned sign-in link), no org is
    // active yet. We query the Backend API to find their membership.
    if (!clerkOrgId) {
      try {
        const clerkSDK = mkClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY || '',
        });
        const memberships = await clerkSDK.users.getOrganizationMembershipList({
          userId,
          limit: 5,
        });
        if (memberships.data.length > 0) {
          const m = memberships.data[0];
          clerkOrgId   = m.organization.id;
          clerkOrgRole = m.role;
        }
      } catch { /* ignore — proceed as no_org */ }
    }

    // User is in a Clerk org
    if (clerkOrgId && clerkOrgRole) {
      const orgSlug = await resolveOrgSlug(clerkOrgId, orgSlugFromToken);
      if (orgSlug) {
        return {
          userType: 'org_member',   // both admin and member share this for data APIs
          orgSlug,
          orgId:   clerkOrgId,
          orgRole: clerkOrgRole,    // 'org:admin' | 'org:member'
          userId,
        };
      }
    }

    // Authenticated but no org assigned yet
    return { userType: 'no_org', userId };
  } catch {
    return null;
  }
}

/** Synchronous fast-path — only verifies legacy JWT, no DB lookup */
export function getAuthContextSync(
  req: HttpRequest
): Pick<AuthContext, 'userType'> | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload?.userType) return null;
  return { userType: payload.userType as 'admin' | 'trial' };
}

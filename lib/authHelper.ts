/**
 * lib/authHelper.ts — Dual-stack auth context resolver
 *
 * Resolution order:
 *   1. Bearer token → try legacy SHA-256 JWT (old MQLC admin via api/auth.ts)
 *   2. Bearer token → try Clerk JWT → look up platform.super_admins / org_members
 *   3. Neither      → return null (unauthenticated)
 *
 * Lives in lib/ (outside api/) so Vercel doesn't count it as a serverless function.
 */
import { HandlerEvent } from '@netlify/functions';
import { verifyJwt } from './jwt.js';
import { verifyToken } from '@clerk/backend';
import { Client } from 'pg';

export interface AuthContext {
  userType: 'admin' | 'trial' | 'org_member' | 'super_admin';
  orgSlug?: string;
  userId?: string;
}

const getConnectionString = () =>
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

async function resolveClerkUser(
  userId: string
): Promise<{ orgSlug: string | null; isSuperAdmin: boolean }> {
  const connectionString = getConnectionString();
  if (!connectionString) return { orgSlug: null, isSuperAdmin: false };

  const client = new Client({ connectionString });
  try {
    await client.connect();

    // Check super admin first
    const saResult = await client.query(
      `SELECT 1 FROM platform.super_admins WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if ((saResult.rowCount ?? 0) > 0) return { orgSlug: null, isSuperAdmin: true };

    // Check org membership
    const memberResult = await client.query<{ slug: string }>(
      `SELECT o.slug FROM platform.org_members m
       JOIN platform.orgs o ON o.id = m.org_id
       WHERE m.user_id = $1 AND o.status = 'approved' AND o.schema_provisioned = TRUE
       LIMIT 1`,
      [userId]
    );
    return {
      orgSlug: memberResult.rows[0]?.slug ?? null,
      isSuperAdmin: false,
    };
  } finally {
    await client.end();
  }
}

export async function getAuthContext(event: HandlerEvent): Promise<AuthContext | null> {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  const token = parts[1];

  // ── 1. Legacy SHA-256 JWT (old admin, api/auth.ts) ─────────────────────
  const legacyPayload = verifyJwt(token);
  if (legacyPayload?.userType) {
    return { userType: legacyPayload.userType as 'admin' | 'trial' };
  }

  // ── 2. Clerk JWT ────────────────────────────────────────────────────────
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
    });
    const userId = payload.sub;
    const { orgSlug, isSuperAdmin } = await resolveClerkUser(userId);
    if (isSuperAdmin) return { userType: 'super_admin', userId };
    if (orgSlug)      return { userType: 'org_member', orgSlug, userId };
    return null;
  } catch {
    // Not a valid Clerk token
    return null;
  }
}

/** Synchronous version — only resolves legacy JWT, no DB lookup */
export function getAuthContextSync(event: HandlerEvent): Pick<AuthContext, 'userType'> | null {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  const payload = verifyJwt(parts[1]);
  if (!payload?.userType) return null;
  return { userType: payload.userType as 'admin' | 'trial' };
}

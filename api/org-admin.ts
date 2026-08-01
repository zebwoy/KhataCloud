/**
 * api/org-admin.ts — Org admin management API
 *
 * All routes require Clerk auth + org:admin role.
 * Routes (?action=):
 *   GET  members        → list org members (from Clerk)
 *   GET  pending-count  → { count: N } for notification badge
 *   GET  requests       → list pending join requests
 *   GET  audit          → paginated org audit log
 *   GET  settings       → org settings (accepting_requests, plan, etc.)
 *   POST provision      → create member + sign-in link  [audited]
 *   PATCH request       → approve / reject a join request  [audited]
 *   PATCH member-role   → change a member's role (member only, not admin)  [audited]
 *   PATCH settings      → toggle accepting_requests
 *   DELETE member       → remove member from Clerk org  [audited]
 */
import { Client } from 'pg';
import { createClerkClient } from '@clerk/backend';
import { getAuthContext } from '../lib/authHelper.js';
import { logAudit } from '../lib/auditHelper.js';
import { setCors, qp } from '../lib/vercel-handler.js';
import type { VercelReq, VercelRes } from '../lib/vercel-handler.js';

const getCS = () =>
  process.env.DATABASE_URL ||
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  '';

type SubResult = { statusCode: number; body: string };
const ok  = (d: unknown, c = 200): SubResult => ({ statusCode: c, body: JSON.stringify(d) });
const err = (m: string,  c = 400): SubResult => ({ statusCode: c, body: JSON.stringify({ error: m }) });

const clerk = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || '' });

const appBaseUrl = () =>
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173';

function randomSecurePassword(): string {
  const pool = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < 20; i++) pw += pool[Math.floor(Math.random() * pool.length)];
  return pw;
}

// ─── GET members ────────────────────────────────────────────────────────────
async function getMembers(ctx: any): Promise<SubResult> {
  try {
    const memberships = await clerk().organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
      limit: 100,
    });
    const members = memberships.data.map((m: any) => ({
      userId:     m.publicUserData?.userId,
      firstName:  m.publicUserData?.firstName,
      lastName:   m.publicUserData?.lastName,
      email:      m.publicUserData?.identifier,
      imageUrl:   m.publicUserData?.imageUrl,
      role:       m.role,           // 'org:admin' | 'org:member'
      joinedAt:   m.createdAt,
    }));
    return ok({ members, total: memberships.totalCount });
  } catch (e: any) {
    return err(`Failed to fetch members: ${e.message}`);
  }
}

// ─── GET pending-count ───────────────────────────────────────────────────────
async function getPendingCount(ctx: any, client: Client): Promise<SubResult> {
  const r = await client.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM platform.join_requests jr
     JOIN platform.orgs o ON o.id = jr.org_id
     WHERE o.clerk_org_id = $1 AND jr.status = 'pending'`,
    [ctx.orgId]
  );
  return ok({ count: parseInt(r.rows[0]?.count ?? '0') });
}

// ─── GET requests ────────────────────────────────────────────────────────────
async function getRequests(ctx: any, client: Client): Promise<SubResult> {
  const r = await client.query(
    `SELECT jr.id, jr.user_id, jr.status, jr.message, jr.requested_at,
            jr.reviewed_by, jr.reviewed_at
     FROM platform.join_requests jr
     JOIN platform.orgs o ON o.id = jr.org_id
     WHERE o.clerk_org_id = $1 AND jr.status = 'pending'
     ORDER BY jr.requested_at ASC`,
    [ctx.orgId]
  );

  // Enrich with Clerk user info (best-effort per user)
  const enriched = await Promise.all(r.rows.map(async (row: any) => {
    try {
      const user = await clerk().users.getUser(row.user_id);
      return {
        ...row,
        email:     user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName:  user.lastName,
        imageUrl:  user.imageUrl,
      };
    } catch {
      return row;
    }
  }));
  return ok(enriched);
}

// ─── GET audit ───────────────────────────────────────────────────────────────
async function getAudit(ctx: any, req: VercelReq, client: Client): Promise<SubResult> {
  const schemaName = `org_${ctx.orgSlug.replace(/-/g, '_')}`;
  const page  = parseInt(qp(req.query, 'page') ?? '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    client.query(
      `SELECT id, user_id, user_role, action, entity_type, entity_id, summary, ip_addr, created_at
       FROM ${schemaName}.audit_log
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM ${schemaName}.audit_log`
    ),
  ]);

  return ok({
    entries:    rows.rows,
    total:      parseInt(total.rows[0]?.count ?? '0'),
    page,
    totalPages: Math.ceil(parseInt(total.rows[0]?.count ?? '0') / limit),
  });
}

// ─── GET settings ────────────────────────────────────────────────────────────
async function getSettings(ctx: any, client: Client): Promise<SubResult> {
  const r = await client.query(
    `SELECT id, name, slug, plan, contact_email, accepting_requests, notes, created_at
     FROM platform.orgs WHERE clerk_org_id = $1`,
    [ctx.orgId]
  );
  return r.rows.length ? ok(r.rows[0]) : err('Org not found', 404);
}

// ─── POST provision ──────────────────────────────────────────────────────────
async function postProvision(ctx: any, req: VercelReq, client: Client): Promise<SubResult> {
  const { name, email } = req.body ?? {};
  if (!name?.trim() || !email?.trim())
    return err('name and email required');

  // Create Clerk user
  let userId: string;
  try {
    const parts = name.trim().split(' ');
    const u = await clerk().users.createUser({
      emailAddress:      [email.trim().toLowerCase()],
      password:          randomSecurePassword(),
      firstName:         parts[0],
      lastName:          parts.slice(1).join(' ') || undefined,
      skipPasswordChecks: true,
    });
    userId = u.id;
  } catch (e: any) {
    const msg = e?.errors?.map((er: any) => er.longMessage || er.message).join('; ') ?? e?.message;
    if (/already exists|form_identifier_exists/i.test(msg))
      return err(`User '${email}' already exists in Clerk`, 409);
    return err(`Clerk error: ${msg}`, 422);
  }

  // Add to Clerk org as member (org admin cannot set admin role — SA only)
  try {
    await clerk().organizations.createOrganizationMembership({
      organizationId: ctx.orgId,
      userId,
      role: 'org:member',
    });
  } catch (e: any) {
    await clerk().users.deleteUser(userId).catch(() => {});
    return err(`Failed to add user to org: ${e?.message}`, 422);
  }

  // Sign-in link
  let signInUrl: string | null = null;
  try {
    const token = await clerk().signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 7 * 24 * 3600,
    });
    signInUrl = `${appBaseUrl()}/auth#?__clerk_ticket=${token.token}`;
  } catch { /* best-effort */ }

  // Audit
  await logAudit(client, {
    orgSlug:    ctx.orgSlug,
    userId:     ctx.userId!,
    userRole:   'org:admin',
    action:     'provision_member',
    entityType: 'member',
    entityId:   userId,
    summary:    `Admin provisioned '${name}' (${email}) as member`,
  });

  return ok({ success: true, userId, email, name, signInUrl }, 201);
}

// ─── PATCH request (approve/reject) ─────────────────────────────────────────
async function patchRequest(ctx: any, req: VercelReq, client: Client): Promise<SubResult> {
  const { requestId, action } = req.body ?? {};
  if (!requestId || !['approve', 'reject'].includes(action))
    return err('requestId and action (approve|reject) required');

  const jr = await client.query<{
    user_id: string; org_id: string; status: string;
  }>(
    `SELECT jr.user_id, jr.org_id, jr.status
     FROM platform.join_requests jr
     JOIN platform.orgs o ON o.id = jr.org_id
     WHERE jr.id=$1 AND o.clerk_org_id=$2`,
    [requestId, ctx.orgId]
  );
  if (!jr.rows.length) return err('Request not found', 404);
  if (jr.rows[0].status !== 'pending') return err('Request is no longer pending', 409);

  const { user_id } = jr.rows[0];

  if (action === 'approve') {
    // Add user to Clerk org
    try {
      await clerk().organizations.createOrganizationMembership({
        organizationId: ctx.orgId,
        userId: user_id,
        role: 'org:member',
      });
    } catch (e: any) {
      return err(`Failed to add user to org: ${e?.message}`, 422);
    }
  }

  // Update request status
  await client.query(
    `UPDATE platform.join_requests
     SET status=$1, reviewed_by=$2, reviewed_at=NOW()
     WHERE id=$3`,
    [action === 'approve' ? 'approved' : 'rejected', ctx.userId, requestId]
  );

  await logAudit(client, {
    orgSlug:    ctx.orgSlug,
    userId:     ctx.userId!,
    userRole:   'org:admin',
    action:     action === 'approve' ? 'approve_join_request' : 'reject_join_request',
    entityType: 'member',
    entityId:   user_id,
    summary:    `Admin ${action}d join request for user ${user_id}`,
  });

  return ok({ success: true, action, userId: user_id });
}

// ─── PATCH member-role ───────────────────────────────────────────────────────
async function patchMemberRole(ctx: any, req: VercelReq, client: Client): Promise<SubResult> {
  const { userId: targetUserId, role } = req.body ?? {};
  if (!targetUserId || !['org:member'].includes(role))
    return err('userId and role (org:member) required — org:admin can only be set by SA');

  try {
    await clerk().organizations.updateOrganizationMembership({
      organizationId: ctx.orgId,
      userId: targetUserId,
      role,
    });
  } catch (e: any) {
    return err(`Failed to update role: ${e?.message}`, 422);
  }

  await logAudit(client, {
    orgSlug:    ctx.orgSlug,
    userId:     ctx.userId!,
    userRole:   'org:admin',
    action:     'change_member_role',
    entityType: 'member',
    entityId:   targetUserId,
    summary:    `Admin changed role of ${targetUserId} to ${role}`,
  });

  return ok({ success: true });
}

// ─── PATCH settings ──────────────────────────────────────────────────────────
async function patchSettings(ctx: any, req: VercelReq, client: Client): Promise<SubResult> {
  const { acceptingRequests, contactEmail, notes } = req.body ?? {};
  const upd = await client.query(
    `UPDATE platform.orgs SET
       accepting_requests = COALESCE($1, accepting_requests),
       contact_email      = COALESCE($2, contact_email),
       notes              = COALESCE($3, notes)
     WHERE clerk_org_id = $4`,
    [
      acceptingRequests != null ? acceptingRequests : null,
      contactEmail ?? null,
      notes        ?? null,
      ctx.orgId,
    ]
  );
  if (!upd.rowCount) return err('Org not found', 404);

  // Sync acceptingRequests to Clerk publicMetadata
  if (acceptingRequests != null) {
    try {
      const orgDetails = await client.query<{ slug: string; plan: string }>(
        `SELECT slug, plan FROM platform.orgs WHERE clerk_org_id=$1`, [ctx.orgId]
      );
      if (orgDetails.rows.length) {
        await clerk().organizations.updateOrganization(ctx.orgId, {
          publicMetadata: {
            slug:              orgDetails.rows[0].slug,
            plan:              orgDetails.rows[0].plan,
            schemaProvisioned: true,
            acceptingRequests: acceptingRequests,
          },
        });
      }
    } catch { /* non-fatal */ }
  }

  return ok({ success: true });
}

// ─── DELETE member ───────────────────────────────────────────────────────────
async function deleteMember(ctx: any, req: VercelReq, client: Client): Promise<SubResult> {
  const targetUserId = qp(req.query, 'userId');
  if (!targetUserId) return err('userId required');

  try {
    await clerk().organizations.deleteOrganizationMembership({
      organizationId: ctx.orgId,
      userId: targetUserId,
    });
  } catch (e: any) {
    return err(`Failed to remove member: ${e?.message}`, 422);
  }

  await logAudit(client, {
    orgSlug:    ctx.orgSlug,
    userId:     ctx.userId!,
    userRole:   'org:admin',
    action:     'remove_member',
    entityType: 'member',
    entityId:   targetUserId,
    summary:    `Admin removed member ${targetUserId} from org`,
  });

  return ok({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = qp(req.query, 'action');
  if (!action) return res.status(400).json({ error: 'Missing ?action=' });

  const client = new Client({ connectionString: getCS() });
  try {
    await client.connect();
    const ctx = await getAuthContext(req);

    if (!ctx || ctx.userType !== 'org_member' || ctx.orgRole !== 'org:admin')
      return res.status(403).json({ error: 'Forbidden — org admin only' });

    let result: SubResult;
    switch (action) {
      case 'members':       result = await getMembers(ctx); break;
      case 'pending-count': result = await getPendingCount(ctx, client); break;
      case 'requests':      result = await getRequests(ctx, client); break;
      case 'audit':         result = await getAudit(ctx, req, client); break;
      case 'settings':      result = await getSettings(ctx, client); break;
      case 'provision':     result = await postProvision(ctx, req, client); break;
      case 'request':       result = await patchRequest(ctx, req, client); break;
      case 'member-role':   result = await patchMemberRole(ctx, req, client); break;
      case 'settings-save': result = await patchSettings(ctx, req, client); break;
      case 'member':        result = await deleteMember(ctx, req, client); break;
      default:              result = err(`Unknown action '${action}'`);
    }

    return res.status(result.statusCode).send(result.body);
  } catch (e: any) {
    console.error('[api/org-admin]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    await client.end();
  }
}

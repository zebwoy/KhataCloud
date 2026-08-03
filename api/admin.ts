/**
 * api/admin.ts — Consolidated super-admin API
 *
 * Routes (?action=):
 *   GET  whoami        → role + orgSlug + orgRole (used by RootApp RBAC)
 *   GET  stats         → SA platform analytics
 *   GET  orgs          → list all orgs (or single by ?id=)
 *   POST orgs          → SA creates org (auto-approved + Clerk org created)
 *   PUT  orgs          → approve/reject/suspend existing org
 *   PATCH orgs         → edit org details (name, contact, plan, notes)
 *   POST provision     → SA power tool: create Clerk user + add to org  [audited]
 *   GET  register?slug → slug availability check
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
  process.env.NETLIFY_DB_URL ||
  '';

const SLUG_REGEX = /^[a-z0-9][a-z0-9\-]{2,48}[a-z0-9]$/;

type SubResult = { statusCode: number; body: string };

const ok  = (data: unknown, code = 200): SubResult =>
  ({ statusCode: code, body: JSON.stringify(data) });
const err = (msg: string, code = 400): SubResult =>
  ({ statusCode: code, body: JSON.stringify({ error: msg }) });

/** Clerk client singleton per invocation */
const clerkClient = () =>
  createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || '' });

/** App base URL for sign-in token links */
const appBaseUrl = () =>
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────────────────────
// Whoami — role detection for RootApp routing
// ─────────────────────────────────────────────────────────────────────────────
async function handleWhoami(authCtx: any, client: Client): Promise<SubResult> {
  if (!authCtx) return err('Unauthenticated', 401);

  if (authCtx.userType === 'super_admin')
    return ok({ userType: 'super_admin', userId: authCtx.userId });

  if (authCtx.userType === 'org_member')
    return ok({
      userType: 'org_member',
      orgSlug:  authCtx.orgSlug,
      orgRole:  authCtx.orgRole,  // 'org:admin' | 'org:member'
      orgId:    authCtx.orgId,
      userId:   authCtx.userId,
    });

  // Authenticated but not in any org yet — check for pending join request
  if (authCtx.userType === 'no_org' && authCtx.userId) {
    const pending = await client.query<{
      org_name: string; requested_at: string; org_id: string;
    }>(
      `SELECT o.name AS org_name, jr.requested_at, jr.org_id
       FROM platform.join_requests jr
       JOIN platform.orgs o ON o.id = jr.org_id
       WHERE jr.user_id = $1 AND jr.status = 'pending'
       LIMIT 1`,
      [authCtx.userId]
    );
    if (pending.rows.length > 0) {
      const jr = pending.rows[0];
      return ok({
        userType:    'pending',
        orgName:     jr.org_name,
        orgId:       jr.org_id,
        requestedAt: jr.requested_at,
        userId:      authCtx.userId,
      });
    }
    return ok({ userType: 'no_org', userId: authCtx.userId });
  }

  return ok({ userType: 'no_org' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats — SA dashboard overview
// ─────────────────────────────────────────────────────────────────────────────
async function handleStats(authCtx: any, client: Client): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin') return err('Forbidden', 403);

  const orgStatsResult = await client.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::int AS count FROM platform.orgs GROUP BY status`
  );
  const orgCounts = { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 };
  for (const row of orgStatsResult.rows) {
    const c = parseInt(row.count);
    (orgCounts as any)[row.status] = c;
    orgCounts.total += c;
  }

  const pendingJoinRequests = await client.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM platform.join_requests WHERE status='pending'`
  );

  const [recentOrgs, pendingOrgs] = await Promise.all([
    client.query(`
      SELECT id, name, slug, status, plan, schema_provisioned,
             clerk_org_id, contact_email, created_at, approved_at
      FROM platform.orgs
      ORDER BY created_at DESC LIMIT 8
    `),
    client.query(`
      SELECT id, name, slug, contact_email, created_at
      FROM platform.orgs WHERE status = 'pending'
      ORDER BY created_at ASC
    `),
  ]);

  // Enrich recentOrgs with Clerk member counts (best-effort)
  const clerk = clerkClient();
  const enrichedRecent = await Promise.all(
    recentOrgs.rows.map(async (org: any) => {
      let member_count = 0;
      if (org.clerk_org_id) {
        try {
          const res = await clerk.organizations.getOrganizationMembershipList({
            organizationId: org.clerk_org_id,
            limit: 1,
          });
          member_count = res.totalCount ?? 0;
        } catch { /* best-effort */ }
      }
      return { ...org, member_count };
    })
  );

  // Total Clerk users + members this week
  let totalUsers = 0;
  let totalMembers = 0;
  let membersThisWeek = 0;
  try {
    totalUsers = await clerk.users.getCount();
  } catch { /* best-effort */ }

  // Sum member counts from enriched orgs as a proxy (only covers listed orgs)
  totalMembers = enrichedRecent.reduce((s: number, o: any) => s + (o.member_count ?? 0), 0);

  return ok({
    orgs:               orgCounts,
    pendingJoinRequests: parseInt(pendingJoinRequests.rows[0]?.count ?? '0'),
    members:            { total: totalMembers, thisWeek: membersThisWeek },
    users:              { total: totalUsers },
    recentOrgs:         enrichedRecent,
    pendingOrgs:        pendingOrgs.rows,
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Orgs — list, create, approve/reject, edit
// ─────────────────────────────────────────────────────────────────────────────
async function handleOrgs(authCtx: any, req: VercelReq, client: Client): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin')
    return err('Forbidden — super-admin only', 403);

  // ── GET: list or single org ───────────────────────────────────────────────
  if (req.method === 'GET') {
    const orgId = qp(req.query, 'id');
    if (orgId) {
      // Single org — try to get Clerk member count if clerk_org_id is set
      const r = await client.query(
        `SELECT o.*, sa.email AS approved_by_email
         FROM platform.orgs o
         LEFT JOIN platform.super_admins sa ON sa.user_id = o.approved_by
         WHERE o.id = $1`,
        [orgId]
      );
      if (!r.rows.length) return ok(null);
      const org = r.rows[0];

      // Get member count from Clerk if we have the org ID
      let memberCount = 0;
      if (org.clerk_org_id) {
        try {
          const { totalCount } = await clerkClient().organizations.getOrganizationMembershipList({
            organizationId: org.clerk_org_id,
            limit: 1,
          });
          memberCount = totalCount ?? 0;
        } catch { /* best-effort */ }
      }

      return ok({ ...org, member_count: memberCount });
    }

    // List all orgs
    const r = await client.query(`
      SELECT id, name, slug, status, plan, schema_provisioned,
             clerk_org_id, accepting_requests,
             contact_email, notes, created_at, approved_at, owner_user_id
      FROM platform.orgs
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               created_at DESC
    `);
    return ok(r.rows);
  }

  // ── POST: SA creates org (auto-approved + Clerk org created + schema provisioned)
  if (req.method === 'POST') {
    const body = req.body;
    if (!body) return err('Body required');
    const { name, slug, contactEmail, plan = 'free', notes } = body as {
      name: string; slug: string; contactEmail?: string; plan?: string; notes?: string;
    };
    if (!name?.trim() || name.trim().length < 3)
      return err('Organisation name must be ≥ 3 characters');
    if (!slug || !SLUG_REGEX.test(slug))
      return err('Invalid slug format. Use lowercase letters, numbers, hyphens (4–50 chars).');

    const slugCheck = await client.query(
      `SELECT 1 FROM platform.orgs WHERE slug=$1 LIMIT 1`, [slug]
    );
    if (slugCheck.rowCount && slugCheck.rowCount > 0)
      return err('Slug already taken', 409);

    await client.query('BEGIN');
    const insert = await client.query<{ id: string }>(
      `INSERT INTO platform.orgs (name, slug, status, plan, contact_email, notes,
         approved_at, approved_by)
       VALUES ($1,$2,'approved',$3,$4,$5,NOW(),$6) RETURNING id`,
      [name.trim(), slug, plan, contactEmail ?? null, notes ?? null, authCtx.userId]
    );
    const orgId = insert.rows[0].id;

    // Provision DB schema
    await client.query(`SELECT platform.provision_org_schema($1)`, [slug]);

    // Create Clerk org and store the clerk_org_id
    let clerkOrgId: string | null = null;
    try {
      const clerkOrg = await clerkClient().organizations.createOrganization({
        name: name.trim(),
        slug,
        publicMetadata: {
          slug,
          plan,
          schemaProvisioned: true,
          acceptingRequests: false,
        },
      });
      clerkOrgId = clerkOrg.id;
      await client.query(
        `UPDATE platform.orgs SET clerk_org_id=$1 WHERE id=$2`,
        [clerkOrgId, orgId]
      );
    } catch (e) {
      console.error('[admin] Failed to create Clerk org:', e);
      // Non-fatal — org still exists in our DB; Clerk org can be created manually
    }

    await client.query('COMMIT');

    const refreshed = await client.query(
      `SELECT * FROM platform.orgs WHERE id=$1`, [orgId]
    );
    return ok(refreshed.rows[0], 201);
  }

  // ── PUT: approve / reject / suspend ──────────────────────────────────────
  if (req.method === 'PUT') {
    const body = req.body;
    if (!body) return err('Body required');
    const { id, action, notes } = body as {
      id: string; action: 'approve' | 'reject' | 'suspend'; notes?: string;
    };
    if (!id || !['approve', 'reject', 'suspend'].includes(action))
      return err('id and valid action required');

    const statusMap: Record<string, string> = {
      approve: 'approved', reject: 'rejected', suspend: 'suspended',
    };

    await client.query('BEGIN');
    const upd = await client.query<{
      slug: string; name: string; schema_provisioned: boolean; clerk_org_id: string | null;
    }>(
      `UPDATE platform.orgs SET status=$1,
         approved_at = CASE WHEN $1='approved' THEN NOW() ELSE approved_at END,
         approved_by = CASE WHEN $1='approved' THEN $2  ELSE approved_by  END,
         notes = COALESCE($3, notes)
       WHERE id=$4 RETURNING slug, name, schema_provisioned, clerk_org_id`,
      [statusMap[action], authCtx.userId, notes ?? null, id]
    );
    if (!upd.rows.length) {
      await client.query('ROLLBACK');
      return err('Org not found', 404);
    }

    const { slug, name, schema_provisioned, clerk_org_id } = upd.rows[0];

    if (action === 'approve') {
      // Provision DB schema if not already done
      if (!schema_provisioned) {
        await client.query(`SELECT platform.provision_org_schema($1)`, [slug]);
      }

      // Create Clerk org if not already linked
      if (!clerk_org_id) {
        try {
          const orgDetails = await client.query<{ plan: string }>(
            `SELECT plan FROM platform.orgs WHERE id=$1`, [id]
          );
          const plan = orgDetails.rows[0]?.plan ?? 'free';
          const clerkOrg = await clerkClient().organizations.createOrganization({
            name,
            slug,
            publicMetadata: {
              slug,
              plan,
              schemaProvisioned: true,
              acceptingRequests: false,
            },
          });
          await client.query(
            `UPDATE platform.orgs SET clerk_org_id=$1 WHERE id=$2`,
            [clerkOrg.id, id]
          );
        } catch (e) {
          console.error('[admin] Failed to create Clerk org on approval:', e);
        }
      }
    }

    await client.query('COMMIT');

    const refreshed = await client.query(
      `SELECT * FROM platform.orgs WHERE id=$1`, [id]
    );
    return ok(refreshed.rows[0]);
  }

  // ── PATCH: edit org details + special repair actions ─────────────────────
  if (req.method === 'PATCH') {
    const body = req.body;
    if (!body) return err('Body required');
    const { id, name, contactEmail, plan, notes, linkClerkOrgId, reprovisionSchema } = body as {
      id: string; name?: string; contactEmail?: string; plan?: string; notes?: string;
      linkClerkOrgId?: string;   // Set/update the clerk_org_id for this org
      reprovisionSchema?: boolean; // Re-run provision_org_schema (idempotent)
    };
    if (!id) return err('id required');
    if (name !== undefined && name.trim().length < 3)
      return err('Organisation name must be ≥ 3 characters');

    // ── Special action: link a Clerk org ID ──────────────────────────────────
    if (linkClerkOrgId !== undefined) {
      const linkUpd = await client.query<{ slug: string }>(
        `UPDATE platform.orgs SET clerk_org_id=$1 WHERE id=$2 RETURNING slug`,
        [linkClerkOrgId || null, id]
      );
      if (!linkUpd.rowCount) return err('Org not found', 404);

      const slug = linkUpd.rows[0].slug;
      // Sync org slug in Clerk org public metadata if clerk_org_id was provided
      if (linkClerkOrgId) {
        try {
          await clerkClient().organizations.updateOrganization(linkClerkOrgId, {
            publicMetadata: { slug, schemaProvisioned: true },
          });
        } catch (e) {
          console.error('[admin] Could not update Clerk org metadata:', e);
          // Non-fatal
        }
      }

      const refreshed = await client.query(`SELECT * FROM platform.orgs WHERE id=$1`, [id]);
      return ok({ ...refreshed.rows[0], _info: 'clerk_org_id updated' });
    }

    // ── Special action: reprovision schema ───────────────────────────────────
    if (reprovisionSchema) {
      const orgRow = await client.query<{ slug: string }>(
        `SELECT slug FROM platform.orgs WHERE id=$1 AND status='approved' LIMIT 1`, [id]
      );
      if (!orgRow.rowCount) return err('Org not found or not approved', 404);
      const slug = orgRow.rows[0].slug;
      try {
        await client.query(`SELECT platform.provision_org_schema($1)`, [slug]);
      } catch (e) {
        return err(`Provisioning failed: ${(e as Error).message}`, 500);
      }
      const refreshed = await client.query(`SELECT * FROM platform.orgs WHERE id=$1`, [id]);
      return ok({ ...refreshed.rows[0], _info: 'schema reprovisioned' });
    }

    // ── Normal edit ──────────────────────────────────────────────────────────
    const upd = await client.query<{ clerk_org_id: string | null }>(
      `UPDATE platform.orgs SET
         name          = COALESCE($1, name),
         contact_email = COALESCE($2, contact_email),
         plan          = COALESCE($3, plan),
         notes         = COALESCE($4, notes)
       WHERE id=$5 RETURNING clerk_org_id`,
      [name?.trim() ?? null, contactEmail ?? null, plan ?? null, notes ?? null, id]
    );
    if (!upd.rowCount) return err('Org not found', 404);

    // Sync name change to Clerk if possible
    const clerkOrgId = upd.rows[0]?.clerk_org_id;
    if (name && clerkOrgId) {
      try {
        await clerkClient().organizations.updateOrganization(clerkOrgId, { name: name.trim() });
      } catch { /* non-fatal */ }
    }

    const refreshed = await client.query(
      `SELECT * FROM platform.orgs WHERE id=$1`, [id]
    );
    return ok(refreshed.rows[0]);
  }

  return err('Method Not Allowed', 405);
}


// ─────────────────────────────────────────────────────────────────────────────
// Provision user — SA power tool (all roles, audited)
// ─────────────────────────────────────────────────────────────────────────────

function randomSecurePassword(): string {
  const pool = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < 20; i++) pw += pool[Math.floor(Math.random() * pool.length)];
  return pw;
}

async function handleProvision(authCtx: any, req: VercelReq, client: Client): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin')
    return err('Forbidden — super-admin only', 403);

  const body = req.body;
  if (!body) return err('Body required');

  const { name, email, orgSlug, role = 'member' } = body;
  if (!name?.trim() || !email?.trim() || !orgSlug)
    return err('name, email, orgSlug required');
  if (!['member', 'admin'].includes(role))
    return err('role must be member or admin');

  const orgResult = await client.query<{ id: string; clerk_org_id: string | null }>(
    `SELECT id, clerk_org_id FROM platform.orgs
     WHERE slug=$1 AND status='approved' AND schema_provisioned=TRUE LIMIT 1`,
    [orgSlug]
  );
  if (!orgResult.rows.length)
    return err(`Org '${orgSlug}' not found or not approved`, 404);

  const { clerk_org_id: clerkOrgId } = orgResult.rows[0];
  if (!clerkOrgId)
    return err(`Org '${orgSlug}' is not linked to Clerk yet — approve the org first`, 422);

  const clerk = clerkClient();
  const clerkRole = role === 'admin' ? 'org:admin' : 'org:member';

  // Step 1: Create Clerk user with a random internal password
  let userId: string;
  try {
    const nameParts = name.trim().split(' ');
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email.trim().toLowerCase()],
      password:     randomSecurePassword(),
      firstName:    nameParts[0],
      lastName:     nameParts.slice(1).join(' ') || undefined,
      skipPasswordChecks: true,
    });
    userId = clerkUser.id;
  } catch (e: any) {
    const clerkMsg =
      e?.errors?.map((er: any) => er.longMessage || er.message).join('; ') ??
      e?.message ?? String(e);
    if (/already exists|duplicate|form_identifier_exists/i.test(clerkMsg))
      return err(`User '${email}' already exists in Clerk`, 409);
    return err(`Clerk error: ${clerkMsg}`, 422);
  }

  // Step 2: Add user to Clerk org with the correct role
  try {
    await clerk.organizations.createOrganizationMembership({
      organizationId: clerkOrgId,
      userId,
      role: clerkRole,
    });
  } catch (e: any) {
    // Roll back: delete the just-created user so we don't leave orphans
    await clerk.users.deleteUser(userId).catch(() => {});
    const clerkMsg = e?.errors?.map((er: any) => er.message).join('; ') ?? e?.message ?? String(e);
    return err(`Failed to add user to org: ${clerkMsg}`, 422);
  }

  // Step 3: One-time sign-in link (7-day expiry)
  let signInUrl: string | null = null;
  try {
    const token = await clerk.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 7 * 24 * 3600,
    });
    signInUrl = `${appBaseUrl()}/auth#?__clerk_ticket=${token.token}`;
  } catch { /* best-effort */ }

  // Step 4: Audit log
  await logAudit(client, {
    orgSlug,
    userId:     authCtx.userId!,
    userRole:   'super_admin',
    action:     'provision_member',
    entityType: 'member',
    entityId:   userId,
    summary:    `SA provisioned '${name}' (${email}) as ${role} in '${orgSlug}'`,
  });

  return ok({
    success: true, userId, email, name, orgSlug, role, clerkRole, signInUrl,
    message: `User '${name}' created in Clerk and added to '${orgSlug}' as ${role}.`,
  }, 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug availability check (used by SA org creation form)
// ─────────────────────────────────────────────────────────────────────────────
async function handleSlugCheck(req: VercelReq, client: Client): Promise<SubResult> {
  const slug = qp(req.query, 'slug');
  if (!slug || !SLUG_REGEX.test(slug))
    return err('Invalid slug format. Use lowercase letters, numbers, and hyphens (4–50 chars).');
  const r = await client.query(`SELECT 1 FROM platform.orgs WHERE slug=$1 LIMIT 1`, [slug]);
  return ok({ available: r.rowCount === 0 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Org Members — list Clerk org memberships for SA view
// ─────────────────────────────────────────────────────────────────────────────
async function handleOrgMembers(authCtx: any, req: VercelReq): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin') return err('Forbidden', 403);

  const clerkOrgId = qp(req.query, 'clerkOrgId');
  if (!clerkOrgId) return err('clerkOrgId required');

  try {
    const clerk = clerkClient();
    const { data } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
      limit: 100,
    });

    const members = data.map((m: any) => ({
      userId:    m.publicUserData?.userId    ?? '',
      firstName: m.publicUserData?.firstName ?? '',
      lastName:  m.publicUserData?.lastName  ?? '',
      email:     m.publicUserData?.identifier ?? '',
      imageUrl:  m.publicUserData?.imageUrl  ?? '',
      role:      m.role,                        // 'org:admin' | 'org:member'
      joinedAt:  m.createdAt,
    }));

    return ok(members);
  } catch (e: any) {
    return err(`Clerk error: ${e.message}`, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Set Org Member Role — SA promotes/demotes org admins
// ─────────────────────────────────────────────────────────────────────────────
async function handleSetOrgMemberRole(
  authCtx: any, req: VercelReq, client: Client
): Promise<SubResult> {
  if (!authCtx || authCtx.userType !== 'super_admin') return err('Forbidden', 403);
  if (req.method !== 'PATCH') return err('Method not allowed', 405);

  const { clerkOrgId, userId, role, orgSlug } = req.body ?? {};
  if (!clerkOrgId || !userId || !role) return err('clerkOrgId, userId, role required');
  if (!['org:admin', 'org:member'].includes(role))
    return err('Invalid role. Must be org:admin or org:member');

  try {
    const clerk = clerkClient();
    await clerk.organizations.updateOrganizationMembership({
      organizationId: clerkOrgId,
      userId,
      role,
    });
  } catch (e: any) {
    return err(`Clerk error: ${e.message}`, 500);
  }

  // Audit (best-effort)
  if (orgSlug) {
    await logAudit(client, {
      orgSlug,
      userId:     authCtx.userId!,
      userRole:   'super_admin',
      action:     'change_member_role',
      entityType: 'member',
      entityId:   userId,
      summary:    `SA set role '${role}' for user ${userId} in org '${orgSlug}'`,
    });
  }

  return ok({ ok: true, userId, role });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = qp(req.query, 'action');
  if (!action) return res.status(400).json({ error: 'Missing ?action= parameter' });

  const client = new Client({ connectionString: getCS() });

  try {
    await client.connect();
    const authCtx = await getAuthContext(req);

    let result: SubResult;
    switch (action) {
      case 'whoami':          result = await handleWhoami(authCtx, client); break;
      case 'stats':            result = await handleStats(authCtx, client); break;
      case 'orgs':             result = await handleOrgs(authCtx, req, client); break;
      case 'org-members':      result = await handleOrgMembers(authCtx, req); break;
      case 'org-member-role':  result = await handleSetOrgMemberRole(authCtx, req, client); break;
      case 'provision':        result = await handleProvision(authCtx, req, client); break;
      case 'register': result = req.method === 'GET'
        ? await handleSlugCheck(req, client)
        : err('Org self-registration is disabled. Contact a super admin.', 410);
        break;
      default:
        result = err(`Unknown action '${action}'`);
    }

    return res.status(result.statusCode).send(result.body);
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[api/admin]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    await client.end();
  }
}

/**
 * scripts/migrate-to-clerk-orgs.mjs
 *
 * Plain JS version — run with:
 *   node scripts/migrate-to-clerk-orgs.mjs
 *
 * ENV REQUIRED (in .env.local):
 *   CLERK_SECRET_KEY
 *   DATABASE_URL  (or NEON_CONNECTION_STRING)
 *
 * WHAT IT DOES:
 *   1. For each approved org missing a clerk_org_id:
 *      - Creates (or finds) a Clerk org
 *      - Stores clerk_org_id in platform.orgs
 *   2. Migrates existing platform.org_members → Clerk org memberships
 *   3. Prints JWT template setup instructions
 *
 * IDEMPOTENT: safe to re-run.
 */

import { createClerkClient } from '@clerk/backend';
import pkg from 'pg';
const { Client } = pkg;

// ── Load .env.local manually (no dotenv needed) ───────────────────────────────
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('✓ Loaded .env.local\n');
} catch {
  console.log('ℹ No .env.local found — relying on shell environment\n');
}

// ── Validate env ─────────────────────────────────────────────────────────────
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DATABASE_URL     = process.env.DATABASE_URL
  || process.env.NEON_CONNECTION_STRING
  || process.env.NEON_POOLED_CONNECTION_STRING;

if (!CLERK_SECRET_KEY) {
  console.error('❌ CLERK_SECRET_KEY is not set. Check your .env.local');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Check your .env.local');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const db    = new Client({ connectionString: DATABASE_URL });

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await db.connect();
  console.log('✓ Connected to database\n');

  // ── 1. Get all approved orgs without a clerk_org_id ──────────────────────
  const { rows: orgs } = await db.query(
    `SELECT id, name, slug, plan, clerk_org_id
     FROM platform.orgs WHERE status='approved' ORDER BY created_at ASC`
  );

  if (orgs.length === 0) {
    console.log('No approved orgs found. Run the SQL migration first.');
    process.exit(0);
  }

  for (const org of orgs) {
    if (org.clerk_org_id) {
      console.log(`[SKIP] ${org.slug} — already has clerk_org_id: ${org.clerk_org_id}`);
      continue;
    }

    console.log(`\n[ORG] Processing: ${org.slug} (${org.name})`);

    // Check if a Clerk org with this slug already exists
    let clerkOrgId;
    try {
      // Search by name
      const list = await clerk.organizations.getOrganizationList({ query: org.name, limit: 20 });
      const match = list.data.find(o => o.slug === org.slug);

      if (match) {
        clerkOrgId = match.id;
        console.log(`  ↩ Found existing Clerk org: ${clerkOrgId}`);
      } else {
        const created = await clerk.organizations.createOrganization({
          name: org.name,
          slug: org.slug,
          publicMetadata: {
            slug:              org.slug,
            plan:              org.plan || 'free',
            schemaProvisioned: true,
            acceptingRequests: false,
          },
        });
        clerkOrgId = created.id;
        console.log(`  ✓ Created Clerk org: ${clerkOrgId}`);
      }
    } catch (e) {
      console.error(`  ✗ Failed to create/find Clerk org: ${e.message}`);
      continue;
    }

    // Store clerk_org_id
    await db.query(
      `UPDATE platform.orgs SET clerk_org_id=$1 WHERE id=$2`,
      [clerkOrgId, org.id]
    );
    console.log(`  ✓ Saved clerk_org_id to DB`);

    // ── 2. Migrate org_members → Clerk memberships ──────────────────────────
    let members = [];
    try {
      const result = await db.query(
        `SELECT user_id, role FROM platform.org_members WHERE org_id=$1`, [org.id]
      );
      members = result.rows;
      console.log(`  Found ${members.length} member(s) to migrate`);
    } catch (e) {
      if (/does not exist|undefined/i.test(e.message)) {
        console.log(`  ℹ platform.org_members not found — skipping member migration (already done?)`);
      } else {
        console.error(`  ✗ Error reading org_members: ${e.message}`);
      }
    }

    for (const member of members) {
      const clerkRole = (member.role === 'owner' || member.role === 'admin')
        ? 'org:admin'
        : 'org:member';

      try {
        await clerk.organizations.createOrganizationMembership({
          organizationId: clerkOrgId,
          userId:         member.user_id,
          role:           clerkRole,
        });
        console.log(`  ✓ Migrated ${member.user_id} → ${clerkRole}`);
      } catch (e) {
        if (/already a member/i.test(e.message)) {
          console.log(`  ~ Already a member: ${member.user_id}`);
        } else {
          console.error(`  ✗ Failed ${member.user_id}: ${e.message}`);
        }
      }
    }
  }

  await db.end();

  console.log('\n════════════════════════════════════════════════════');
  console.log('✅  Migration complete!');
  console.log('════════════════════════════════════════════════════');
  console.log('\n📌 NEXT STEPS — do these in Clerk Dashboard:\n');
  console.log('  1. Go to: Configure → Sessions → Edit default token');
  console.log('  2. Add this claim in the JSON editor:\n');
  console.log('     {\n       "org_slug": "{{org.publicMetadata.slug}}"\n     }\n');
  console.log('  3. Save → the frontend will now resolve org slugs from JWT');
  console.log('     (no extra DB lookup needed per request).\n');
  console.log('  4. Verify in Clerk Dashboard → Organizations that MQLC');
  console.log('     appears with the correct members.\n');
}

main().catch(e => {
  console.error('\n❌ Migration failed:', e.message);
  process.exit(1);
});

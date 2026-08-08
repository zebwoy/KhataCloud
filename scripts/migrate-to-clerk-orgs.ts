/**
 * scripts/migrate-to-clerk-orgs.ts
 *
 * ONE-TIME migration: creates Clerk org for MQLC and migrates existing
 * org_members to Clerk org membership.
 *
 * USAGE (run locally after deploying DB migration SQL):
 *   npx ts-node scripts/migrate-to-clerk-orgs.ts
 *
 * ENV REQUIRED:
 *   CLERK_SECRET_KEY
 *   DATABASE_URL (or NEON_CONNECTION_STRING)
 *
 * IDEMPOTENT: safe to re-run — skips if clerk_org_id already set.
 */

import { createClerkClient } from '@clerk/backend';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
const cs    = process.env.DATABASE_URL || process.env.NEON_CONNECTION_STRING!;

async function main() {
  const db = new Client({ connectionString: cs });
  await db.connect();

  try {
    // ── 1. Get all approved orgs that don't have a clerk_org_id yet ──────────
    const orgs = await db.query<{
      id: string; name: string; slug: string; plan: string; clerk_org_id: string | null;
    }>(
      `SELECT id, name, slug, plan, clerk_org_id FROM platform.orgs WHERE status='approved'`
    );

    for (const org of orgs.rows) {
      if (org.clerk_org_id) {
        console.log(`[SKIP] ${org.slug} — already has clerk_org_id: ${org.clerk_org_id}`);
        continue;
      }

      console.log(`\n[ORG] Creating Clerk org for: ${org.slug}`);

      // Check if a Clerk org with this slug already exists
      let clerkOrgId: string;
      try {
        const existing = await clerk.organizations.getOrganizationList({
          query: org.name,
          limit: 10,
        });
        const match = existing.data.find((o: any) => o.slug === org.slug);

        if (match) {
          clerkOrgId = match.id;
          console.log(`  Found existing Clerk org: ${clerkOrgId}`);
        } else {
          const created = await clerk.organizations.createOrganization({
            name: org.name,
            slug: org.slug,
            publicMetadata: {
              slug:              org.slug,
              plan:              org.plan,
              schemaProvisioned: true,
              acceptingRequests: false,
            },
          });
          clerkOrgId = created.id;
          console.log(`  Created new Clerk org: ${clerkOrgId}`);
        }
      } catch (e: any) {
        console.error(`  ERROR creating Clerk org: ${e.message}`);
        continue;
      }

      // Store clerk_org_id in our DB
      await db.query(
        `UPDATE platform.orgs SET clerk_org_id=$1 WHERE id=$2`,
        [clerkOrgId, org.id]
      );
      console.log(`  Stored clerk_org_id in platform.orgs`);

      // ── 2. Migrate existing org_members to Clerk org membership ─────────────
      let members: any[] = [];
      try {
        const membersResult = await db.query<{ user_id: string; role: string }>(
          `SELECT user_id, role FROM platform.org_members WHERE org_id=$1`, [org.id]
        );
        members = membersResult.rows;
      } catch (e: any) {
        // org_members table may already be dropped
        console.log(`  No org_members found (table may be dropped): ${e.message}`);
      }

      for (const member of members) {
        const clerkRole = member.role === 'owner' || member.role === 'admin'
          ? 'org:admin'
          : 'org:member';

        try {
          await clerk.organizations.createOrganizationMembership({
            organizationId: clerkOrgId,
            userId:         member.user_id,
            role:           clerkRole,
          });
          console.log(`  ✓ Migrated member ${member.user_id} → ${clerkRole}`);
        } catch (e: any) {
          if (/already a member/i.test(e.message)) {
            console.log(`  ~ Already member: ${member.user_id}`);
          } else {
            console.error(`  ✗ Failed to migrate ${member.user_id}: ${e.message}`);
          }
        }
      }
    }

    console.log('\n✅ Migration complete.');
    console.log('\n📌 NEXT STEPS (manual):');
    console.log('  1. Go to Clerk Dashboard → Configure → Sessions');
    console.log('  2. Edit the default JWT template');
    console.log('  3. Add these custom claims:');
    console.log('     {');
    console.log('       "org_slug": "{{org.publicMetadata.slug}}",');
    console.log('       "org_plan": "{{org.publicMetadata.plan}}"');
    console.log('     }');
    console.log('  4. Save and deploy');
    console.log('\n  After this, authHelper will resolve org slugs from the JWT');
    console.log('  without any DB lookup (faster + fewer connections).\n');

    // Optionally drop org_members (commented out for safety — do manually)
    // console.log('  5. Run: DROP TABLE platform.org_members;');

  } finally {
    await db.end();
  }
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});

/**
 * lib/auditHelper.ts — Org-scoped audit log writer
 *
 * Writes to org_{slug}.audit_log — each org's schema has its own audit table.
 * Super admin actions on an org are also logged to that org's audit log.
 * Called from any data-modifying API handler.
 */
import { Client } from 'pg';

export interface AuditEntry {
  orgSlug:     string;
  userId:      string;
  userRole:    string;    // 'org:admin' | 'org:member' | 'super_admin'
  action:      string;    // e.g. 'create_transaction', 'user_login', 'approve_join_request'
  // Actor identity — resolved at write-time so display never needs Clerk at read-time
  userName?:   string;    // display name of the actor
  userEmail?:  string;    // email of the actor
  // Target entity
  entityType?: string;    // e.g. 'transaction', 'member'
  entityId?:   string;    // Clerk user ID or DB row ID of the target
  targetName?:  string;   // resolved display name of the target user
  targetEmail?: string;   // resolved email of the target user
  // Session tracking
  pageTrail?:  string;    // hyphenated nav trail e.g. 'All Transactions - Reports - Admin'
  summary?:    string;    // human-readable description
  ipAddr?:     string;
}

/**
 * Write one audit entry to the org's schema audit_log table.
 * Best-effort — errors are logged but never thrown (never breaks the main operation).
 */
export async function logAudit(client: Client, entry: AuditEntry): Promise<void> {
  // Do not record audit log entries for admin users
  const role = (entry.userRole ?? '').toLowerCase();
  if (role === 'org:admin' || role === 'org_admin' || role === 'super_admin' || role === 'admin') {
    return;
  }

  const schemaName = `org_${entry.orgSlug.replace(/-/g, '_')}`;
  try {
    await client.query(
      `INSERT INTO ${schemaName}.audit_log
         (user_id, user_name, user_email, user_role,
          action, entity_type, entity_id,
          target_name, target_email, page_trail,
          summary, ip_addr)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        entry.userId,
        entry.userName   ?? null,
        entry.userEmail  ?? null,
        entry.userRole,
        entry.action,
        entry.entityType  ?? null,
        entry.entityId    ?? null,
        entry.targetName  ?? null,
        entry.targetEmail ?? null,
        entry.pageTrail   ?? null,
        entry.summary     ?? null,
        entry.ipAddr      ?? null,
      ]
    );
  } catch (e) {
    // Non-fatal — audit failure must never break the primary operation
    console.error('[auditHelper] Failed to write audit log:', e);
  }
}

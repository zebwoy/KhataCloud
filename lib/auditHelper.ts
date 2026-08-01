/**
 * lib/auditHelper.ts — Org-scoped audit log writer
 *
 * Writes to org_{slug}.audit_log — each org's schema has its own audit table.
 * Super admin actions on an org are also logged to that org's audit log.
 * Called from any data-modifying API handler.
 */
import { Client } from 'pg';

export interface AuditEntry {
  orgSlug:    string;
  userId:     string;
  userRole:   string;   // 'org:admin' | 'org:member' | 'super_admin'
  action:     string;   // e.g. 'create_transaction', 'delete_entity', 'approve_member'
  entityType?: string;  // e.g. 'transaction', 'entity', 'member'
  entityId?:   string;
  summary?:    string;  // human-readable description
  ipAddr?:     string;
}

/**
 * Write one audit entry to the org's schema audit_log table.
 * Best-effort — errors are logged but never thrown (never breaks the main operation).
 */
export async function logAudit(client: Client, entry: AuditEntry): Promise<void> {
  const schemaName = `org_${entry.orgSlug.replace(/-/g, '_')}`;
  try {
    await client.query(
      `INSERT INTO ${schemaName}.audit_log
         (user_id, user_role, action, entity_type, entity_id, summary, ip_addr)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId,
        entry.userRole,
        entry.action,
        entry.entityType ?? null,
        entry.entityId   ?? null,
        entry.summary    ?? null,
        entry.ipAddr     ?? null,
      ]
    );
  } catch (e) {
    // Non-fatal — audit failure must never break the primary operation
    console.error('[auditHelper] Failed to write audit log:', e);
  }
}

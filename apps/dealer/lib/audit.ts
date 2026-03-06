import { prisma } from "@/lib/db";

/** Keys redacted from audit metadata (PII and secrets). Never log token, email, phone, etc. */
const PII_KEYS = new Set([
  "ssn",
  "socialSecurityNumber",
  "dob",
  "dateOfBirth",
  "income",
  "email",
  "phone",
  "token",
]);

function sanitizeMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") return metadata;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const keyLower = k.toLowerCase();
    if (PII_KEYS.has(keyLower)) {
      out[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export type AuditLogParams = {
  dealershipId: string | null;
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only audit log. Never throws; log and continue.
 * Metadata is sanitized to remove PII (SSN, DOB, income, email, phone).
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  const metadata = sanitizeMetadata(params.metadata ?? null);
  try {
    await prisma.auditLog.create({
      data: {
        dealershipId: params.dealershipId,
        actorId: params.actorUserId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: metadata ? (metadata as object) : undefined,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}

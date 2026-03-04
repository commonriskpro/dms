import { prisma } from "@/lib/db";

export type PlatformAuditParams = {
  actorPlatformUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  requestId?: string | null;
  idempotencyKey?: string | null;
};

/**
 * Append-only platform audit log. Never throws; log and continue.
 */
export async function platformAuditLog(params: PlatformAuditParams): Promise<void> {
  try {
    await prisma.platformAuditLog.create({
      data: {
        actorPlatformUserId: params.actorPlatformUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? undefined,
        beforeState: params.beforeState ? (params.beforeState as object) : undefined,
        afterState: params.afterState ? (params.afterState as object) : undefined,
        reason: params.reason ?? undefined,
        requestId: params.requestId ?? undefined,
        idempotencyKey: params.idempotencyKey ?? undefined,
      },
    });
  } catch (err) {
    console.error("[platform-audit] failed to write:", err);
  }
}

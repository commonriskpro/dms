/**
 * Platform user management service. No route handlers; used by API routes only.
 * Uses apps/platform Prisma only. Enforces last-owner protection and audit.
 */

import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { PlatformApiError } from "@/lib/platform-auth";
import type { PlatformAuthUser } from "@/lib/platform-auth";

export type PlatformUserRow = {
  id: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
};

function toPublic(u: PlatformUserRow) {
  return {
    id: u.id,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    disabledAt: u.disabledAt?.toISOString() ?? null,
  };
}

/** Count active owners (role = PLATFORM_OWNER and not disabled). */
async function countActiveOwners(excludeUserId?: string): Promise<number> {
  const where: { role: "PLATFORM_OWNER"; disabledAt: null; id?: { not: string } } = {
    role: "PLATFORM_OWNER",
    disabledAt: null,
  };
  if (excludeUserId) where.id = { not: excludeUserId };
  return prisma.platformUser.count({ where });
}

const PLATFORM_ROLE_VALUES = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"] as const;

/** List platform users with pagination. Optional q: exact id match (UUID). Optional role filter. */
export async function listPlatformUsers(params: {
  limit: number;
  offset: number;
  q?: string;
  role?: string;
}): Promise<{ data: PlatformUserRow[]; total: number }> {
  const where: { id?: string; role?: (typeof PLATFORM_ROLE_VALUES)[number] } = {};
  if (params.q?.trim()) where.id = params.q.trim();
  if (params.role && PLATFORM_ROLE_VALUES.includes(params.role as (typeof PLATFORM_ROLE_VALUES)[number])) {
    where.role = params.role as (typeof PLATFORM_ROLE_VALUES)[number];
  }
  const [data, total] = await Promise.all([
    prisma.platformUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.platformUser.count({ where }),
  ]);
  return { data: data as PlatformUserRow[], total };
}

/** Get one platform user by id. Returns null if not found. */
export async function getPlatformUserById(id: string): Promise<PlatformUserRow | null> {
  const row = await prisma.platformUser.findUnique({
    where: { id },
  });
  return row as PlatformUserRow | null;
}

/** Create or upsert platform user. PLATFORM_OWNER only; caller must enforce. */
export async function upsertPlatformUser(
  actor: PlatformAuthUser,
  params: { id: string; role: string },
  options?: { requestId?: string | null }
): Promise<ReturnType<typeof toPublic>> {
  const existing = await prisma.platformUser.findUnique({ where: { id: params.id } });
  const beforeState = existing
    ? { role: existing.role, disabledAt: existing.disabledAt?.toISOString() ?? null }
    : null;
  const afterState = { role: params.role, disabledAt: null };

  const row = await prisma.platformUser.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      role: params.role as "PLATFORM_OWNER" | "PLATFORM_COMPLIANCE" | "PLATFORM_SUPPORT",
    },
    update: {
      role: params.role as "PLATFORM_OWNER" | "PLATFORM_COMPLIANCE" | "PLATFORM_SUPPORT",
      disabledAt: null,
    },
  });

  await platformAuditLog({
    actorPlatformUserId: actor.userId,
    action: existing ? "platform_user.upserted" : "platform_user.created",
    targetType: "platform_user",
    targetId: row.id,
    beforeState,
    afterState,
    requestId: options?.requestId ?? undefined,
  });

  return toPublic(row as PlatformUserRow);
}

/** Update role and/or disabled. Enforces last-owner protection. */
export async function updatePlatformUser(
  actor: PlatformAuthUser,
  id: string,
  params: { role?: string; disabled?: boolean },
  options?: { requestId?: string | null }
): Promise<ReturnType<typeof toPublic>> {
  const existing = await prisma.platformUser.findUnique({ where: { id } });
  if (!existing) {
    throw new PlatformApiError("NOT_FOUND", "Platform user not found", 404);
  }

  const isOwner = existing.role === "PLATFORM_OWNER";
  const willRemoveOwner =
    isOwner &&
    (params.role !== undefined && params.role !== "PLATFORM_OWNER" ||
     params.disabled === true);

  if (willRemoveOwner) {
    const otherOwners = await countActiveOwners(id);
    if (otherOwners < 1) {
      throw new PlatformApiError(
        "CONFLICT",
        "Cannot remove or demote the last platform owner.",
        409
      );
    }
  }

  const beforeState = {
    role: existing.role,
    disabledAt: existing.disabledAt?.toISOString() ?? null,
  };

  type UpdatePayload = {
    role?: "PLATFORM_OWNER" | "PLATFORM_COMPLIANCE" | "PLATFORM_SUPPORT";
    disabledAt?: Date | null;
  };
  const payload: UpdatePayload = {};
  if (params.role !== undefined) payload.role = params.role as UpdatePayload["role"];
  if (params.disabled !== undefined) payload.disabledAt = params.disabled ? new Date() : null;
  if (Object.keys(payload).length === 0) {
    return toPublic(existing as PlatformUserRow);
  }

  const updated = await prisma.platformUser.update({
    where: { id },
    data: payload,
  });

  const afterState = {
    role: updated.role,
    disabledAt: updated.disabledAt?.toISOString() ?? null,
  };

  let action = "platform_user.updated";
  if (params.role !== undefined && params.role !== existing.role) action = "platform_user.role_changed";
  else if (params.disabled === true) action = "platform_user.disabled";
  else if (params.disabled === false) action = "platform_user.enabled";

  await platformAuditLog({
    actorPlatformUserId: actor.userId,
    action,
    targetType: "platform_user",
    targetId: id,
    beforeState,
    afterState,
    requestId: options?.requestId ?? undefined,
  });

  return toPublic(updated as PlatformUserRow);
}

/** Delete platform user. Enforces last-owner protection. */
export async function deletePlatformUser(
  actor: PlatformAuthUser,
  id: string,
  options?: { requestId?: string | null }
): Promise<void> {
  const existing = await prisma.platformUser.findUnique({ where: { id } });
  if (!existing) {
    throw new PlatformApiError("NOT_FOUND", "Platform user not found", 404);
  }

  if (existing.role === "PLATFORM_OWNER") {
    const otherOwners = await countActiveOwners(id);
    if (otherOwners < 1) {
      throw new PlatformApiError(
        "CONFLICT",
        "Cannot remove or demote the last platform owner.",
        409
      );
    }
  }

  const beforeState = {
    role: existing.role,
    disabledAt: existing.disabledAt?.toISOString() ?? null,
  };

  await prisma.platformUser.delete({ where: { id } });

  await platformAuditLog({
    actorPlatformUserId: actor.userId,
    action: "platform_user.deleted",
    targetType: "platform_user",
    targetId: id,
    beforeState,
    afterState: null,
    requestId: options?.requestId ?? undefined,
  });
}

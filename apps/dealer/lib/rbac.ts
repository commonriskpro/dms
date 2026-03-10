import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { getOrSetRequestCacheValue, type RequestCache } from "@/lib/request-cache";

export type DealerAuthContext = {
  userId: string;
  dealershipId: string;
  roleIds: string[];
  roleKeys: string[];
  effectivePermissions: Set<string>;
};

type DealerAuthContextResolved = {
  userId: string;
  dealershipId: string;
  roleIds: string[];
  roleKeys: string[];
  effectivePermissions: Set<string>;
};

async function resolveDealerAuthContext(
  userId: string,
  dealershipId: string
): Promise<DealerAuthContextResolved> {
  const [userRoles, overrides, membership] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        userId,
        role: {
          dealershipId,
          deletedAt: null,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    }),
    prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: true },
    }),
    prisma.membership.findFirst({
      where: { userId, dealershipId, disabledAt: null },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    }),
  ]);

  const roleIds = userRoles.map((ur) => ur.roleId);
  const roleKeys = userRoles.map((ur) => ur.role.key).filter(Boolean) as string[];

  const baseKeys = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      baseKeys.add(rp.permission.key);
    }
  }
  if (baseKeys.size === 0 && membership?.role) {
    for (const rp of membership.role.rolePermissions) {
      baseKeys.add(rp.permission.key);
    }
    if (membership.roleId && !roleIds.includes(membership.roleId)) {
      roleIds.push(membership.roleId);
      if (membership.role.key) roleKeys.push(membership.role.key);
    }
  }

  const effective = new Set(baseKeys);
  for (const o of overrides) {
    const key = o.permission.key;
    if (o.enabled) {
      effective.add(key);
    } else {
      effective.delete(key);
    }
  }

  return {
    userId,
    dealershipId,
    roleIds,
    roleKeys,
    effectivePermissions: effective,
  };
}

/**
 * Get dealer auth context (server-only). Ensures session + user + active dealership,
 * then computes role union + overrides. Use requireUser + requireDealershipContext before calling.
 */
export async function getDealerAuthContext(
  userId: string,
  dealershipId: string,
  requestCache?: RequestCache
): Promise<DealerAuthContext> {
  const key = `rbac:dealer-auth:${userId}:${dealershipId}`;
  const resolved = await getOrSetRequestCacheValue(requestCache, key, () =>
    resolveDealerAuthContext(userId, dealershipId)
  );
  return {
    userId: resolved.userId,
    dealershipId: resolved.dealershipId,
    roleIds: [...resolved.roleIds],
    roleKeys: [...resolved.roleKeys],
    effectivePermissions: new Set(resolved.effectivePermissions),
  };
}

/**
 * Load effective permission keys for a user in a dealership.
 * Base = union of permissions from all assigned roles (UserRole; fallback to Membership.role).
 * Overrides: enabled=false removes, enabled=true adds.
 * Default deny: only keys in the result set are allowed.
 */
export async function loadUserPermissions(
  userId: string,
  dealershipId: string,
  requestCache?: RequestCache
): Promise<string[]> {
  const ctx = await getDealerAuthContext(userId, dealershipId, requestCache);
  return Array.from(ctx.effectivePermissions);
}

/**
 * Throws FORBIDDEN if user does not have the given permission in the dealership.
 */
export async function requirePermission(
  userId: string,
  dealershipId: string,
  permissionKey: string,
  requestCache?: RequestCache
): Promise<void> {
  const permissions = await loadUserPermissions(userId, dealershipId, requestCache);
  if (!permissions.includes(permissionKey)) {
    throw new ApiError("FORBIDDEN", "Insufficient permission");
  }
}

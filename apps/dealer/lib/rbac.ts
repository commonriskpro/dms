import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

/**
 * Load permission keys for a user in a dealership (via Membership -> Role -> RolePermission -> Permission).
 * In Next.js App Router route handlers, wrap with React cache() at call site for request deduplication.
 */
export async function loadUserPermissions(
  userId: string,
  dealershipId: string
): Promise<string[]> {
  const membership = await prisma.membership.findFirst({
    where: { userId, dealershipId, disabledAt: null },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  });
  if (!membership?.role) return [];
  const keys = membership.role.rolePermissions.map((rp) => rp.permission.key);
  return [...new Set(keys)];
}

/**
 * Throws FORBIDDEN if user does not have the given permission in the dealership.
 */
export async function requirePermission(
  userId: string,
  dealershipId: string,
  permissionKey: string
): Promise<void> {
  const permissions = await loadUserPermissions(userId, dealershipId);
  if (!permissions.includes(permissionKey)) {
    throw new ApiError("FORBIDDEN", "Insufficient permission");
  }
}

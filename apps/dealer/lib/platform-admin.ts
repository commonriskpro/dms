import { cache } from "react";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

/**
 * Returns true if the user is a platform admin (super admin).
 * Cached per request when used in the same request (e.g. session + tenant).
 */
export const isPlatformAdmin = cache(async (userId: string): Promise<boolean> => {
  const admin = await prisma.platformAdmin.findUnique({
    where: { userId },
    select: { id: true },
  });
  return admin != null;
});

/**
 * Requires platform admin; throws FORBIDDEN if not.
 */
export async function requirePlatformAdmin(userId: string): Promise<void> {
  const ok = await isPlatformAdmin(userId);
  if (!ok) {
    throw new ApiError("FORBIDDEN", "Platform admin access required");
  }
}

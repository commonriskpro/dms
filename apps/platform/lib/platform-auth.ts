import { cache } from "react";
import { prisma } from "./db";
import { createClient as createSupabaseServer } from "./supabase/server";

export class PlatformApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}

export type PlatformAuthUser = { userId: string; role: string };

const PLATFORM_USER_ID_COOKIE = "platform_user_id";

/**
 * In production: Supabase session only (no header/cookie). In dev: header/cookie only when
 * NODE_ENV !== "production" AND PLATFORM_USE_HEADER_AUTH === "true". No path bypasses Supabase in production.
 */
export async function getPlatformUserIdFromRequest(): Promise<string | null> {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.id) return null;
    return user.id;
  }

  // Header/cookie auth only when BOTH conditions hold; never in production (explicit guard)
  if (process.env.NODE_ENV !== "production" && process.env.PLATFORM_USE_HEADER_AUTH === "true") {
    const { headers, cookies } = await import("next/headers");
    const h = await headers();
    const id = h.get("x-platform-user-id");
    if (id) return id;
    const c = await cookies();
    const cookieId = c.get(PLATFORM_USER_ID_COOKIE)?.value;
    if (cookieId) return cookieId;
  }

  return null;
}

const getPlatformUserByUserId = cache(async (userId: string): Promise<PlatformAuthUser | null> => {
  const row = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!row) return null;
  return { userId: row.id, role: row.role };
});

/** Result for layout: user, null (unauthenticated), or forbidden (authenticated but not in platform_users). */
export type GetPlatformUserResult = PlatformAuthUser | null | { forbidden: true };

/** Returns current platform user, null if unauthenticated, or { forbidden: true } if authed but not in platform_users. */
export async function getPlatformUserOrNull(): Promise<GetPlatformUserResult> {
  const userId = await getPlatformUserIdFromRequest();
  if (!userId) return null;
  const user = await getPlatformUserByUserId(userId);
  if (user) return user;
  return { forbidden: true };
}

export async function requirePlatformAuth(): Promise<PlatformAuthUser> {
  const userId = await getPlatformUserIdFromRequest();
  if (!userId) {
    throw new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401);
  }
  const user = await getPlatformUserByUserId(userId);
  if (!user) {
    throw new PlatformApiError("FORBIDDEN", "Not authorized", 403);
  }
  return user;
}

const PLATFORM_OWNER = "PLATFORM_OWNER";
const PLATFORM_COMPLIANCE = "PLATFORM_COMPLIANCE";
const PLATFORM_SUPPORT = "PLATFORM_SUPPORT";

export type AllowedPlatformRole = typeof PLATFORM_OWNER | typeof PLATFORM_COMPLIANCE | typeof PLATFORM_SUPPORT;

export async function requirePlatformRole(
  user: PlatformAuthUser,
  allowedRoles: AllowedPlatformRole[]
): Promise<void> {
  if (!allowedRoles.includes(user.role as AllowedPlatformRole)) {
    throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
  }
}

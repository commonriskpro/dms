import { cache } from "react";
import { prisma } from "./db";
import { createPlatformSupabaseServerClient } from "./supabase/server";
import { getPlatformAuthDebug } from "./env";
import { logger } from "./logger";

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

export type PlatformAuthUser = { userId: string; role: string; emailVerified?: boolean };

const PLATFORM_USER_ID_COOKIE = "platform_user_id";

/**
 * Source of truth for platform auth user ID.
 * - Production: Supabase session only.
 * - Development: optional header/cookie override when PLATFORM_USE_HEADER_AUTH=true.
 *   If override is enabled but not present on the request, we still fall back to Supabase
 *   so real login flows work consistently across environments.
 */
function tail6(id: string | undefined | null): string | null {
  if (!id || id.length < 6) return null;
  return id.slice(-6);
}

export async function getPlatformUserIdFromRequest(): Promise<string | null> {
  const useDevHeaderAuth =
    process.env.NODE_ENV !== "production" && process.env.PLATFORM_USE_HEADER_AUTH === "true";
  if (useDevHeaderAuth) {
    const { headers, cookies } = await import("next/headers");
    const h = await headers();
    const id = h.get("x-platform-user-id");
    if (id) return id;
    const c = await cookies();
    const cookieId = c.get(PLATFORM_USER_ID_COOKIE)?.value;
    if (cookieId) return cookieId;
  }

  const debug = getPlatformAuthDebug();
  let cookieNames: string[] = [];
  let requestId: string | undefined;
  if (debug) {
    const { cookies: getCookies, headers: getHeaders } = await import("next/headers");
    const store = await getCookies();
    cookieNames = store.getAll().map((c) => c.name);
    const headers = await getHeaders();
    requestId = headers.get("x-request-id") ?? undefined;
  }

  const supabase = await createPlatformSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (debug) {
    logger.info("auth_debug", {
      step: "supabase_getUser",
      requestId,
      cookieNames,
      hasUser: !!user?.id,
      userIdTail: tail6(user?.id ?? null),
      error: error?.message ?? (error as { name?: string })?.name ?? undefined,
    });
  }
  if (error || !user?.id) return null;
  return user.id;
}

const getPlatformUserByUserId = cache(async (userId: string): Promise<Omit<PlatformAuthUser, "emailVerified"> | null> => {
  const row = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: { id: true, role: true, disabledAt: true },
  });
  if (!row || row.disabledAt != null) return null;
  return { userId: row.id, role: row.role };
});

/** Result for layout: user, null (unauthenticated), or forbidden (authenticated but not in platform_users). */
export type GetPlatformUserResult = PlatformAuthUser | null | { forbidden: true };

/** Returns current platform user, null if unauthenticated, or { forbidden: true } if authed but not in platform_users. */
export async function getPlatformUserOrNull(): Promise<GetPlatformUserResult> {
  const userId = await getPlatformUserIdFromRequest();
  if (!userId) return null;
  const user = await getPlatformUserByUserId(userId);
  if (getPlatformAuthDebug()) {
    logger.info("auth_debug", {
      step: "platformUser_lookup",
      platformUserFound: !!user,
      platformUserIdTail: user ? tail6(userId) : undefined,
      ...(!user ? { noPlatformUserRow: "NO_PLATFORM_USER_ROW" } : {}),
    });
  }
  if (!user) return { forbidden: true };
  const supabase = await createPlatformSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  const emailVerified = !!supabaseUser?.email_confirmed_at;
  return { ...user, emailVerified };
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

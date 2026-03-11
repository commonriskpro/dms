import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  ACTIVE_DEALERSHIP_COOKIE,
  ACTIVE_DEALERSHIP_MAX_AGE,
  decryptCookieValue,
  encryptCookieValue,
} from "@/lib/cookie";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import {
  getOrSetRequestCacheValue,
  getRequestCache,
  type RequestCache,
} from "@/lib/request-cache";

/**
 * Returns first active dealership id for user (used when no cookie, e.g. Bearer auth / mobile).
 */
export async function getFirstActiveDealershipIdForUser(
  userId: string,
  requestCache?: RequestCache
): Promise<string | null> {
  const key = `tenant:first-active:${userId}`;
  return getOrSetRequestCacheValue(requestCache, key, async () => {
    const membership = await prisma.membership.findFirst({
      where: { userId, disabledAt: null },
      select: { dealershipId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) return null;
    const dealership = await prisma.dealership.findUnique({
      where: { id: membership.dealershipId },
      select: { id: true, isActive: true, lifecycleStatus: true },
    });
    if (!dealership || dealership.lifecycleStatus === "CLOSED" || !dealership.isActive) {
      return null;
    }
    return dealership.id;
  });
}

/**
 * Validates that user has active membership for dealership and dealership is usable.
 * Returns dealership id if valid, null otherwise.
 */
async function validateMembershipAndDealership(
  userId: string,
  dealershipId: string,
  requestCache?: RequestCache
): Promise<string | null> {
  const key = `tenant:validate:${userId}:${dealershipId}`;
  return getOrSetRequestCacheValue(requestCache, key, async () => {
    const [membership, dealership] = await Promise.all([
      prisma.membership.findFirst({
        where: { userId, dealershipId, disabledAt: null },
        select: { id: true },
      }),
      prisma.dealership.findUnique({
        where: { id: dealershipId },
        select: { id: true, isActive: true, lifecycleStatus: true },
      }),
    ]);
    if (!membership) return null;
    if (!dealership || dealership.lifecycleStatus === "CLOSED") return null;
    if (!dealership.isActive) return null;
    return dealershipId;
  });
}

/**
 * Reads stored active dealership from UserActiveDealership and validates membership + dealership.
 * Returns dealership id or null.
 */
export async function getStoredActiveDealershipId(
  userId: string,
  requestCache?: RequestCache
): Promise<string | null> {
  const key = `tenant:stored-active:${userId}`;
  return getOrSetRequestCacheValue(requestCache, key, async () => {
    const row = await prisma.userActiveDealership.findUnique({
      where: { userId },
      select: { activeDealershipId: true },
    });
    if (!row) return null;
    return validateMembershipAndDealership(userId, row.activeDealershipId, requestCache);
  });
}

/**
 * Reads and validates active dealership from encrypted cookie, or (when request has Bearer and no cookie)
 * UserActiveDealership row then first active membership.
 * Returns null if cookie missing, invalid, or membership not active.
 * Clears cookie when membership is invalid.
 */
export async function getActiveDealershipId(
  userId: string,
  request?: NextRequest,
  requestCache?: RequestCache
): Promise<string | null> {
  const cache = requestCache ?? getRequestCache(request);
  const authHeader = request?.headers.get("authorization");
  const isBearer = authHeader?.startsWith("Bearer ");
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_DEALERSHIP_COOKIE)?.value;
  if (isBearer && !raw) {
    const stored = await getStoredActiveDealershipId(userId, cache);
    if (stored) return stored;
    const first = await getFirstActiveDealershipIdForUser(userId, cache);
    if (first) {
      await prisma.userActiveDealership.upsert({
        where: { userId },
        create: { userId, activeDealershipId: first },
        update: { activeDealershipId: first },
      });
      return first;
    }
    return null;
  }
  if (!raw) return null;
  const dealershipId = decryptCookieValue(raw);
  if (!dealershipId) {
    cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
    return null;
  }
  const membership = await getOrSetRequestCacheValue(
    cache,
    `tenant:membership:${userId}:${dealershipId}`,
    () =>
      prisma.membership.findFirst({
        where: {
          dealershipId,
          userId,
          disabledAt: null,
        },
        select: { id: true },
      })
  );
  if (membership) {
    const dealership = await getOrSetRequestCacheValue(
      cache,
      `tenant:dealership-state:${dealershipId}`,
      () =>
        prisma.dealership.findUnique({
          where: { id: dealershipId },
          select: { isActive: true, lifecycleStatus: true },
        })
    );
    if (!dealership) return null;
    if (dealership.lifecycleStatus === "CLOSED") {
      cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
      return null;
    }
    if (!dealership.isActive) {
      cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
      return null;
    }
    return dealershipId;
  }
  cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
  return null;
}

/**
 * Returns active dealership id or throws FORBIDDEN (no context or invalid membership).
 * Used by tenant routes (e.g. getAuthContext).
 * Pass request so Bearer auth (mobile) can resolve dealership from first active membership when no cookie.
 */
export async function requireDealershipContext(
  userId: string,
  request?: NextRequest,
  requestCache?: RequestCache
): Promise<string> {
  const dealershipId = await getActiveDealershipId(userId, request, requestCache);
  if (!dealershipId) {
    throw new ApiError("FORBIDDEN", "No active dealership or membership invalid");
  }
  return dealershipId;
}

/**
 * Persist active dealership for user (DB + cookie). Call after membership validation.
 * Use from POST /api/me/current-dealership and PATCH /api/auth/session/switch.
 */
export async function setActiveDealershipForUser(userId: string, dealershipId: string): Promise<void> {
  await prisma.userActiveDealership.upsert({
    where: { userId },
    create: { userId, activeDealershipId: dealershipId },
    update: { activeDealershipId: dealershipId },
  });
  await setActiveDealershipCookie(dealershipId);
}

/**
 * Set active dealership cookie. Call from PATCH /api/auth/session/switch (after membership check)
 * or other server-side flows that intentionally switch the active dealership after validation.
 */
export async function setActiveDealershipCookie(dealershipId: string): Promise<void> {
  const cookieStore = await cookies();
  const value = encryptCookieValue(dealershipId);
  const isProd = process.env.NODE_ENV === "production";
  cookieStore.set(ACTIVE_DEALERSHIP_COOKIE, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: ACTIVE_DEALERSHIP_MAX_AGE,
    path: "/",
  });
}

/**
 * Clear active dealership cookie (e.g. on logout).
 */
export async function clearActiveDealershipCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
}

type LifecycleStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

/**
 * Returns session dealership info for GET /api/auth/session: activeDealershipId, activeDealership,
 * lifecycleStatus, lastStatusReason (when stored), and closedDealership when CLOSED (cookie cleared).
 * Used only for session response; API auth still uses getActiveDealershipId.
 * lastStatusReason: from DB when column exists (SUSPENDED/CLOSED reason); null until then.
 */
export async function getSessionDealershipInfo(
  userId: string,
  requestCache?: RequestCache
): Promise<{
  activeDealershipId: string | null;
  activeDealership: { id: string; name: string } | null;
  lifecycleStatus: LifecycleStatus | null;
  lastStatusReason: string | null;
  closedDealership: { id: string; name: string } | null;
}> {
  const cache = requestCache;
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_DEALERSHIP_COOKIE)?.value;
  const empty = {
    activeDealershipId: null,
    activeDealership: null,
    lifecycleStatus: null,
    lastStatusReason: null as string | null,
    closedDealership: null,
  };
  if (!raw) return empty;

  return getOrSetRequestCacheValue(cache, `tenant:session-info:${userId}:${raw}`, async () => {
    const dealershipId = decryptCookieValue(raw);
    if (!dealershipId) {
      return empty;
    }
    const [dealership, membership] = await Promise.all([
      getOrSetRequestCacheValue(cache, `tenant:dealership-detail:${dealershipId}`, () =>
        prisma.dealership.findUnique({
          where: { id: dealershipId },
          select: { id: true, name: true, isActive: true, lifecycleStatus: true },
        })
      ),
      getOrSetRequestCacheValue(cache, `tenant:membership:${userId}:${dealershipId}`, () =>
        prisma.membership.findFirst({
          where: { dealershipId, userId, disabledAt: null },
          select: { id: true },
        })
      ),
    ]);
    if (!dealership) {
      return empty;
    }
    const lastStatusReason: string | null = null;
    if (dealership.lifecycleStatus === "CLOSED") {
      return {
        ...empty,
        lifecycleStatus: "CLOSED",
        lastStatusReason,
        closedDealership: { id: dealership.id, name: dealership.name },
      };
    }
    if (membership) {
      if (!dealership.isActive) {
        return empty;
      }
      return {
        activeDealershipId: dealershipId,
        activeDealership: { id: dealership.id, name: dealership.name },
        lifecycleStatus: dealership.lifecycleStatus as LifecycleStatus,
        lastStatusReason,
        closedDealership: null,
      };
    }
    return empty;
  });
}

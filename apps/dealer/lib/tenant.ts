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

/**
 * Returns first active dealership id for user (used when no cookie, e.g. Bearer auth / mobile).
 */
export async function getFirstActiveDealershipIdForUser(userId: string): Promise<string | null> {
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
}

/**
 * Reads and validates active dealership from encrypted cookie, or (when request has Bearer and no cookie) first active membership.
 * Returns null if cookie missing, invalid, or membership not active.
 * Clears cookie when membership is invalid.
 * When isPlatformAdmin is true: if cookie is set, returns dealershipId (impersonation) without membership check;
 * still validates that dealership exists and isActive (platform admin can impersonate disabled for viewing).
 */
export async function getActiveDealershipId(
  userId: string,
  isPlatformAdminUser?: boolean,
  request?: NextRequest
): Promise<string | null> {
  const authHeader = request?.headers.get("authorization");
  const isBearer = authHeader?.startsWith("Bearer ");
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_DEALERSHIP_COOKIE)?.value;
  if (isBearer && !raw) {
    return getFirstActiveDealershipIdForUser(userId);
  }
  if (!raw) return null;
  const dealershipId = decryptCookieValue(raw);
  if (!dealershipId) {
    cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
    return null;
  }
  const membership = await prisma.membership.findFirst({
    where: {
      dealershipId,
      userId,
      disabledAt: null,
    },
  });
  if (membership) {
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { isActive: true, lifecycleStatus: true },
    });
    if (!dealership) return null;
    if (dealership.lifecycleStatus === "CLOSED") {
      cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
      return null;
    }
    if (!dealership.isActive && !isPlatformAdminUser) {
      cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
      return null;
    }
    return dealershipId;
  }
  if (isPlatformAdminUser) {
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true, lifecycleStatus: true },
    });
    if (dealership && dealership.lifecycleStatus !== "CLOSED") return dealershipId;
    cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
    return null;
  }
  cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
  return null;
}

/**
 * Returns active dealership id or throws FORBIDDEN (no context or invalid membership).
 * Used by tenant routes (e.g. getAuthContext); does not pass isPlatformAdmin—membership required (no impersonation bypass).
 * Pass request so Bearer auth (mobile) can resolve dealership from first active membership when no cookie.
 */
export async function requireDealershipContext(
  userId: string,
  request?: NextRequest
): Promise<string> {
  const dealershipId = await getActiveDealershipId(userId, undefined, request);
  if (!dealershipId) {
    throw new ApiError("FORBIDDEN", "No active dealership or membership invalid");
  }
  return dealershipId;
}

/**
 * Set active dealership cookie. Call from PATCH /api/auth/session/switch (after membership check)
 * or POST /api/platform/impersonate (after platform admin + dealership existence check).
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

export type LifecycleStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

/**
 * Returns session dealership info for GET /api/auth/session: activeDealershipId, activeDealership,
 * lifecycleStatus, lastStatusReason (when stored), and closedDealership when CLOSED (cookie cleared).
 * Used only for session response; API auth still uses getActiveDealershipId.
 * lastStatusReason: from DB when column exists (SUSPENDED/CLOSED reason); null until then.
 */
export async function getSessionDealershipInfo(
  userId: string,
  isPlatformAdminUser?: boolean
): Promise<{
  activeDealershipId: string | null;
  activeDealership: { id: string; name: string } | null;
  lifecycleStatus: LifecycleStatus | null;
  lastStatusReason: string | null;
  closedDealership: { id: string; name: string } | null;
}> {
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
  const dealershipId = decryptCookieValue(raw);
  if (!dealershipId) {
    cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
    return empty;
  }
  const dealership = await prisma.dealership.findUnique({
    where: { id: dealershipId },
    select: { id: true, name: true, isActive: true, lifecycleStatus: true },
  });
  if (!dealership) {
    cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
    return empty;
  }
  const lastStatusReason: string | null = null;
  if (dealership.lifecycleStatus === "CLOSED") {
    cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
    return {
      ...empty,
      lifecycleStatus: "CLOSED",
      lastStatusReason,
      closedDealership: { id: dealership.id, name: dealership.name },
    };
  }
  const membership = await prisma.membership.findFirst({
    where: { dealershipId, userId, disabledAt: null },
  });
  if (membership) {
    if (!dealership.isActive && !isPlatformAdminUser) {
      cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
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
  if (isPlatformAdminUser) {
    return {
      activeDealershipId: dealershipId,
      activeDealership: { id: dealership.id, name: dealership.name },
      lifecycleStatus: dealership.lifecycleStatus as LifecycleStatus,
      lastStatusReason,
      closedDealership: null,
    };
  }
  cookieStore.delete(ACTIVE_DEALERSHIP_COOKIE);
  return empty;
}

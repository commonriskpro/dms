import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, getOrCreateProfile, requireUser, requireUserFromRequest } from "@/lib/auth";
import { requireDealershipContext, getActiveDealershipId, getSessionDealershipInfo } from "@/lib/tenant";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/db";
import { toErrorPayload } from "./errors";
import { ApiError } from "@/lib/auth";
import { z } from "zod";
import { captureApiException, type CaptureApiExceptionOpts } from "@/lib/monitoring/sentry";
import {
  SUPPORT_SESSION_COOKIE,
  decryptSupportSessionPayload,
} from "@/lib/cookie";

export type AuthContext = {
  userId: string;
  email: string;
  dealershipId: string;
  permissions: string[];
};

/**
 * Get auth context for routes that require both user and active dealership.
 * Supports cookie (web) or Authorization: Bearer <token> (mobile). Throws UNAUTHORIZED or FORBIDDEN on failure.
 * Does not use platform admin: active dealership is resolved from cookie + membership or (Bearer) first active membership.
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  const user = await requireUserFromRequest(request);
  const dealershipId = await requireDealershipContext(user.userId, request);
  const { loadUserPermissions } = await import("@/lib/rbac");
  const permissions = await loadUserPermissions(user.userId, dealershipId);
  return {
    userId: user.userId,
    email: user.email,
    dealershipId,
    permissions,
  };
}

/**
 * Read support-session cookie if present and valid (not expired). Returns null otherwise.
 */
async function getSupportSessionFromCookie(): Promise<{
  dealershipId: string;
  platformUserId: string;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SUPPORT_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const payload = decryptSupportSessionPayload(raw);
  if (!payload) return null;
  if (new Date(payload.expiresAt) <= new Date()) return null;
  return { dealershipId: payload.dealershipId, platformUserId: payload.platformUserId };
}

/**
 * Get session for GET /api/auth/session. Returns null if not authenticated.
 * Checks support-session cookie first; when valid returns session with isSupportSession: true.
 * Includes platformAdmin.isAdmin; when true, active dealership can be set via impersonation (cookie) without membership.
 * When activeDealershipId is null, includes pendingApproval (true when user has a PendingApproval row).
 */
export async function getSessionContextOrNull(): Promise<{
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  activeDealershipId: string | null;
  activeDealership: { id: string; name: string } | null;
  lifecycleStatus: "ACTIVE" | "SUSPENDED" | "CLOSED" | null;
  lastStatusReason: string | null;
  closedDealership: { id: string; name: string } | null;
  permissions: string[];
  platformAdmin: { isAdmin: boolean };
  pendingApproval: boolean;
  isSupportSession?: boolean;
  supportSessionPlatformUserId?: string;
} | null> {
  const supportSession = await getSupportSessionFromCookie();
  if (supportSession) {
    const dealership = await prisma.dealership.findUnique({
      where: { id: supportSession.dealershipId },
      select: { id: true, name: true, lifecycleStatus: true },
    });
    if (!dealership || dealership.lifecycleStatus === "CLOSED") return null;
    return {
      userId: "",
      email: "",
      fullName: null,
      avatarUrl: null,
      activeDealershipId: supportSession.dealershipId,
      activeDealership: { id: dealership.id, name: dealership.name },
      lifecycleStatus: dealership.lifecycleStatus as "ACTIVE" | "SUSPENDED" | "CLOSED",
      lastStatusReason: null,
      closedDealership: null,
      permissions: [],
      platformAdmin: { isAdmin: false },
      pendingApproval: false,
      isSupportSession: true,
      supportSessionPlatformUserId: supportSession.platformUserId,
    };
  }

  const user = await getCurrentUser();
  if (!user?.userId) return null;
  let profile = await prisma.profile.findUnique({
    where: { id: user.userId },
    select: { id: true, email: true, fullName: true, avatarUrl: true },
  });
  if (!profile) {
    profile = await getOrCreateProfile(user.userId, { email: user.email ?? undefined });
  }
  const platformAdminFlag = await isPlatformAdmin(profile.id);
  const dealershipInfo = await getSessionDealershipInfo(user.userId, platformAdminFlag);
  const { activeDealershipId, activeDealership, lifecycleStatus, lastStatusReason, closedDealership } =
    dealershipInfo;
  let permissions: string[] = [];
  if (activeDealershipId) {
    const { loadUserPermissions } = await import("@/lib/rbac");
    permissions = await loadUserPermissions(user.userId, activeDealershipId);
  }
  const pendingApprovalRow =
    activeDealershipId == null && closedDealership == null
      ? await prisma.pendingApproval.findUnique({ where: { userId: profile.id } })
      : null;
  const pendingApproval = pendingApprovalRow != null;

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    activeDealershipId,
    activeDealership,
    lifecycleStatus,
    lastStatusReason,
    closedDealership,
    permissions,
    platformAdmin: { isAdmin: platformAdminFlag },
    pendingApproval,
  };
}

/**
 * Require a permission; throws FORBIDDEN if missing.
 */
export async function guardPermission(ctx: AuthContext, permissionKey: string): Promise<void> {
  await requirePermission(ctx.userId, ctx.dealershipId, permissionKey);
}

/**
 * Require at least one of the given permissions; throws FORBIDDEN if none present.
 */
export async function guardAnyPermission(ctx: AuthContext, permissionKeys: string[]): Promise<void> {
  const perms = await loadUserPermissions(ctx.userId, ctx.dealershipId);
  const has = permissionKeys.some((k) => perms.includes(k));
  if (!has) {
    throw new ApiError("FORBIDDEN", "Insufficient permission");
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** Optional context for Sentry when handling API errors. Safe tags only; no body/headers. */
export type SentryApiContext = Partial<
  Omit<CaptureApiExceptionOpts, "app">
>;

export function handleApiError(e: unknown, sentryContext?: SentryApiContext): Response {
  captureApiException(e, { app: "dealer", ...sentryContext });
  const { status, body } = toErrorPayload(e);
  return Response.json(body, { status });
}

export function getRequestMeta(request: NextRequest): { ip?: string; userAgent?: string } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;
  return { ip, userAgent };
}

const uuidSchema = z.string().uuid();

export function parseUuidParam(value: string): string {
  return uuidSchema.parse(value);
}
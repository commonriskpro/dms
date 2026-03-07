import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/auth";
import { setActiveDealershipForUser } from "@/lib/tenant";
import { handleApiError, jsonResponse, getRequestMeta } from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

const bodySchema = z.object({ dealershipId: z.string().uuid() });

export async function PATCH(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "session_switch")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const user = await requireUserFromRequest(request);
    const body = await request.json();
    const { dealershipId } = bodySchema.parse(body);
    const membership = await prisma.membership.findFirst({
      where: { userId: user.userId, dealershipId, disabledAt: null },
    });
    if (!membership) {
      throw new ApiError("FORBIDDEN", "Not a member of this dealership");
    }
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true, name: true, lifecycleStatus: true, isActive: true },
    });
    if (!dealership || dealership.lifecycleStatus === "CLOSED" || !dealership.isActive) {
      throw new ApiError("FORBIDDEN", "Dealership not available");
    }
    const previousRow = await prisma.userActiveDealership.findUnique({
      where: { userId: user.userId },
      select: { activeDealershipId: true },
    });
    await setActiveDealershipForUser(user.userId, dealershipId);
    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId,
      actorUserId: user.userId,
      action: "auth.dealership_switched",
      entity: "UserActiveDealership",
      metadata: {
        previousDealershipId: previousRow?.activeDealershipId ?? undefined,
        newDealershipId: dealershipId,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const { loadUserPermissions } = await import("@/lib/rbac");
    const permissions = await loadUserPermissions(user.userId, dealershipId);
    const profile = await prisma.profile.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
    });
    return jsonResponse({
      user: profile
        ? {
            id: profile.id,
            email: profile.email,
            fullName: profile.fullName ?? undefined,
            avatarUrl: profile.avatarUrl ?? undefined,
          }
        : { id: user.userId, email: user.email },
      activeDealership: dealership ? { id: dealership.id, name: dealership.name } : null,
      permissions,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

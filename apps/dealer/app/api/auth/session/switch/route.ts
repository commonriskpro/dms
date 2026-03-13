import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/auth";
import { setActiveDealershipForUser } from "@/lib/tenant";
import { handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
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
    const body = await readSanitizedJson(request);
    const { dealershipId } = bodySchema.parse(body);
    const [membership, dealership, previousRow] = await Promise.all([
      prisma.membership.findFirst({
        where: { userId: user.userId, dealershipId, disabledAt: null },
        select: { id: true },
      }),
      prisma.dealership.findUnique({
        where: { id: dealershipId },
        select: { id: true, name: true, lifecycleStatus: true, isActive: true },
      }),
      prisma.userActiveDealership.findUnique({
        where: { userId: user.userId },
        select: { activeDealershipId: true },
      }),
    ]);
    if (!membership) {
      throw new ApiError("FORBIDDEN", "Not a member of this dealership");
    }
    if (!dealership || dealership.lifecycleStatus === "CLOSED" || !dealership.isActive) {
      throw new ApiError("FORBIDDEN", "Dealership not available");
    }
    await setActiveDealershipForUser(user.userId, dealershipId);
    const meta = getRequestMeta(request);
    const { loadUserPermissions } = await import("@/lib/rbac");
    const [permissions, profile] = await Promise.all([
      loadUserPermissions(user.userId, dealershipId),
      prisma.profile.findUnique({
        where: { id: user.userId },
        select: { id: true, email: true, fullName: true, avatarUrl: true },
      }),
    ]);
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

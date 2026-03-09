import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { setActiveDealershipCookie } from "@/lib/tenant";
import {
  getRequestMeta,
  handleApiError,
  parseUuidParam,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { impersonateBodySchema } from "../schemas";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const body = await request.json();
    const { dealershipId } = impersonateBodySchema.parse(body);
    parseUuidParam(dealershipId);
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true, name: true },
    });
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    await setActiveDealershipCookie(dealershipId);
    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: user.userId,
      action: "platform.impersonate.start",
      entity: "Dealership",
      entityId: dealershipId,
      metadata: { targetDealershipId: dealershipId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}

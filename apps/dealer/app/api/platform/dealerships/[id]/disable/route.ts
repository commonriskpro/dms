import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { handleApiError, jsonResponse, parseUuidParam } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const id = parseUuidParam((await params).id);
    const dealership = await prisma.dealership.findUnique({ where: { id } });
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    await prisma.$transaction([
      prisma.dealership.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.membership.updateMany({
        where: { dealershipId: id, disabledAt: null },
        data: { disabledAt: new Date(), disabledBy: user.userId },
      }),
    ]);
    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: user.userId,
      action: "platform.dealership.disabled",
      entity: "Dealership",
      entityId: id,
      metadata: {},
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}

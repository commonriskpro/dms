import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { platformProvisionDealershipRequestSchema } from "@dms/contracts";
import { callDealerProvision } from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const { id } = await params;
    const body = await request.json();
    const parsed = platformProvisionDealershipRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten());
    }
    const { idempotencyKey } = parsed.data;

    const d = await prisma.platformDealership.findUnique({
      where: { id },
      include: { mapping: true },
    });
    if (!d) {
      return errorResponse("NOT_FOUND", "Dealership not found", 404);
    }
    if (d.status !== "APPROVED") {
      return errorResponse(
        "INVALID_STATE",
        "Dealership must be APPROVED to provision",
        422
      );
    }
    if (d.mapping) {
      return errorResponse(
        "ALREADY_PROVISIONED",
        "Dealership already has a dealer mapping",
        422
      );
    }

    const beforeState = { status: d.status };
    await prisma.platformDealership.update({
      where: { id },
      data: { status: "PROVISIONING" },
    });

    const requestId = `provision-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const result = await callDealerProvision(
      id,
      d.legalName,
      d.displayName,
      d.planKey,
      (d.limits as Record<string, unknown>) ?? {},
      idempotencyKey,
      { jti: requestId }
    );

    if (!result.ok) {
      const details: { requestId: string; idempotencyKey: string; upstreamStatus?: number } = {
        requestId: result.jti,
        idempotencyKey,
      };
      if (typeof result.error.status === "number") details.upstreamStatus = result.error.status;
      await platformAuditLog({
        actorPlatformUserId: user.userId,
        action: "dealership.provision",
        targetType: "dealership",
        targetId: id,
        beforeState,
        afterState: { status: "PROVISIONING", dealerCallFailed: true, ...(typeof result.error.status === "number" && { upstreamStatus: result.error.status }) },
        requestId: result.jti,
        idempotencyKey,
      });
      await prisma.platformDealership.update({
        where: { id },
        data: { status: "APPROVED" },
      });
      return errorResponse(
        "DEALER_PROVISION_FAILED",
        "Dealer provisioning failed. Please try again.",
        502,
        details
      );
    }

    const { dealerDealershipId, provisionedAt } = result.data;
    await prisma.dealershipMapping.create({
      data: {
        platformDealershipId: id,
        dealerDealershipId,
        provisionedAt: new Date(provisionedAt),
      },
    });
    await prisma.platformDealership.update({
      where: { id },
      data: { status: "PROVISIONED" },
    });

    const afterState = {
      status: "PROVISIONED",
      dealerDealershipId,
      provisionedAt,
    };
    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "dealership.provision",
      targetType: "dealership",
      targetId: id,
      beforeState,
      afterState,
      requestId: result.jti,
      idempotencyKey,
    });

    return jsonResponse({
      status: "PROVISIONED",
      dealerDealershipId,
      provisionedAt,
      requestId: result.jti,
      idempotencyKey,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

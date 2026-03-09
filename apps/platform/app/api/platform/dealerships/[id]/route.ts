import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PLAN_KEY_ALLOWLIST = ["starter", "standard", "enterprise"] as const;

const patchDealershipBodySchema = z.object({
  planKey: z.enum(PLAN_KEY_ALLOWLIST).optional(),
  limits: z
    .record(z.union([z.number(), z.string(), z.boolean()]))
    .refine((o) => Object.keys(o).length <= 20, "At most 20 limit keys")
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);
    const { id } = await params;
    const d = await prisma.platformDealership.findUnique({
      where: { id },
      include: { mapping: true },
    });
    if (!d) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Dealership not found" } }, 404);
    }
    return jsonResponse({
      id: d.id,
      legalName: d.legalName,
      displayName: d.displayName,
      planKey: d.planKey,
      limits: d.limits,
      status: d.status,
      dealerDealershipId: d.mapping?.dealerDealershipId ?? undefined,
      provisionedAt: d.mapping?.provisionedAt?.toISOString(),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"]);

    const { id } = await params;
    const d = await prisma.platformDealership.findUnique({
      where: { id },
      select: { id: true, legalName: true, displayName: true, planKey: true, limits: true, status: true, updatedAt: true },
    });
    if (!d) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Dealership not found" } }, 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }
    const parsed = patchDealershipBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }
    const { planKey, limits } = parsed.data;
    if (planKey === undefined && limits === undefined) {
      return jsonResponse({
        id: d.id,
        displayName: d.displayName,
        planKey: d.planKey,
        limits: d.limits,
        updatedAt: d.updatedAt.toISOString(),
      });
    }

    const beforeState = { planKey: d.planKey, limits: d.limits as Record<string, unknown> | null };
    const updateData: { planKey?: string; limits?: object } = {};
    if (planKey !== undefined) updateData.planKey = planKey;
    if (limits !== undefined) updateData.limits = limits as object;

    const updated = await prisma.platformDealership.update({
      where: { id },
      data: updateData,
      select: { id: true, displayName: true, planKey: true, limits: true, updatedAt: true },
    });

    const afterState = { planKey: updated.planKey, limits: updated.limits as Record<string, unknown> | null };
    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "dealership.plan_updated",
      targetType: "platform_dealership",
      targetId: id,
      beforeState,
      afterState,
    });

    return jsonResponse({
      id: updated.id,
      displayName: updated.displayName,
      planKey: updated.planKey,
      limits: updated.limits,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import {
  listPlatformDealershipsQuerySchema,
  platformCreateDealershipRequestSchema,
} from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }

    const parsed = platformCreateDealershipRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const { legalName, displayName, planKey, limits } = parsed.data;

    const created = await prisma.platformDealership.create({
      data: {
        legalName,
        displayName,
        planKey,
        limits: limits ?? {},
        status: "APPROVED",
      },
    });

    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "dealership.created",
      targetType: "dealership",
      targetId: created.id,
      beforeState: null,
      afterState: { status: "APPROVED" },
    });

    return jsonResponse(
      {
        id: created.id,
        legalName: created.legalName,
        displayName: created.displayName,
        planKey: created.planKey,
        limits: created.limits as Record<string, unknown> | null,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
      201
    );
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);
    const { searchParams } = new URL(request.url);
    const { limit, offset, status } = listPlatformDealershipsQuerySchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      status: searchParams.get("status") ?? undefined,
    });
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.platformDealership.findMany({
        where,
        include: { mapping: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.platformDealership.count({ where }),
    ]);
    return jsonResponse({
      data: items.map((d: { id: string; legalName: string; displayName: string; planKey: string; limits: unknown; status: string; createdAt: Date; mapping?: { dealerDealershipId: string; provisionedAt: Date } | null }) => ({
        id: d.id,
        legalName: d.legalName,
        displayName: d.displayName,
        planKey: d.planKey,
        limits: d.limits,
        status: d.status,
        dealerDealershipId: d.mapping?.dealerDealershipId ?? undefined,
        provisionedAt: d.mapping?.provisionedAt?.toISOString(),
        createdAt: d.createdAt.toISOString(),
      })),
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

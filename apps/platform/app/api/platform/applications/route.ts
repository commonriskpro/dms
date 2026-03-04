import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import {
  applicationCreateRequestSchema,
  listApplicationsQuerySchema,
} from "@dms/contracts";
import { APPLICATION_STATUS } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"]);
    const body = await request.json();
    const parsed = applicationCreateRequestSchema.parse(body);
    const app = await prisma.application.create({
      data: {
        status: "APPLIED",
        legalName: parsed.legalName,
        displayName: parsed.displayName,
        contactEmail: parsed.contactEmail,
        contactPhone: parsed.contactPhone ?? null,
        notes: parsed.notes ?? null,
      },
    });
    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "application.created",
      targetType: "application",
      targetId: app.id,
      afterState: { status: app.status },
    });
    return jsonResponse(
      {
        id: app.id,
        status: app.status,
        legalName: app.legalName,
        displayName: app.displayName,
        contactEmail: app.contactEmail,
        createdAt: app.createdAt.toISOString(),
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
    const { limit, offset, status } = listApplicationsQuerySchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      status: searchParams.get("status") ?? undefined,
    });
    const where = status ? { status: status as (typeof APPLICATION_STATUS)[number] } : {};
    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          status: true,
          legalName: true,
          displayName: true,
          contactEmail: true,
          dealershipId: true,
          createdAt: true,
        },
      }),
      prisma.application.count({ where }),
    ]);
    return jsonResponse({
      data: items.map((a) => ({
        id: a.id,
        status: a.status,
        legalName: a.legalName,
        displayName: a.displayName,
        contactEmail: a.contactEmail,
        dealershipId: a.dealershipId ?? undefined,
        createdAt: a.createdAt.toISOString(),
      })),
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

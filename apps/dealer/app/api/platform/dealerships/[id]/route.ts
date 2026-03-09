import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  getRequestMeta,
  handleApiError,
  jsonResponse,
  parseUuidParam,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { patchDealershipBodySchema } from "../../schemas";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const id = parseUuidParam((await params).id);
    const dealership = await prisma.dealership.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { locations: true, memberships: true } },
      },
    });
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    const { _count, ...rest } = dealership;
    return jsonResponse({
      ...rest,
      slug: rest.slug ?? undefined,
      locationsCount: _count.locations,
      membersCount: _count.memberships,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const id = parseUuidParam((await params).id);
    const body = await request.json();
    const data = patchDealershipBodySchema.parse(body);
    const dealership = await prisma.dealership.findUnique({ where: { id } });
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    const updated = await prisma.dealership.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: user.userId,
      action: "platform.dealership.updated",
      entity: "Dealership",
      entityId: updated.id,
      metadata: { name: updated.name, slug: updated.slug, isActive: updated.isActive },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonResponse({
      id: updated.id,
      name: updated.name,
      slug: updated.slug ?? undefined,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  getRequestMeta,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { listDealershipsQuerySchema, createDealershipBodySchema } from "../schemas";
import { auditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const { searchParams } = new URL(request.url);
    const { limit, offset, search } = listDealershipsQuerySchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      search: searchParams.get("search") ?? undefined,
    });
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [dealerships, total] = await Promise.all([
      prisma.dealership.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          createdAt: true,
          _count: { select: { locations: true, memberships: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.dealership.count({ where }),
    ]);
    return jsonResponse({
      data: dealerships.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug ?? undefined,
        isActive: d.isActive,
        createdAt: d.createdAt,
        locationsCount: d._count.locations,
        membersCount: d._count.memberships,
      })),
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const body = await request.json();
    const { name, slug, createDefaultLocation } = createDealershipBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const existing = slug ? await prisma.dealership.findUnique({ where: { slug } }) : null;
    if (existing) {
      const { ApiError } = await import("@/lib/auth");
      throw new ApiError("CONFLICT", "Dealership with this slug already exists");
    }
    const dealership = await prisma.dealership.create({
      data: {
        name,
        slug: slug ?? null,
        ...(createDefaultLocation && {
          locations: {
            create: { name: "Main", isPrimary: true },
          },
        }),
      },
      include: { locations: true },
    });
    await auditLog({
      dealershipId: null,
      actorUserId: user.userId,
      action: "platform.dealership.created",
      entity: "Dealership",
      entityId: dealership.id,
      metadata: { name, slug: slug ?? null },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonResponse(
      {
        id: dealership.id,
        name: dealership.name,
        slug: dealership.slug ?? undefined,
        isActive: dealership.isActive,
        createdAt: dealership.createdAt,
        locations: dealership.locations.map((l) => ({
          id: l.id,
          name: l.name,
          isPrimary: l.isPrimary,
        })),
      },
      201
    );
  } catch (e) {
    return handleApiError(e);
  }
}

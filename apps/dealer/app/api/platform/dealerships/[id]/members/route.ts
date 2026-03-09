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
import { listMembersQuerySchema, addMemberBodySchema } from "../../../schemas";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const dealershipId = parseUuidParam((await params).id);
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true },
    });
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    const { searchParams } = new URL(request.url);
    const { limit, offset } = listMembersQuerySchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });
    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where: { dealershipId },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          role: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.membership.count({ where: { dealershipId } }),
    ]);
    return jsonResponse({
      data: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        fullName: m.user.fullName ?? undefined,
        roleId: m.roleId,
        roleName: m.role.name,
        disabledAt: m.disabledAt ?? undefined,
        createdAt: m.createdAt,
      })),
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const dealershipId = parseUuidParam((await params).id);
    const body = await request.json();
    const { email, roleId } = addMemberBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const [dealership, role, profile] = await Promise.all([
      prisma.dealership.findUnique({
        where: { id: dealershipId },
        select: { id: true },
      }),
      prisma.role.findFirst({
        where: { id: roleId, dealershipId, deletedAt: null },
        select: { id: true },
      }),
      prisma.profile.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      }),
    ]);
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    if (!role) throw new ApiError("NOT_FOUND", "Role not found in this dealership");
    if (!profile) throw new ApiError("NOT_FOUND", "No profile found for this email");
    const existing = await prisma.membership.findFirst({
      where: { dealershipId, userId: profile.id, disabledAt: null },
      select: { id: true },
    });
    if (existing) throw new ApiError("CONFLICT", "User is already a member");
    const membership = await prisma.membership.create({
      data: {
        dealershipId,
        userId: profile.id,
        roleId,
        invitedBy: user.userId,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });
    await prisma.pendingApproval.deleteMany({ where: { userId: profile.id } });
    await auditLog({
      dealershipId: null,
      actorUserId: user.userId,
      action: "platform.membership.created",
      entity: "Membership",
      entityId: membership.id,
      metadata: { dealershipId, userId: profile.id, roleId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonResponse(
      {
        id: membership.id,
        dealershipId,
        userId: profile.id,
        roleId,
        createdAt: membership.createdAt,
      },
      201
    );
  } catch (e) {
    return handleApiError(e);
  }
}

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { handleApiError, jsonResponse, parseUuidParam } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { patchMembershipBodySchema } from "../../../../schemas";
import { auditLog } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const { id: dealershipId, membershipId } = await params;
    const did = parseUuidParam(dealershipId);
    const mid = parseUuidParam(membershipId);
    const body = await request.json();
    const data = patchMembershipBodySchema.parse(body);
    const membership = await prisma.membership.findFirst({
      where: { id: mid, dealershipId: did },
      select: { id: true, roleId: true, disabledAt: true },
    });
    if (!membership) throw new ApiError("NOT_FOUND", "Membership not found");
    const meta = getRequestMeta(request);
    if (data.roleId !== undefined && data.roleId !== membership.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: data.roleId, dealershipId: did, deletedAt: null },
        select: { id: true },
      });
      if (!role) throw new ApiError("NOT_FOUND", "Role not found in this dealership");
      await prisma.membership.update({
        where: { id: mid },
        data: { roleId: data.roleId },
      });
      await auditLog({
        dealershipId: null,
        actorUserId: user.userId,
        action: "platform.membership.updated",
        entity: "Membership",
        entityId: mid,
        metadata: { roleId: data.roleId },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
    if (data.disabled !== undefined) {
      if (data.disabled && !membership.disabledAt) {
        await prisma.membership.update({
          where: { id: mid },
          data: { disabledAt: new Date(), disabledBy: user.userId },
        });
        await auditLog({
          dealershipId: null,
          actorUserId: user.userId,
          action: "platform.membership.disabled",
          entity: "Membership",
          entityId: mid,
          metadata: {},
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } else if (!data.disabled && membership.disabledAt) {
        await prisma.membership.update({
          where: { id: mid },
          data: { disabledAt: null, disabledBy: null },
        });
        await auditLog({
          dealershipId: null,
          actorUserId: user.userId,
          action: "platform.membership.enabled",
          entity: "Membership",
          entityId: mid,
          metadata: {},
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
    }
    const updated = await prisma.membership.findUnique({
      where: { id: mid },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        role: { select: { id: true, name: true } },
      },
    });
    return jsonResponse({
      id: updated!.id,
      userId: updated!.userId,
      email: updated!.user.email,
      fullName: updated!.user.fullName ?? undefined,
      roleId: updated!.roleId,
      roleName: updated!.role.name,
      disabledAt: updated!.disabledAt ?? undefined,
      createdAt: updated!.createdAt,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

import { prisma } from "@/lib/db";

export async function listMemberships(
  dealershipId: string,
  options: {
    limit: number;
    offset: number;
    roleId?: string;
    status?: "active" | "disabled";
  }
) {
  const where = {
    dealershipId,
    ...(options.roleId && { roleId: options.roleId }),
    ...(options.status === "active" && { disabledAt: null }),
    ...(options.status === "disabled" && { disabledAt: { not: null } }),
  };
  const [data, total] = await Promise.all([
    prisma.membership.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        role: { select: { id: true, name: true } },
      },
    }),
    prisma.membership.count({ where }),
  ]);
  return { data, total };
}

export async function getMembershipById(dealershipId: string, id: string) {
  return prisma.membership.findFirst({
    where: { id, dealershipId },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      role: { select: { id: true, name: true, isSystem: true } },
    },
  });
}

export async function getActiveMembership(userId: string, dealershipId: string) {
  return prisma.membership.findFirst({
    where: { userId, dealershipId, disabledAt: null },
    include: { role: true },
  });
}

export async function getMembershipByUserId(dealershipId: string, userId: string) {
  return prisma.membership.findFirst({
    where: { userId, dealershipId },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      role: { select: { id: true, name: true, key: true, isSystem: true } },
    },
  });
}

export async function createMembership(data: {
  dealershipId: string;
  userId: string;
  roleId: string;
  invitedBy?: string | null;
  invitedAt?: Date | null;
  joinedAt?: Date | null;
  inviteId?: string | null;
}) {
  return prisma.membership.create({
    data: {
      dealershipId: data.dealershipId,
      userId: data.userId,
      roleId: data.roleId,
      invitedBy: data.invitedBy ?? null,
      invitedAt: data.invitedAt ?? null,
      joinedAt: data.joinedAt ?? null,
      inviteId: data.inviteId ?? null,
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function updateMembershipRole(dealershipId: string, id: string, roleId: string) {
  return prisma.membership.updateMany({
    where: { id, dealershipId },
    data: { roleId },
  });
}

export async function disableMembership(dealershipId: string, id: string, disabledBy: string) {
  return prisma.membership.updateMany({
    where: { id, dealershipId },
    data: { disabledAt: new Date(), disabledBy },
  });
}

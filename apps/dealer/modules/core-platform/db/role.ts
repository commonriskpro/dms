import { prisma } from "@/lib/db";

export async function listRoles(
  dealershipId: string,
  options: { limit: number; offset: number; includeSystem?: boolean }
) {
  const where = {
    dealershipId,
    ...(options.includeSystem === false ? { isSystem: false } : {}),
    deletedAt: null,
  };
  const [data, total] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy: { name: "asc" },
      take: options.limit,
      skip: options.offset,
      include: { rolePermissions: { include: { permission: true } } },
    }),
    prisma.role.count({ where }),
  ]);
  return { data, total };
}

export async function getRoleById(dealershipId: string, id: string) {
  return prisma.role.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function getRoleByName(dealershipId: string, name: string) {
  return prisma.role.findFirst({
    where: { dealershipId, name, deletedAt: null },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function createRole(
  dealershipId: string,
  data: { name: string; isSystem?: boolean; permissionIds: string[] }
) {
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        dealershipId,
        name: data.name,
        isSystem: data.isSystem ?? false,
      },
    });
    if (data.permissionIds.length) {
      await tx.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
    return tx.role.findUniqueOrThrow({
      where: { id: role.id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  });
}

export async function updateRole(
  dealershipId: string,
  id: string,
  data: { name?: string; permissionIds?: string[] }
) {
  return prisma.$transaction(async (tx) => {
    if (data.name !== undefined) {
      await tx.role.updateMany({ where: { id, dealershipId }, data: { name: data.name } });
    }
    if (data.permissionIds !== undefined) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (data.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
    }
    return tx.role.findFirstOrThrow({
      where: { id, dealershipId },
      include: { rolePermissions: { include: { permission: true } } },
    });
  });
}

export async function softDeleteRole(dealershipId: string, id: string, deletedBy: string) {
  return prisma.role.updateMany({
    where: { id, dealershipId, isSystem: false },
    data: { deletedAt: new Date(), deletedBy },
  });
}

export async function countMembersWithRole(roleId: string): Promise<number> {
  return prisma.membership.count({
    where: { roleId, disabledAt: null },
  });
}

import { prisma } from "@/lib/db";

export type PendingApprovalFilters = {
  search?: string;
};

export type PendingListPagination = {
  limit: number;
  offset: number;
};

export async function listPendingApprovals(
  filters: PendingApprovalFilters,
  pagination: PendingListPagination
) {
  const where = filters.search
    ? { email: { contains: filters.search, mode: "insensitive" as const } }
    : {};
  const [data, total] = await Promise.all([
    prisma.pendingApproval.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pagination.limit,
      skip: pagination.offset,
      select: {
        id: true,
        userId: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.pendingApproval.count({ where }),
  ]);
  return { data, total };
}

export async function createPendingApproval(userId: string, email: string) {
  return prisma.pendingApproval.create({
    data: {
      userId,
      email: email.toLowerCase(),
    },
  });
}

export async function deletePendingApproval(userId: string) {
  return prisma.pendingApproval.deleteMany({
    where: { userId },
  });
}

export async function getPendingByUserId(userId: string) {
  return prisma.pendingApproval.findUnique({
    where: { userId },
  });
}

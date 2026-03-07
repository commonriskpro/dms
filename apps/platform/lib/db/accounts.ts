import { prisma } from "@/lib/db";
import type { PlatformAccountStatus } from "@prisma/client";

export async function createPlatformAccount(data: {
  name: string;
  email: string;
  status?: PlatformAccountStatus;
}) {
  return prisma.platformAccount.create({
    data: {
      name: data.name,
      email: data.email,
      status: data.status ?? "ACTIVE",
    },
  });
}

export async function getPlatformAccountById(id: string) {
  return prisma.platformAccount.findUnique({
    where: { id },
    include: { dealerships: { select: { id: true, displayName: true, status: true } } },
  });
}

export async function listPlatformAccounts(options: { limit: number; offset: number; status?: PlatformAccountStatus }) {
  const { limit, offset, status } = options;
  const where = status ? { status } : {};
  const [data, total] = await Promise.all([
    prisma.platformAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.platformAccount.count({ where }),
  ]);
  return { data, total };
}

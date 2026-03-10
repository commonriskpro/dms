import { prisma } from "@/lib/db";
import type { PlatformAccountStatus } from "../../../node_modules/.prisma/platform-client";

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

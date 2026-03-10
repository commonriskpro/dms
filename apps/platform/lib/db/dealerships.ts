import { prisma } from "@/lib/db";
import type { PlatformDealershipStatus } from "../../../node_modules/.prisma/platform-client";

export async function getDealershipBySlug(slug: string) {
  return prisma.platformDealership.findUnique({
    where: { slug },
    include: { mapping: true, subscription: true },
  });
}

export async function listDealerships(options: {
  limit: number;
  offset: number;
  status?: PlatformDealershipStatus;
  platformAccountId?: string;
}) {
  const { limit, offset, status, platformAccountId } = options;
  const where: { status?: PlatformDealershipStatus; platformAccountId?: string } = {};
  if (status) where.status = status;
  if (platformAccountId) where.platformAccountId = platformAccountId;
  const [data, total] = await Promise.all([
    prisma.platformDealership.findMany({
      where,
      include: { mapping: true, subscription: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.platformDealership.count({ where }),
  ]);
  return { data, total };
}

import { prisma } from "@/lib/db";
import type { DealershipLifecycleStatus } from "@prisma/client";

export async function getDealershipById(id: string) {
  return prisma.dealership.findUnique({
    where: { id },
    include: { locations: true },
  });
}

export async function getDealershipBySlug(slug: string) {
  return prisma.dealership.findFirst({
    where: { slug },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function getDealershipLifecycleSummary(id: string) {
  return prisma.dealership.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, isActive: true, lifecycleStatus: true },
  });
}

export async function listAllDealershipIds() {
  const rows = await prisma.dealership.findMany({
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function updateDealership(
  id: string,
  data: { name?: string; slug?: string | null; settings?: object }
) {
  return prisma.dealership.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.settings !== undefined && { settings: data.settings as object }),
    },
  });
}

export async function updateDealershipLifecycleStatus(
  id: string,
  lifecycleStatus: DealershipLifecycleStatus
) {
  return prisma.dealership.update({
    where: { id },
    data: { lifecycleStatus, updatedAt: new Date() },
  });
}

import { prisma } from "@/lib/db";

export async function getDealershipById(id: string) {
  return prisma.dealership.findUnique({
    where: { id },
    include: { locations: true },
  });
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

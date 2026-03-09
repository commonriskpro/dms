import { prisma } from "@/lib/db";

export async function listTaxProfiles(dealershipId: string) {
  return prisma.taxProfile.findMany({
    where: { dealershipId },
    orderBy: { name: "asc" },
  });
}

export async function getTaxProfileById(dealershipId: string, id: string) {
  return prisma.taxProfile.findFirst({
    where: { id, dealershipId },
  });
}

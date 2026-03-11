import { prisma } from "@/lib/db";

export async function listChecklistItems(dealershipId: string, dealId: string) {
  return prisma.dealDmvChecklistItem.findMany({
    where: { dealershipId, dealId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createChecklistItems(
  dealershipId: string,
  dealId: string,
  labels: string[]
) {
  if (labels.length === 0) return [];
  return prisma.dealDmvChecklistItem.createManyAndReturn({
    data: labels.map((label) => ({ dealershipId, dealId, label })),
  });
}

export async function getChecklistItemById(dealershipId: string, itemId: string) {
  return prisma.dealDmvChecklistItem.findFirst({
    where: { id: itemId, dealershipId },
  });
}

export async function toggleChecklistItem(
  dealershipId: string,
  itemId: string,
  completed: boolean
) {
  const existing = await prisma.dealDmvChecklistItem.findFirst({
    where: { id: itemId, dealershipId },
  });
  if (!existing) return null;
  return prisma.dealDmvChecklistItem.update({
    where: { id: itemId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });
}

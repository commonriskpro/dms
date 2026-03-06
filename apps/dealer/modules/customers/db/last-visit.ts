import { prisma } from "@/lib/db";

/**
 * Update customer lastVisitAt and lastVisitByUserId. Scoped by dealershipId and customer id.
 */
export async function updateLastVisit(
  dealershipId: string,
  customerId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.customer.updateMany({
    where: { id: customerId, dealershipId },
    data: {
      lastVisitAt: new Date(),
      lastVisitByUserId: userId,
    },
  });
  return result.count > 0;
}

import { registerListener } from "@/lib/infrastructure/events/eventBus";
import { prisma } from "@/lib/db";

registerListener("deal.status_changed", async (payload) => {
  if (payload.to !== "CANCELED") return;
  await prisma.financeSubmission.updateMany({
    where: { dealId: payload.dealId, dealershipId: payload.dealershipId },
    data: { status: "CANCELED", fundingStatus: "CANCELED" },
  });
});

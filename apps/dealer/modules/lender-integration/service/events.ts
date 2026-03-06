import { register } from "@/lib/events";
import { prisma } from "@/lib/db";

type DealStatusChangedPayload = { dealId: string; dealershipId: string; toStatus: string };

register<DealStatusChangedPayload>("deal.status_changed", async (payload) => {
  if (payload.toStatus !== "CANCELED") return;
  await prisma.financeSubmission.updateMany({
    where: { dealId: payload.dealId, dealershipId: payload.dealershipId },
    data: { status: "CANCELED", fundingStatus: "CANCELED" },
  });
});

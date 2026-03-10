/**
 * Deal pipeline for inventory dashboard: leads, appointments, working deals, pending funding, sold today.
 * All queries scoped by dealershipId and deletedAt null.
 */
import * as dealDb from "../db/deal";
import * as customersDb from "@/modules/customers/db/customers";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { pipelineKey } from "@/lib/infrastructure/cache/cacheKeys";

export type DealPipelineStages = {
  leads: number;
  appointments: number;
  workingDeals: number;
  pendingFunding: number;
  soldToday: number;
};

export async function getDealPipeline(
  dealershipId: string,
  options?: { skipTenantCheck?: boolean }
): Promise<DealPipelineStages> {
  if (!options?.skipTenantCheck) {
    await requireTenantActiveForRead(dealershipId);
  }
  return withCache(pipelineKey(dealershipId), 30, async () => {
    const [leads, workingDeals, pendingFunding, soldToday] = await Promise.all([
      customersDb.countCustomersByStatus(dealershipId, "LEAD"),
      dealDb.countDealsByStatuses(dealershipId, ["DRAFT", "STRUCTURED"]),
      dealDb.countDealsByStatuses(dealershipId, ["APPROVED"]),
      dealDb.countDealsContractedToday(dealershipId),
    ]);
    return {
      leads,
      appointments: 0, // no CRM stage mapping; use Stage names in future if needed
      workingDeals,
      pendingFunding,
      soldToday,
    };
  });
}

/**
 * Deal pipeline for inventory dashboard: leads, appointments, working deals, pending funding, sold today.
 * All queries scoped by dealershipId and deletedAt null.
 */
import * as dealDb from "../db/deal";
import * as customersDb from "@/modules/customers/db/customers";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

export type DealPipelineStages = {
  leads: number;
  appointments: number;
  workingDeals: number;
  pendingFunding: number;
  soldToday: number;
};

export async function getDealPipeline(dealershipId: string): Promise<DealPipelineStages> {
  await requireTenantActiveForRead(dealershipId);
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
}

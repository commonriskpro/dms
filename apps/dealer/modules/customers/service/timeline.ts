import * as customersDb from "../db/customers";
import * as timelineDb from "../db/timeline";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import type { TimelineEventType } from "../db/timeline";

export type TimelineListOptions = {
  limit: number;
  offset: number;
  type?: TimelineEventType;
};

export async function listTimeline(
  dealershipId: string,
  customerId: string,
  options: TimelineListOptions
) {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return timelineDb.listTimeline(dealershipId, customerId, options);
}

import * as dealershipsDb from "@/lib/db/dealerships";

export async function listDealerships(options: {
  limit: number;
  offset: number;
  status?: string;
  platformAccountId?: string;
}) {
  return dealershipsDb.listDealerships({
    limit: options.limit,
    offset: options.offset,
    status: options.status as "APPROVED" | "PROVISIONING" | "PROVISIONED" | "ACTIVE" | "SUSPENDED" | "CLOSED" | undefined,
    platformAccountId: options.platformAccountId,
  });
}

export async function getDealershipBySlug(slug: string) {
  return dealershipsDb.getDealershipBySlug(slug);
}

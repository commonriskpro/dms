import * as pageDb from "../db/page";
import * as siteDb from "../db/site";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { UpdatePageInput } from "../db/page";

export async function listPages(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  const site = await siteDb.getSiteByDealership(dealershipId);
  if (!site) throw new ApiError("NOT_FOUND", "Website site not found");
  return pageDb.listPagesBySite(site.id);
}

export async function updatePage(
  dealershipId: string,
  pageId: string,
  data: UpdatePageInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const page = await pageDb.getPageById(dealershipId, pageId);
  if (!page) throw new ApiError("NOT_FOUND", "Page not found");
  return pageDb.updatePage(pageId, data);
}

import * as siteDb from "../db/site";
import * as pageDb from "../db/page";
import * as formDb from "../db/form";
import * as domainsModule from "@/modules/websites-domains/service";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { UpdateSiteInput } from "../db/site";

export async function getSite(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  return siteDb.getSiteByDealership(dealershipId);
}

export async function initializeSite(
  dealershipId: string,
  userId: string,
  data: { name: string; subdomain: string },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);

  const existing = await siteDb.getSiteByDealership(dealershipId);
  if (existing) throw new ApiError("CONFLICT", "A website site already exists for this dealership");

  const taken = await siteDb.isSubdomainTaken(data.subdomain);
  if (taken) throw new ApiError("CONFLICT", "Subdomain is already taken");

  const site = await siteDb.createSite(dealershipId, data);

  // Seed default pages, forms, and the platform subdomain domain record
  await Promise.all([
    pageDb.seedDefaultPages(site.id, dealershipId),
    formDb.seedDefaultForms(site.id, dealershipId),
    domainsModule.allocatePlatformSubdomain(dealershipId, site.id, data.subdomain, meta),
  ]);

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "website.site.created",
    entity: "WebsiteSite",
    entityId: site.id,
    metadata: { siteId: site.id, subdomain: data.subdomain },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return siteDb.getSiteByDealership(dealershipId);
}

export async function updateSite(
  dealershipId: string,
  userId: string,
  data: Omit<UpdateSiteInput, "publishedReleaseId">,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const site = await siteDb.getSiteByDealership(dealershipId);
  if (!site) throw new ApiError("NOT_FOUND", "Website site not found");

  const updated = await siteDb.updateSite(dealershipId, site.id, data);

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "website.site.updated",
    entity: "WebsiteSite",
    entityId: site.id,
    metadata: { siteId: site.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}

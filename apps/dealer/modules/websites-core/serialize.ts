import type {
  WebsiteSite,
  WebsitePage,
  WebsiteDomain,
  WebsiteLeadForm,
  WebsitePublishRelease,
  VehicleWebsiteSettings,
} from "@prisma/client";
import type {
  WebsiteSiteDto,
  WebsitePageDto,
  WebsiteDomainDto,
  WebsiteLeadFormDto,
  WebsitePublishReleaseDto,
  VehicleWebsiteSettingsDto,
  WebsiteThemeConfig,
  WebsiteContactConfig,
  WebsiteSocialConfig,
} from "@dms/contracts";

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

function parseJson<T>(v: unknown): T | null {
  if (!v || typeof v !== "object") return null;
  return v as T;
}

export function serializeSite(
  site: WebsiteSite & {
    domains?: WebsiteDomain[];
    pages?: WebsitePage[];
    forms?: WebsiteLeadForm[];
  }
): WebsiteSiteDto {
  return {
    id: site.id,
    dealershipId: site.dealershipId,
    name: site.name,
    status: site.status,
    subdomain: site.subdomain,
    activeTemplateKey: site.activeTemplateKey,
    publishedReleaseId: site.publishedReleaseId ?? null,
    themeConfig: parseJson<WebsiteThemeConfig>(site.themeConfigJson),
    contactConfig: parseJson<WebsiteContactConfig>(site.contactConfigJson),
    socialConfig: parseJson<WebsiteSocialConfig>(site.socialConfigJson),
    createdAt: toIso(site.createdAt)!,
    updatedAt: toIso(site.updatedAt)!,
  };
}

export function serializePage(page: WebsitePage): WebsitePageDto {
  return {
    id: page.id,
    siteId: page.siteId,
    dealershipId: page.dealershipId,
    pageType: page.pageType,
    title: page.title,
    slug: page.slug,
    isEnabled: page.isEnabled,
    seoTitle: page.seoTitle ?? null,
    seoDescription: page.seoDescription ?? null,
    sectionsConfigJson: parseJson<Record<string, unknown>>(page.sectionsConfigJson),
    sortOrder: page.sortOrder,
    createdAt: toIso(page.createdAt)!,
    updatedAt: toIso(page.updatedAt)!,
  };
}

export function serializeDomain(domain: WebsiteDomain): WebsiteDomainDto {
  return {
    id: domain.id,
    siteId: domain.siteId,
    hostname: domain.hostname,
    isPrimary: domain.isPrimary,
    isSubdomain: domain.isSubdomain,
    verificationStatus: domain.verificationStatus,
    sslStatus: domain.sslStatus,
    createdAt: toIso(domain.createdAt)!,
    updatedAt: toIso(domain.updatedAt)!,
  };
}

export function serializeForm(form: WebsiteLeadForm): WebsiteLeadFormDto {
  return {
    id: form.id,
    siteId: form.siteId,
    formType: form.formType,
    isEnabled: form.isEnabled,
    routingConfigJson: parseJson<Record<string, unknown>>(form.routingConfigJson),
    createdAt: toIso(form.createdAt)!,
    updatedAt: toIso(form.updatedAt)!,
  };
}

export function serializeRelease(
  release: WebsitePublishRelease,
  activeSitePublishedReleaseId: string | null
): WebsitePublishReleaseDto {
  return {
    id: release.id,
    siteId: release.siteId,
    versionNumber: release.versionNumber,
    publishedAt: toIso(release.publishedAt)!,
    publishedByUserId: release.publishedByUserId,
    isActive: release.id === activeSitePublishedReleaseId,
    createdAt: toIso(release.createdAt)!,
  };
}

export function serializeVehicleSettings(s: VehicleWebsiteSettings): VehicleWebsiteSettingsDto {
  return {
    id: s.id,
    vehicleId: s.vehicleId,
    isPublished: s.isPublished,
    isFeatured: s.isFeatured,
    hidePrice: s.hidePrice,
    customHeadline: s.customHeadline ?? null,
    customDescription: s.customDescription ?? null,
    sortPriority: s.sortPriority,
    primaryPhotoOverrideId: s.primaryPhotoOverrideId ?? null,
    updatedAt: toIso(s.updatedAt)!,
  };
}

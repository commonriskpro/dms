import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const WEBSITE_SITE_STATUS = ["DRAFT", "LIVE", "PAUSED"] as const;
export type WebsiteSiteStatus = (typeof WEBSITE_SITE_STATUS)[number];

export const WEBSITE_PAGE_TYPE = ["HOME", "INVENTORY", "VDP", "CONTACT", "CUSTOM"] as const;
export type WebsitePageType = (typeof WEBSITE_PAGE_TYPE)[number];

export const WEBSITE_LEAD_FORM_TYPE = [
  "CONTACT",
  "CHECK_AVAILABILITY",
  "TEST_DRIVE",
  "GET_EPRICE",
  "FINANCING",
  "TRADE_VALUE",
] as const;
export type WebsiteLeadFormType = (typeof WEBSITE_LEAD_FORM_TYPE)[number];

export const WEBSITE_DOMAIN_VERIFICATION_STATUS = ["PENDING", "VERIFIED", "FAILED"] as const;
export type WebsiteDomainVerificationStatus = (typeof WEBSITE_DOMAIN_VERIFICATION_STATUS)[number];

export const WEBSITE_DOMAIN_SSL_STATUS = ["PENDING", "PROVISIONED", "FAILED", "NOT_APPLICABLE"] as const;
export type WebsiteDomainSslStatus = (typeof WEBSITE_DOMAIN_SSL_STATUS)[number];

// ─── Theme / Contact / Social config schemas ──────────────────────────────────

export const websiteThemeConfigSchema = z.object({
  logoUrl: z.string().url().max(2000).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  headerBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  fontFamily: z.string().max(100).optional().nullable(),
});
export type WebsiteThemeConfig = z.infer<typeof websiteThemeConfigSchema>;

export const websiteContactConfigSchema = z.object({
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  hours: z.record(z.string().max(100)).optional().nullable(),
});
export type WebsiteContactConfig = z.infer<typeof websiteContactConfigSchema>;

export const websiteSocialConfigSchema = z.object({
  facebook: z.string().url().max(500).optional().nullable(),
  instagram: z.string().url().max(500).optional().nullable(),
  twitter: z.string().url().max(500).optional().nullable(),
  youtube: z.string().url().max(500).optional().nullable(),
  tiktok: z.string().url().max(500).optional().nullable(),
});
export type WebsiteSocialConfig = z.infer<typeof websiteSocialConfigSchema>;

// ─── API: Site ────────────────────────────────────────────────────────────────

export const createWebsiteSiteBodySchema = z.object({
  name: z.string().min(1).max(200),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Subdomain must be lowercase alphanumeric with hyphens"),
});
export type CreateWebsiteSiteBody = z.infer<typeof createWebsiteSiteBodySchema>;

export const updateWebsiteSiteBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(WEBSITE_SITE_STATUS).optional(),
  activeTemplateKey: z.string().min(1).max(100).optional(),
  themeConfig: websiteThemeConfigSchema.optional(),
  contactConfig: websiteContactConfigSchema.optional(),
  socialConfig: websiteSocialConfigSchema.optional(),
});
export type UpdateWebsiteSiteBody = z.infer<typeof updateWebsiteSiteBodySchema>;

// ─── API: Pages ───────────────────────────────────────────────────────────────

export const pageIdParamSchema = z.object({ pageId: z.string().uuid() });

export const updateWebsitePageBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isEnabled: z.boolean().optional(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  sectionsConfigJson: z.record(z.unknown()).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateWebsitePageBody = z.infer<typeof updateWebsitePageBodySchema>;

// ─── API: Domains ─────────────────────────────────────────────────────────────

export const domainIdParamSchema = z.object({ domainId: z.string().uuid() });

export const addWebsiteDomainBodySchema = z.object({
  hostname: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-.]*[a-z0-9])?$/, "Invalid hostname format")
    .transform((v) => v.toLowerCase()),
  isPrimary: z.boolean().optional().default(false),
});
export type AddWebsiteDomainBody = z.infer<typeof addWebsiteDomainBodySchema>;

export const updateWebsiteDomainBodySchema = z.object({
  isPrimary: z.boolean().optional(),
  verificationStatus: z.enum(WEBSITE_DOMAIN_VERIFICATION_STATUS).optional(),
  sslStatus: z.enum(WEBSITE_DOMAIN_SSL_STATUS).optional(),
});
export type UpdateWebsiteDomainBody = z.infer<typeof updateWebsiteDomainBodySchema>;

// ─── API: Lead Forms ──────────────────────────────────────────────────────────

export const formIdParamSchema = z.object({ formId: z.string().uuid() });

export const updateWebsiteLeadFormBodySchema = z.object({
  isEnabled: z.boolean().optional(),
  routingConfigJson: z.record(z.unknown()).optional().nullable(),
});
export type UpdateWebsiteLeadFormBody = z.infer<typeof updateWebsiteLeadFormBodySchema>;

// ─── API: Publish ─────────────────────────────────────────────────────────────

export const publishWebsiteBodySchema = z.object({
  publishNote: z.string().max(500).optional(),
});
export type PublishWebsiteBody = z.infer<typeof publishWebsiteBodySchema>;

export const releaseIdParamSchema = z.object({ releaseId: z.string().uuid() });

// ─── API: Vehicle Website Settings ───────────────────────────────────────────

export const updateVehicleWebsiteSettingsBodySchema = z.object({
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hidePrice: z.boolean().optional(),
  customHeadline: z.string().max(200).optional().nullable(),
  customDescription: z.string().max(1000).optional().nullable(),
  sortPriority: z.number().int().min(0).max(9999).optional(),
  primaryPhotoOverrideId: z.string().uuid().optional().nullable(),
});
export type UpdateVehicleWebsiteSettingsBody = z.infer<typeof updateVehicleWebsiteSettingsBodySchema>;

// ─── Response DTOs ────────────────────────────────────────────────────────────

export type WebsiteSiteDto = {
  id: string;
  dealershipId: string;
  name: string;
  status: WebsiteSiteStatus;
  subdomain: string;
  activeTemplateKey: string;
  publishedReleaseId: string | null;
  themeConfig: WebsiteThemeConfig | null;
  contactConfig: WebsiteContactConfig | null;
  socialConfig: WebsiteSocialConfig | null;
  createdAt: string;
  updatedAt: string;
};

export type WebsitePageDto = {
  id: string;
  siteId: string;
  dealershipId: string;
  pageType: WebsitePageType;
  title: string;
  slug: string;
  isEnabled: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  sectionsConfigJson: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteDomainDto = {
  id: string;
  siteId: string;
  hostname: string;
  isPrimary: boolean;
  isSubdomain: boolean;
  verificationStatus: WebsiteDomainVerificationStatus;
  sslStatus: WebsiteDomainSslStatus;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteLeadFormDto = {
  id: string;
  siteId: string;
  formType: WebsiteLeadFormType;
  isEnabled: boolean;
  routingConfigJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type WebsitePublishReleaseDto = {
  id: string;
  siteId: string;
  versionNumber: number;
  publishedAt: string;
  publishedByUserId: string;
  isActive: boolean;
  createdAt: string;
};

export type VehicleWebsiteSettingsDto = {
  id: string;
  vehicleId: string;
  isPublished: boolean;
  isFeatured: boolean;
  hidePrice: boolean;
  customHeadline: string | null;
  customDescription: string | null;
  sortPriority: number;
  primaryPhotoOverrideId: string | null;
  updatedAt: string;
};

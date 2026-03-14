import { z } from "zod";

// ─── Safe content (no HTML/script/arbitrary markup) ────────────────────────
// Dealer-editable website fields must be plain text only. Platform controls template code.

const UNSAFE_MARKUP =
  /<|>|<\s*script|<\s*iframe|javascript\s*:|<\s*\/\s*script|on\w+\s*=|data:\s*text\/html|expression\s*\(/i;

export function isSafeContentString(value: string): boolean {
  if (typeof value !== "string") return true;
  return !UNSAFE_MARKUP.test(value);
}

/** Zod refine: rejects HTML, script, event handlers, data URLs. Use for any dealer-editable text. */
export function safeContentRefine(maxLength: number) {
  return (val: string) =>
    val.length <= maxLength && isSafeContentString(val);
}

export function safeContentStringSchema(maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .refine(
      (s) => isSafeContentString(s),
      "Content must not contain HTML, script, or executable code"
    );
}

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

/** Section config: only booleans, numbers, or safe short strings. No HTML/script. Keys = section ids from template. */
const websiteSectionConfigValueSchema = z.union([
  z.boolean(),
  z.number().int().min(-9999).max(9999),
  safeContentStringSchema(500),
]);

export const websiteSectionConfigSchema = z
  .record(z.string().regex(/^[a-z][a-z0-9_]*$/), websiteSectionConfigValueSchema)
  .optional()
  .nullable();
export type WebsiteSectionConfig = z.infer<typeof websiteSectionConfigSchema>;

export const websiteThemeConfigSchema = z.object({
  logoUrl: z.string().url().max(2000).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  headerBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  fontFamily: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .refine((v) => v == null || isSafeContentString(v), "Font family must not contain HTML or script"),
});
export type WebsiteThemeConfig = z.infer<typeof websiteThemeConfigSchema>;

export const websiteContactConfigSchema = z.object({
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  addressLine1: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .refine((v) => v == null || isSafeContentString(v), "Address must not contain HTML or script"),
  city: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .refine((v) => v == null || isSafeContentString(v), "City must not contain HTML or script"),
  state: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .refine((v) => v == null || isSafeContentString(v), "State must not contain HTML or script"),
  zip: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .refine((v) => v == null || isSafeContentString(v), "ZIP must not contain HTML or script"),
  hours: z
    .record(
      z.string().max(50).refine((v) => isSafeContentString(v), "Hours value must not contain HTML or script"),
      z.string().max(100).refine((v) => isSafeContentString(v), "Hours value must not contain HTML or script")
    )
    .optional()
    .nullable(),
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
  name: z.string().min(1).max(200).refine(isSafeContentString, "Name must not contain HTML or script"),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Subdomain must be lowercase alphanumeric with hyphens"),
});
export type CreateWebsiteSiteBody = z.infer<typeof createWebsiteSiteBodySchema>;

export const updateWebsiteSiteBodySchema = z.object({
  name: z.string().min(1).max(200).refine(isSafeContentString, "Name must not contain HTML or script").optional(),
  status: z.enum(WEBSITE_SITE_STATUS).optional(),
  activeTemplateKey: z.string().min(1).max(100).refine(isSafeContentString, "Template key must not contain HTML or script").optional(),
  themeConfig: websiteThemeConfigSchema.optional(),
  contactConfig: websiteContactConfigSchema.optional(),
  socialConfig: websiteSocialConfigSchema.optional(),
});
export type UpdateWebsiteSiteBody = z.infer<typeof updateWebsiteSiteBodySchema>;

// ─── API: Pages ───────────────────────────────────────────────────────────────

export const pageIdParamSchema = z.object({ pageId: z.string().uuid() });

export const updateWebsitePageBodySchema = z.object({
  title: z.string().min(1).max(200).refine(isSafeContentString, "Title must not contain HTML or script").optional(),
  isEnabled: z.boolean().optional(),
  seoTitle: z.string().max(200).refine((s) => isSafeContentString(s), "SEO title must not contain HTML or script").optional().nullable(),
  seoDescription: z.string().max(500).refine((s) => isSafeContentString(s), "SEO description must not contain HTML or script").optional().nullable(),
  sectionsConfigJson: websiteSectionConfigSchema,
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

/** Lead form routing: allowlisted keys only. No raw HTML/script. */
export const websiteLeadFormRoutingConfigSchema = z
  .object({
    notificationEmail: z.string().email().max(200).optional().nullable(),
    assignToUserId: z.string().uuid().optional().nullable(),
  })
  .strict()
  .optional()
  .nullable();
export type WebsiteLeadFormRoutingConfig = z.infer<typeof websiteLeadFormRoutingConfigSchema>;

export const updateWebsiteLeadFormBodySchema = z.object({
  isEnabled: z.boolean().optional(),
  routingConfigJson: websiteLeadFormRoutingConfigSchema,
});
export type UpdateWebsiteLeadFormBody = z.infer<typeof updateWebsiteLeadFormBodySchema>;

// ─── API: Publish ─────────────────────────────────────────────────────────────

export const publishWebsiteBodySchema = z.object({
  publishNote: z.string().max(500).refine((s) => isSafeContentString(s), "Note must not contain HTML or script").optional(),
});
export type PublishWebsiteBody = z.infer<typeof publishWebsiteBodySchema>;

export const releaseIdParamSchema = z.object({ releaseId: z.string().uuid() });

// ─── API: Vehicle Website Settings ───────────────────────────────────────────

export const updateVehicleWebsiteSettingsBodySchema = z.object({
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hidePrice: z.boolean().optional(),
  customHeadline: z.string().max(200).refine((s) => isSafeContentString(s), "Headline must not contain HTML or script").optional().nullable(),
  customDescription: z.string().max(1000).refine((s) => isSafeContentString(s), "Description must not contain HTML or script").optional().nullable(),
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

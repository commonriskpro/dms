import { prisma } from "@/lib/db";
import { requireTemplate } from "@/modules/websites-templates/registry";
import type { PublishSnapshot, SnapshotDealership, SnapshotTheme, SnapshotSocial } from "@dms/contracts";
import type {
  WebsiteThemeConfig,
  WebsiteContactConfig,
  WebsiteSocialConfig,
} from "@dms/contracts";

function parseJson<T>(v: unknown): T | null {
  if (!v || typeof v !== "object") return null;
  return v as T;
}

function vehicleToSlug(v: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  stockNumber: string;
}): string {
  const parts = [
    v.year?.toString(),
    v.make?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    v.model?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    v.trim?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    v.vin ? v.vin.slice(-6).toLowerCase() : v.stockNumber.toLowerCase(),
  ]
    .filter(Boolean)
    .join("-");
  return parts || v.stockNumber;
}

export async function assembleSnapshot(
  dealershipId: string,
  siteId: string
): Promise<PublishSnapshot> {
  // Load all required data concurrently
  const [site, dealership, publishedVehicles] = await Promise.all([
    prisma.websiteSite.findFirst({
      where: { id: siteId, dealershipId, deletedAt: null },
      include: {
        pages: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" } },
        forms: { where: { isEnabled: true } },
        domains: { where: { isPrimary: true }, take: 1 },
      },
    }),
    prisma.dealership.findUnique({
      where: { id: dealershipId },
      include: {
        locations: { where: { isPrimary: true }, take: 1 },
      },
    }),
    prisma.vehicleWebsiteSettings.findMany({
      where: {
        dealershipId,
        isPublished: true,
        vehicle: { deletedAt: null },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            year: true,
            make: true,
            model: true,
            trim: true,
            vin: true,
            stockNumber: true,
            status: true,
          },
        },
      },
      take: 100,
    }),
  ]);

  if (!site) throw new Error("Site not found for snapshot assembly");
  if (!dealership) throw new Error("Dealership not found for snapshot assembly");

  // Validate template
  const template = requireTemplate(site.activeTemplateKey);

  // Parse config blocks
  const themeConfig = parseJson<WebsiteThemeConfig>(site.themeConfigJson);
  const contactConfig = parseJson<WebsiteContactConfig>(site.contactConfigJson);
  const socialConfig = parseJson<WebsiteSocialConfig>(site.socialConfigJson);

  // Primary location for address data
  const loc = dealership.locations[0];

  const snapshotDealership: SnapshotDealership = {
    name: dealership.name,
    phone: contactConfig?.phone ?? null,
    email: contactConfig?.email ?? null,
    addressLine1: contactConfig?.addressLine1 ?? loc?.addressLine1 ?? null,
    city: contactConfig?.city ?? loc?.city ?? null,
    state: contactConfig?.state ?? loc?.region ?? null,
    zip: contactConfig?.zip ?? loc?.postalCode ?? null,
    hours: contactConfig?.hours ?? null,
  };

  const snapshotTheme: SnapshotTheme = {
    logoUrl: themeConfig?.logoUrl ?? null,
    primaryColor: themeConfig?.primaryColor ?? null,
    accentColor: themeConfig?.accentColor ?? null,
    headerBgColor: themeConfig?.headerBgColor ?? null,
    fontFamily: themeConfig?.fontFamily ?? null,
  };

  const snapshotSocial: SnapshotSocial = {
    facebook: socialConfig?.facebook ?? null,
    instagram: socialConfig?.instagram ?? null,
    twitter: socialConfig?.twitter ?? null,
    youtube: socialConfig?.youtube ?? null,
    tiktok: socialConfig?.tiktok ?? null,
  };

  // Filter out vehicles that are sold (deletedAt already filtered via where clause)
  const liveVehicles = publishedVehicles.filter(
    (s) => s.vehicle !== null && s.vehicle.status !== "SOLD"
  );

  const featuredSlugs = liveVehicles
    .filter((s) => s.isFeatured)
    .slice(0, 6)
    .map((s) => vehicleToSlug(s.vehicle!));

  const primaryHostname = site.domains[0]?.hostname ?? `${site.subdomain}.dms-platform.com`;

  const snapshot: PublishSnapshot = {
    version: 0, // filled by publish service
    publishedAt: new Date().toISOString(),
    templateKey: site.activeTemplateKey,
    dealership: snapshotDealership,
    theme: snapshotTheme,
    social: snapshotSocial,
    pages: site.pages.map((p) => ({
      pageType: p.pageType,
      title: p.title,
      slug: p.slug,
      isEnabled: p.isEnabled,
      seoTitle: p.seoTitle ?? null,
      seoDescription: p.seoDescription ?? null,
      sectionsConfig: parseJson<Record<string, unknown>>(p.sectionsConfigJson),
      sortOrder: p.sortOrder,
    })),
    forms: site.forms.map((f) => ({
      formType: f.formType,
      isEnabled: f.isEnabled,
    })),
    inventory: {
      featuredVehicleSlugs: featuredSlugs,
      vehicleCount: liveVehicles.length,
    },
    seo: {
      defaultTitle: dealership.name,
      defaultDescription: `Browse vehicles at ${dealership.name}`,
      canonicalBase: `https://${primaryHostname}`,
    },
  };

  // Validate via template
  template.validateSnapshot(snapshot);

  return snapshot;
}

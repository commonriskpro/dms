/**
 * Public website analytics: record page/VDP views, resolve by hostname only.
 */
import { prisma } from "@/lib/db";
import { resolveSiteByHostname } from "@/modules/websites-domains/service";

const MAX_PATH_LENGTH = 500;
const MAX_REFERRER_DOMAIN = 253;
const MAX_UTM = 200;

function truncate(s: string | undefined | null, max: number): string | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t || null;
}

export type RecordPageViewInput = {
  hostname: string;
  eventType: "page_view" | "vdp_view";
  path: string;
  vehicleSlug?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
};

/**
 * Record a page view or VDP view. Resolves site from hostname; returns false if no published site.
 * For vdp_view, vehicleId is resolved from slug when possible.
 */
export async function recordPageView(input: RecordPageViewInput): Promise<boolean> {
  const result = await resolveSiteByHostname(input.hostname);
  if (!result) return false;

  const { site } = result;
  const path = truncate(input.path, MAX_PATH_LENGTH) ?? "/";
  let vehicleId: string | null = null;

  if (input.eventType === "vdp_view" && input.vehicleSlug) {
    const vinLast6 = input.vehicleSlug.split("-").pop()?.toUpperCase();
    if (vinLast6 && vinLast6.length === 6) {
      const v = await prisma.vehicle.findFirst({
        where: {
          dealershipId: site.dealershipId,
          vin: { endsWith: vinLast6 },
          deletedAt: null,
          websiteSettings: { isPublished: true },
        },
        select: { id: true },
      });
      vehicleId = v?.id ?? null;
    }
  }

  let referrerDomain: string | null = null;
  if (input.referrer) {
    try {
      const u = new URL(input.referrer);
      referrerDomain = truncate(u.hostname, MAX_REFERRER_DOMAIN);
    } catch {
      // ignore invalid referrer
    }
  }

  await prisma.websitePageView.create({
    data: {
      dealershipId: site.dealershipId,
      siteId: site.id,
      path,
      vehicleId,
      utmSource: truncate(input.utmSource, MAX_UTM),
      utmMedium: truncate(input.utmMedium, MAX_UTM),
      utmCampaign: truncate(input.utmCampaign, MAX_UTM),
      referrerDomain,
    },
  });

  return true;
}

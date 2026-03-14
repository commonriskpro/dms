/**
 * Dealer-facing analytics read service. Scoped by dealershipId from auth.
 */
import { prisma } from "@/lib/db";

export type AnalyticsSummary = {
  pageViews: number;
  vdpViews: number;
  leads: number;
};

export async function getAnalyticsSummary(
  dealershipId: string,
  from: Date,
  to: Date
): Promise<AnalyticsSummary> {
  const site = await prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    select: { id: true },
  });
  if (!site) return { pageViews: 0, vdpViews: 0, leads: 0 };

  const [pageViews, vdpViews, leads] = await Promise.all([
    prisma.websitePageView.count({
      where: { siteId: site.id, viewedAt: { gte: from, lte: to } },
    }),
    prisma.websitePageView.count({
      where: { siteId: site.id, vehicleId: { not: null }, viewedAt: { gte: from, lte: to } },
    }),
    prisma.customerActivity.count({
      where: {
        dealershipId,
        activityType: "website_lead",
        createdAt: { gte: from, lte: to },
      },
    }),
  ]);

  return { pageViews, vdpViews, leads };
}

export type TopPageRow = { path: string; views: number };

export async function getTopPages(
  dealershipId: string,
  from: Date,
  to: Date,
  limit: number
): Promise<TopPageRow[]> {
  const site = await prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    select: { id: true },
  });
  if (!site) return [];

  const rows = await prisma.websitePageView.groupBy({
    by: ["path"],
    where: { siteId: site.id, viewedAt: { gte: from, lte: to } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  return rows.map((r) => ({ path: r.path, views: r._count.id }));
}

export type TopVdpRow = { vehicleId: string; views: number };

export async function getTopVdps(
  dealershipId: string,
  from: Date,
  to: Date,
  limit: number
): Promise<TopVdpRow[]> {
  const site = await prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    select: { id: true },
  });
  if (!site) return [];

  const rows = await prisma.websitePageView.groupBy({
    by: ["vehicleId"],
    where: {
      siteId: site.id,
      vehicleId: { not: null },
      viewedAt: { gte: from, lte: to },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  return rows
    .filter((r) => r.vehicleId != null)
    .map((r) => ({ vehicleId: r.vehicleId!, views: r._count.id }));
}

export type LeadsBySourceRow = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; leads: number };

export async function getLeadsBySource(
  dealershipId: string,
  from: Date,
  to: Date
): Promise<LeadsBySourceRow[]> {
  const raw = await prisma.customerActivity.findMany({
    where: {
      dealershipId,
      activityType: "website_lead",
      createdAt: { gte: from, lte: to },
    },
    select: { metadata: true },
  });

  const key = (m: Record<string, unknown>) =>
    [
      (m.utmSource as string) ?? null,
      (m.utmMedium as string) ?? null,
      (m.utmCampaign as string) ?? null,
    ].join("\t");

  const counts = new Map<string, number>();
  for (const r of raw) {
    const meta = (r.metadata as Record<string, unknown>) ?? {};
    const k = key(meta);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return [...counts.entries()].map(([k, leads]) => {
    const [utmSource, utmMedium, utmCampaign] = k.split("\t");
    return { utmSource: utmSource || null, utmMedium: utmMedium || null, utmCampaign: utmCampaign || null, leads };
  });
}

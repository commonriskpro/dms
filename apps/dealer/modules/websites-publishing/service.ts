import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite, requireTenantActiveForRead } from "@/lib/tenant-status";
import { auditLog } from "@/lib/audit";
import { assembleSnapshot } from "./snapshot";
import type { WebsitePublishRelease } from "@prisma/client";

export async function publishSite(
  dealershipId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);

  const site = await prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    select: { id: true, activeTemplateKey: true, subdomain: true },
  });
  if (!site) throw new ApiError("NOT_FOUND", "Website site not found");

  // Compute next version number atomically
  const lastRelease = await prisma.websitePublishRelease.findFirst({
    where: { siteId: site.id },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const nextVersion = (lastRelease?.versionNumber ?? 0) + 1;

  // Assemble snapshot (validates template + page requirements)
  const snapshot = await assembleSnapshot(dealershipId, site.id);
  snapshot.version = nextVersion;
  snapshot.publishedAt = new Date().toISOString();

  const now = new Date();

  // Atomic: create release + update site pointer in one transaction
  const [release] = await prisma.$transaction(async (tx) => {
    const created = await tx.websitePublishRelease.create({
      data: {
        siteId: site.id,
        dealershipId,
        versionNumber: nextVersion,
        configSnapshotJson: snapshot as object,
        publishedAt: now,
        publishedByUserId: userId,
      },
    });
    await tx.websiteSite.update({
      where: { id: site.id },
      data: { publishedReleaseId: created.id, status: "LIVE" },
    });
    return [created] as const;
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "website.published",
    entity: "WebsiteSite",
    entityId: site.id,
    metadata: {
      siteId: site.id,
      versionNumber: nextVersion,
      releaseId: release.id,
      templateKey: site.activeTemplateKey,
      vehicleCount: snapshot.inventory.vehicleCount,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return release;
}

export async function previewSnapshot(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  const site = await prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    select: { id: true },
  });
  if (!site) throw new ApiError("NOT_FOUND", "Website site not found");
  const snapshot = await assembleSnapshot(dealershipId, site.id);
  snapshot.version = -1; // preview marker
  return snapshot;
}

export async function listReleases(
  dealershipId: string,
  options: { limit: number; offset: number }
): Promise<{ data: WebsitePublishRelease[]; total: number; activeSiteReleaseId: string | null }> {
  await requireTenantActiveForRead(dealershipId);
  const site = await prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    select: { id: true, publishedReleaseId: true },
  });
  if (!site) throw new ApiError("NOT_FOUND", "Website site not found");

  const [data, total] = await Promise.all([
    prisma.websitePublishRelease.findMany({
      where: { siteId: site.id },
      orderBy: { versionNumber: "desc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.websitePublishRelease.count({ where: { siteId: site.id } }),
  ]);

  return { data, total, activeSiteReleaseId: site.publishedReleaseId ?? null };
}

export async function getReleaseDetail(dealershipId: string, releaseId: string) {
  await requireTenantActiveForRead(dealershipId);
  const release = await prisma.websitePublishRelease.findFirst({
    where: { id: releaseId, dealershipId },
  });
  if (!release) throw new ApiError("NOT_FOUND", "Release not found");

  const site = await prisma.websiteSite.findFirst({
    where: { id: release.siteId },
    select: { publishedReleaseId: true },
  });

  return { release, activeSiteReleaseId: site?.publishedReleaseId ?? null };
}

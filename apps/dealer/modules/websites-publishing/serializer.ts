import type { WebsitePublishRelease } from "@prisma/client";
import type { WebsitePublishReleaseDto } from "@dms/contracts";

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : d;
}

export function serializeRelease(
  release: WebsitePublishRelease,
  activeSiteReleaseId: string | null
): WebsitePublishReleaseDto {
  return {
    id: release.id,
    siteId: release.siteId,
    versionNumber: release.versionNumber,
    publishedAt: toIso(release.publishedAt),
    publishedByUserId: release.publishedByUserId,
    isActive: release.id === activeSiteReleaseId,
    createdAt: toIso(release.createdAt),
  };
}

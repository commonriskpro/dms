/**
 * Public-safe read service.
 * All queries filter by isPublished=true, deletedAt=null, and resolved dealershipId.
 * Never returns internal cost/margin/operational fields.
 */
import { prisma } from "@/lib/db";
import { resolveSiteByHostname } from "@/modules/websites-domains/service";
import { serializePublicVehicleSummary, serializePublicVehicleDetail, vehicleToSlug } from "./serialize";
import type { PublishedSiteContext, PublicInventoryListResult } from "@dms/contracts";

export async function resolvePublishedSiteByHostname(hostname: string): Promise<PublishedSiteContext | null> {
  const result = await resolveSiteByHostname(hostname);
  if (!result) return null;

  const { site, release } = result;
  const snapshot = release.configSnapshotJson as object;
  const primaryDomain = site.domains[0];

  return {
    siteId: site.id,
    dealershipId: site.dealershipId,
    subdomain: site.subdomain,
    templateKey: site.activeTemplateKey,
    snapshot: snapshot as import("@dms/contracts").PublishSnapshot,
    primaryHostname: primaryDomain?.hostname ?? `${site.subdomain}.dms-platform.com`,
  };
}

export async function listPublicVehicles(
  dealershipId: string,
  options: { page?: number; limit?: number; make?: string; model?: string; year?: number }
): Promise<PublicInventoryListResult> {
  const limit = Math.min(options.limit ?? 24, 48);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const where = {
    dealershipId,
    isPublished: true,
    vehicle: {
      deletedAt: null,
      status: { not: "SOLD" as const },
      ...(options.make && { make: { equals: options.make, mode: "insensitive" as const } }),
      ...(options.model && { model: { equals: options.model, mode: "insensitive" as const } }),
      ...(options.year && { year: options.year }),
    },
  };

  const [settings, total] = await Promise.all([
    prisma.vehicleWebsiteSettings.findMany({
      where,
      include: {
        vehicle: {
          include: {
            vehiclePhotos: {
              where: { fileObject: { deletedAt: null } },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 5,
            },
          },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { sortPriority: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.vehicleWebsiteSettings.count({ where }),
  ]);

  const data = settings
    .filter((s) => s.vehicle !== null)
    .map((s) =>
      serializePublicVehicleSummary({
        ...s.vehicle!,
        websiteSettings: s,
        vehiclePhotos: s.vehicle!.vehiclePhotos,
      })
    );

  return { data, meta: { total, page, limit } };
}

export async function getPublicVehicleBySlug(
  dealershipId: string,
  slug: string
): Promise<import("@dms/contracts").PublicVehicleDetail | null> {
  const settings = await prisma.vehicleWebsiteSettings.findMany({
    where: {
      dealershipId,
      isPublished: true,
      vehicle: { deletedAt: null, status: { not: "SOLD" } },
    },
    include: {
      vehicle: {
        include: {
          vehiclePhotos: {
            where: { fileObject: { deletedAt: null } },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 20,
          },
          vinDecodes: {
            orderBy: { decodedAt: "desc" },
            take: 1,
            select: { bodyStyle: true, engine: true, transmission: true, drivetrain: true },
          },
        },
      },
    },
    take: 200,
  });

  for (const s of settings) {
    if (!s.vehicle) continue;
    const computed = vehicleToSlug(s.vehicle);
    if (computed === slug) {
      return serializePublicVehicleDetail({
        ...s.vehicle,
        websiteSettings: s,
        vehiclePhotos: s.vehicle.vehiclePhotos,
        vinDecodes: s.vehicle.vinDecodes,
      });
    }
  }

  return null;
}

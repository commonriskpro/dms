import { prisma } from "@/lib/db";
import { Prisma, type WebsiteSiteStatus } from "@prisma/client";

export type CreateSiteInput = {
  name: string;
  subdomain: string;
};

export type UpdateSiteInput = {
  name?: string;
  status?: WebsiteSiteStatus;
  activeTemplateKey?: string;
  publishedReleaseId?: string | null;
  themeConfigJson?: Prisma.InputJsonValue | null;
  contactConfigJson?: Prisma.InputJsonValue | null;
  socialConfigJson?: Prisma.InputJsonValue | null;
};

export async function getSiteByDealership(dealershipId: string) {
  return prisma.websiteSite.findFirst({
    where: { dealershipId, deletedAt: null },
    include: {
      domains: { orderBy: { isPrimary: "desc" } },
      pages: { orderBy: { sortOrder: "asc" } },
      forms: { orderBy: { formType: "asc" } },
    },
  });
}

export async function getSiteById(dealershipId: string, id: string) {
  return prisma.websiteSite.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: {
      domains: { orderBy: { isPrimary: "desc" } },
      pages: { orderBy: { sortOrder: "asc" } },
      forms: { orderBy: { formType: "asc" } },
    },
  });
}

export async function getSiteBySubdomain(subdomain: string) {
  return prisma.websiteSite.findFirst({
    where: { subdomain, deletedAt: null },
  });
}

export async function createSite(dealershipId: string, data: CreateSiteInput) {
  return prisma.websiteSite.create({
    data: {
      dealershipId,
      name: data.name,
      subdomain: data.subdomain.toLowerCase(),
    },
  });
}

export async function updateSite(dealershipId: string, id: string, data: UpdateSiteInput) {
  return prisma.websiteSite.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.activeTemplateKey !== undefined && { activeTemplateKey: data.activeTemplateKey }),
      ...(data.publishedReleaseId !== undefined && { publishedReleaseId: data.publishedReleaseId }),
      ...(data.themeConfigJson !== undefined && {
        themeConfigJson: data.themeConfigJson === null ? Prisma.JsonNull : data.themeConfigJson,
      }),
      ...(data.contactConfigJson !== undefined && {
        contactConfigJson: data.contactConfigJson === null ? Prisma.JsonNull : data.contactConfigJson,
      }),
      ...(data.socialConfigJson !== undefined && {
        socialConfigJson: data.socialConfigJson === null ? Prisma.JsonNull : data.socialConfigJson,
      }),
    },
  });
}

export async function isSubdomainTaken(subdomain: string, excludeSiteId?: string) {
  const existing = await prisma.websiteSite.findFirst({
    where: {
      subdomain: subdomain.toLowerCase(),
      ...(excludeSiteId && { id: { not: excludeSiteId } }),
    },
    select: { id: true },
  });
  return !!existing;
}

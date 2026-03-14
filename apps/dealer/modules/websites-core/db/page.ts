import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type UpdatePageInput = {
  title?: string;
  isEnabled?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sectionsConfigJson?: Prisma.InputJsonValue | null;
  sortOrder?: number;
};

export async function getPageById(dealershipId: string, pageId: string) {
  return prisma.websitePage.findFirst({
    where: { id: pageId, dealershipId },
  });
}

export async function listPagesBySite(siteId: string) {
  return prisma.websitePage.findMany({
    where: { siteId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function updatePage(id: string, data: UpdatePageInput) {
  return prisma.websitePage.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
      ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
      ...(data.sectionsConfigJson !== undefined && {
        sectionsConfigJson: data.sectionsConfigJson === null ? Prisma.JsonNull : data.sectionsConfigJson,
      }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });
}

export async function seedDefaultPages(siteId: string, dealershipId: string) {
  const defaults = [
    { pageType: "HOME" as const, title: "Home", slug: "", sortOrder: 0 },
    { pageType: "INVENTORY" as const, title: "Inventory", slug: "inventory", sortOrder: 1 },
    { pageType: "VDP" as const, title: "Vehicle Details", slug: "vehicle", sortOrder: 2 },
    { pageType: "CONTACT" as const, title: "Contact Us", slug: "contact", sortOrder: 3 },
  ];
  return prisma.websitePage.createMany({
    data: defaults.map((d) => ({ ...d, siteId, dealershipId })),
    skipDuplicates: true,
  });
}

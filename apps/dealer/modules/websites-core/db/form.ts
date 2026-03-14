import { prisma } from "@/lib/db";
import { Prisma, type WebsiteLeadFormType } from "@prisma/client";

export type UpdateFormInput = {
  isEnabled?: boolean;
  routingConfigJson?: Prisma.InputJsonValue | null;
};

export async function getFormById(dealershipId: string, formId: string) {
  return prisma.websiteLeadForm.findFirst({
    where: { id: formId, dealershipId },
  });
}

export async function listFormsBySite(siteId: string) {
  return prisma.websiteLeadForm.findMany({
    where: { siteId },
    orderBy: { formType: "asc" },
  });
}

export async function updateForm(id: string, data: UpdateFormInput) {
  return prisma.websiteLeadForm.update({
    where: { id },
    data: {
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.routingConfigJson !== undefined && {
        routingConfigJson: data.routingConfigJson === null ? Prisma.JsonNull : data.routingConfigJson,
      }),
    },
  });
}

export async function seedDefaultForms(siteId: string, dealershipId: string) {
  const types: WebsiteLeadFormType[] = [
    "CONTACT",
    "CHECK_AVAILABILITY",
    "TEST_DRIVE",
    "GET_EPRICE",
    "FINANCING",
    "TRADE_VALUE",
  ];
  return prisma.websiteLeadForm.createMany({
    data: types.map((formType) => ({ formType, siteId, dealershipId, isEnabled: true })),
    skipDuplicates: true,
  });
}

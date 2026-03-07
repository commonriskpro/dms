import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type {
  ComplianceFormType,
  ComplianceFormInstanceStatus,
} from "@prisma/client";

export type CreateComplianceFormInstanceInput = {
  dealershipId: string;
  dealId: string;
  formType: ComplianceFormType;
  status?: ComplianceFormInstanceStatus;
  generatedPayloadJson?: object | null;
  generatedAt?: Date | null;
  createdByUserId?: string | null;
};

export type UpdateComplianceFormInstanceInput = {
  status?: ComplianceFormInstanceStatus;
  generatedPayloadJson?: object | null;
  generatedAt?: Date | null;
  completedAt?: Date | null;
  updatedByUserId?: string | null;
};

export async function createComplianceFormInstance(
  data: CreateComplianceFormInstanceInput
) {
  return prisma.complianceFormInstance.create({
    data: {
      dealershipId: data.dealershipId,
      dealId: data.dealId,
      formType: data.formType,
      status: data.status ?? "NOT_STARTED",
      generatedPayloadJson: data.generatedPayloadJson ?? undefined,
      generatedAt: data.generatedAt ?? null,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function getComplianceFormInstanceById(
  dealershipId: string,
  id: string
) {
  return prisma.complianceFormInstance.findFirst({
    where: { id, dealershipId },
  });
}

export async function findComplianceFormInstanceByDealAndType(
  dealershipId: string,
  dealId: string,
  formType: ComplianceFormType
) {
  return prisma.complianceFormInstance.findFirst({
    where: { dealershipId, dealId, formType },
  });
}

export async function listComplianceFormInstancesByDeal(
  dealershipId: string,
  dealId: string
) {
  return prisma.complianceFormInstance.findMany({
    where: { dealershipId, dealId },
    orderBy: [{ formType: "asc" }],
  });
}

export async function updateComplianceFormInstance(
  dealershipId: string,
  id: string,
  data: UpdateComplianceFormInstanceInput
) {
  const existing = await prisma.complianceFormInstance.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.complianceFormInstance.update({
    where: { id },
    data: {
      status: data.status,
      generatedPayloadJson:
        data.generatedPayloadJson === undefined
          ? undefined
          : data.generatedPayloadJson === null
            ? Prisma.JsonNull
            : data.generatedPayloadJson,
      generatedAt: data.generatedAt,
      completedAt: data.completedAt,
      updatedByUserId: data.updatedByUserId,
    },
  });
}

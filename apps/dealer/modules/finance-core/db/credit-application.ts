import { prisma } from "@/lib/db";
import type { CreditApplicationStatus } from "@prisma/client";

export type CreditApplicationCreateInput = {
  dealershipId: string;
  dealId?: string | null;
  customerId: string;
  status?: CreditApplicationStatus;
  applicantFirstName: string;
  applicantLastName: string;
  dob?: Date | null;
  ssnEncrypted?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  housingStatus?: string | null;
  housingPaymentCents?: bigint | null;
  yearsAtResidence?: number | null;
  employerName?: string | null;
  jobTitle?: string | null;
  employmentYears?: number | null;
  monthlyIncomeCents?: bigint | null;
  otherIncomeCents?: bigint | null;
  notes?: string | null;
  createdByUserId?: string | null;
};

export type CreditApplicationUpdateInput = Partial<
  Omit<CreditApplicationCreateInput, "dealershipId" | "customerId">
> & {
  submittedAt?: Date | null;
  decisionedAt?: Date | null;
  updatedByUserId?: string | null;
};

export async function createCreditApplication(
  data: CreditApplicationCreateInput
) {
  return prisma.creditApplication.create({
    data: {
      dealershipId: data.dealershipId,
      dealId: data.dealId ?? null,
      customerId: data.customerId,
      status: data.status ?? "DRAFT",
      applicantFirstName: data.applicantFirstName,
      applicantLastName: data.applicantLastName,
      dob: data.dob ?? null,
      ssnEncrypted: data.ssnEncrypted ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postalCode: data.postalCode ?? null,
      housingStatus: data.housingStatus ?? null,
      housingPaymentCents: data.housingPaymentCents ?? null,
      yearsAtResidence: data.yearsAtResidence ?? null,
      employerName: data.employerName ?? null,
      jobTitle: data.jobTitle ?? null,
      employmentYears: data.employmentYears ?? null,
      monthlyIncomeCents: data.monthlyIncomeCents ?? null,
      otherIncomeCents: data.otherIncomeCents ?? null,
      notes: data.notes ?? null,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function getCreditApplicationById(
  dealershipId: string,
  id: string
) {
  return prisma.creditApplication.findFirst({
    where: { id, dealershipId },
    include: {
      deal: { select: { id: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}

export type ListCreditApplicationsOptions = {
  dealId?: string;
  customerId?: string;
  status?: CreditApplicationStatus;
  limit: number;
  offset: number;
};

export async function listCreditApplications(
  dealershipId: string,
  options: ListCreditApplicationsOptions
) {
  const where: { dealershipId: string; dealId?: string; customerId?: string; status?: CreditApplicationStatus } = {
    dealershipId,
  };
  if (options.dealId) where.dealId = options.dealId;
  if (options.customerId) where.customerId = options.customerId;
  if (options.status) where.status = options.status;

  const [data, total] = await Promise.all([
    prisma.creditApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
      select: {
        id: true,
        dealId: true,
        customerId: true,
        status: true,
        applicantFirstName: true,
        applicantLastName: true,
        submittedAt: true,
        decisionedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.creditApplication.count({ where }),
  ]);
  return { data, total };
}

export async function updateCreditApplication(
  dealershipId: string,
  id: string,
  data: CreditApplicationUpdateInput
) {
  const existing = await prisma.creditApplication.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  const keys: (keyof CreditApplicationUpdateInput)[] = [
    "dealId", "status", "applicantFirstName", "applicantLastName", "dob", "ssnEncrypted",
    "phone", "email", "addressLine1", "addressLine2", "city", "state", "postalCode",
    "housingStatus", "housingPaymentCents", "yearsAtResidence", "employerName", "jobTitle",
    "employmentYears", "monthlyIncomeCents", "otherIncomeCents", "notes",
    "submittedAt", "decisionedAt", "updatedByUserId",
  ];
  for (const k of keys) {
    if (data[k] !== undefined) (payload as Record<string, unknown>)[k] = data[k];
  }
  return prisma.creditApplication.update({
    where: { id },
    data: payload as Parameters<typeof prisma.creditApplication.update>[0]["data"],
  });
}

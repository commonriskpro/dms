import { prisma } from "@/lib/db";
import type { FinanceApplicantRole } from "@prisma/client";

export type FinanceApplicantCreateInput = {
  applicationId: string;
  role: FinanceApplicantRole;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  employerName?: string | null;
};

export type FinanceApplicantUpdateInput = {
  role?: FinanceApplicantRole;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  employerName?: string | null;
};

export type ListApplicantsOptions = {
  limit: number;
  offset: number;
};

export async function getApplicantById(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.financeApplicant.findFirst>> | null> {
  return prisma.financeApplicant.findFirst({
    where: { id, dealershipId },
  });
}

export async function listApplicantsByApplicationId(
  dealershipId: string,
  applicationId: string,
  options: ListApplicantsOptions
): Promise<{
  data: Awaited<ReturnType<typeof prisma.financeApplicant.findMany>>;
  total: number;
}> {
  const where = { dealershipId, applicationId };
  const [data, total] = await Promise.all([
    prisma.financeApplicant.findMany({
      where,
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: options.limit,
      skip: options.offset,
    }),
    prisma.financeApplicant.count({ where }),
  ]);
  return { data, total };
}

export async function createApplicant(
  dealershipId: string,
  data: FinanceApplicantCreateInput
): Promise<Awaited<ReturnType<typeof prisma.financeApplicant.create>>> {
  return prisma.financeApplicant.create({
    data: {
      dealershipId,
      applicationId: data.applicationId,
      role: data.role,
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country ?? null,
      employerName: data.employerName ?? null,
    },
  });
}

export async function updateApplicant(
  dealershipId: string,
  id: string,
  data: FinanceApplicantUpdateInput
): Promise<Awaited<ReturnType<typeof prisma.financeApplicant.update>> | null> {
  const existing = await prisma.financeApplicant.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.role !== undefined) payload.role = data.role;
  if (data.fullName !== undefined) payload.fullName = data.fullName;
  if (data.email !== undefined) payload.email = data.email;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.addressLine1 !== undefined) payload.addressLine1 = data.addressLine1;
  if (data.addressLine2 !== undefined) payload.addressLine2 = data.addressLine2;
  if (data.city !== undefined) payload.city = data.city;
  if (data.region !== undefined) payload.region = data.region;
  if (data.postalCode !== undefined) payload.postalCode = data.postalCode;
  if (data.country !== undefined) payload.country = data.country;
  if (data.employerName !== undefined) payload.employerName = data.employerName;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.financeApplicant.update({
    where: { id },
    data: payload as Parameters<typeof prisma.financeApplicant.update>[0]["data"],
  });
}

export async function deleteApplicant(
  dealershipId: string,
  id: string
): Promise<{ id: string } | null> {
  const existing = await prisma.financeApplicant.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  await prisma.financeApplicant.delete({ where: { id } });
  return { id };
}

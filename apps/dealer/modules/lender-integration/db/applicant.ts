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

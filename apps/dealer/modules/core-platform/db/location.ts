import { prisma } from "@/lib/db";

export async function listLocations(dealershipId: string, limit: number, offset: number) {
  const [data, total] = await Promise.all([
    prisma.dealershipLocation.findMany({
      where: { dealershipId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.dealershipLocation.count({ where: { dealershipId } }),
  ]);
  return { data, total };
}

export async function getLocationById(dealershipId: string, id: string) {
  return prisma.dealershipLocation.findFirst({
    where: { id, dealershipId },
  });
}

export async function createLocation(
  dealershipId: string,
  data: {
    name: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    isPrimary?: boolean;
  }
) {
  return prisma.dealershipLocation.create({
    data: {
      dealershipId,
      name: data.name,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country ?? null,
      isPrimary: data.isPrimary ?? false,
    },
  });
}

export async function updateLocation(
  dealershipId: string,
  id: string,
  data: Partial<{
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    isPrimary: boolean;
  }>
) {
  const existing = await prisma.dealershipLocation.findFirst({ where: { id, dealershipId } });
  if (!existing) return null;
  return prisma.dealershipLocation.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 }),
      ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.region !== undefined && { region: data.region }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
    },
  });
}

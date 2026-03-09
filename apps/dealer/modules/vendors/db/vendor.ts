import { prisma } from "@/lib/db";
import type { VendorType } from "@prisma/client";

export type VendorCreateInput = {
  name: string;
  type: VendorType;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type VendorUpdateInput = {
  name?: string;
  type?: VendorType;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type ListVendorsOptions = {
  limit: number;
  offset: number;
  search?: string;
  type?: VendorType;
  /** If true, include soft-deleted. Default false = exclude deleted from list/picker. */
  includeDeleted?: boolean;
};

export async function getVendorById(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.vendor.findFirst>> | null> {
  return prisma.vendor.findFirst({
    where: { id, dealershipId },
  });
}

/** List vendors; by default excludes soft-deleted (deletedAt null). */
export async function listVendors(
  dealershipId: string,
  options: ListVendorsOptions
): Promise<{ data: Awaited<ReturnType<typeof prisma.vendor.findMany>>; total: number }> {
  const where = {
    dealershipId,
    ...(options.includeDeleted !== true && { deletedAt: null }),
    ...(options.search?.trim() && {
      name: { contains: options.search.trim(), mode: "insensitive" as const },
    }),
    ...(options.type && { type: options.type }),
  };
  const [data, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { name: "asc" },
      take: options.limit,
      skip: options.offset,
      include: {
        _count: { select: { vehicleCostEntries: true } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);
  return { data, total };
}

export async function createVendor(
  dealershipId: string,
  data: VendorCreateInput
): Promise<Awaited<ReturnType<typeof prisma.vendor.create>>> {
  return prisma.vendor.create({
    data: {
      dealershipId,
      name: data.name,
      type: data.type,
      contactName: data.contactName ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateVendor(
  dealershipId: string,
  id: string,
  data: VendorUpdateInput
): Promise<Awaited<ReturnType<typeof prisma.vendor.update>> | null> {
  const existing = await prisma.vendor.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.type !== undefined) payload.type = data.type;
  if (data.contactName !== undefined) payload.contactName = data.contactName;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.email !== undefined) payload.email = data.email;
  if (data.address !== undefined) payload.address = data.address;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.vendor.update({
    where: { id },
    data: payload as Parameters<typeof prisma.vendor.update>[0]["data"],
  });
}

/** Soft-delete vendor. Sets deletedAt and deletedBy. */
export async function softDeleteVendor(
  dealershipId: string,
  id: string,
  deletedBy: string
): Promise<Awaited<ReturnType<typeof prisma.vendor.update>> | null> {
  const existing = await prisma.vendor.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.vendor.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
  });
}

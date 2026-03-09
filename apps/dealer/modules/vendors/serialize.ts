import type { Vendor } from "@prisma/client";

export type VendorWithCount = Vendor & {
  _count?: { vehicleCostEntries: number };
};

export function serializeVendor(v: Vendor | VendorWithCount) {
  const count = "_count" in v && v._count ? v._count.vehicleCostEntries : undefined;
  return {
    id: v.id,
    dealershipId: v.dealershipId,
    name: v.name,
    type: v.type,
    contactName: v.contactName,
    phone: v.phone,
    email: v.email,
    address: v.address,
    notes: v.notes,
    isActive: v.isActive,
    createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
    updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : v.updatedAt,
    deletedAt: v.deletedAt instanceof Date ? v.deletedAt.toISOString() : v.deletedAt,
    ...(count !== undefined && { costEntryCount: count }),
  };
}

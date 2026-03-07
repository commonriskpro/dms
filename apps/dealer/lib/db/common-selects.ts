/**
 * Canonical Prisma select shapes reused across multiple db layers.
 * Import these instead of defining inline object literals.
 */

export const PROFILE_SELECT = {
  id: true,
  fullName: true,
  email: true,
} as const;

export const VEHICLE_SUMMARY_SELECT = {
  id: true,
  vin: true,
  year: true,
  make: true,
  model: true,
  stockNumber: true,
} as const;

export const CUSTOMER_SUMMARY_SELECT = {
  id: true,
  name: true,
} as const;

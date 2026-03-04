/**
 * Reports DB layer: read-only aggregates on Deal, DealHistory, Vehicle, DealFinance, Customer.
 * Every query scoped by dealershipId. No new Prisma models; uses existing tables.
 */
export * from "./sales";
export * from "./inventory";
export * from "./finance";

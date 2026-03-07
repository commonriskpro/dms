/**
 * Tenant-safe cache key helpers.
 * All keys follow the pattern: dealer:{dealershipId}:cache:{resource}:{discriminator}
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { createHash } from "crypto";

/** Hash arbitrary params to an 8-char hex string for use in cache keys. */
export function paramsHash(params: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 8);
}

/** Hash an array of permission strings to a short key discriminator. */
export function permissionsHash(permissions: string[]): string {
  return paramsHash([...permissions].sort());
}

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

/** Dashboard V3 KPIs — permission-aware (output varies by RBAC). */
export function dashboardKpisKey(dealershipId: string, permHash: string): string {
  return `dealer:${dealershipId}:cache:dashboard:kpis:${permHash}`;
}

/** Inventory intelligence dashboard aggregates. */
export function inventoryIntelKey(dealershipId: string, queryHash: string): string {
  return `dealer:${dealershipId}:cache:inventory:intel:${queryHash}`;
}

/** Deal pipeline summary. */
export function pipelineKey(dealershipId: string): string {
  return `dealer:${dealershipId}:cache:pipeline:v1`;
}

/** Reports — parameterised by report type + query params. */
export function reportKey(
  dealershipId: string,
  type: "sales-summary" | "finance-penetration" | "inventory-aging",
  queryHash: string
): string {
  return `dealer:${dealershipId}:cache:reports:${type}:${queryHash}`;
}

// ---------------------------------------------------------------------------
// Prefix helpers — used for invalidation
// ---------------------------------------------------------------------------

/** All dashboard cache entries for a dealership. */
export function dashboardPrefix(dealershipId: string): string {
  return `dealer:${dealershipId}:cache:dashboard:`;
}

/** All inventory cache entries for a dealership. */
export function inventoryPrefix(dealershipId: string): string {
  return `dealer:${dealershipId}:cache:inventory:`;
}

/** All pipeline cache entries for a dealership. */
export function pipelinePrefix(dealershipId: string): string {
  return `dealer:${dealershipId}:cache:pipeline:`;
}

/** All report cache entries for a dealership. */
export function reportsPrefix(dealershipId: string): string {
  return `dealer:${dealershipId}:cache:reports:`;
}

/** Everything for a dealership (nuclear option — use sparingly). */
export function allCachePrefix(dealershipId: string): string {
  return `dealer:${dealershipId}:cache:`;
}

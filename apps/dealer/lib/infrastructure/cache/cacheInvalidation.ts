/**
 * Cache invalidation — event listeners wired to cache delPrefix calls.
 * All invalidation is fire-and-forget (errors logged, never thrown).
 *
 * Called once from instrumentation.ts (nodejs runtime only).
 * NO imports from modules/* — infrastructure layer is module-independent.
 * Uses typed event bus (eventBus.ts).
 */

import { registerListener, clearListeners } from "@/lib/infrastructure/events/eventBus";
import { invalidatePrefix } from "@/lib/infrastructure/cache/cacheHelpers";
import {
  dashboardPrefix,
  inventoryPrefix,
  pipelinePrefix,
  reportsPrefix,
} from "@/lib/infrastructure/cache/cacheKeys";

let registered = false;

/**
 * Register event bus → cache invalidation listeners.
 * Idempotent: safe to call multiple times (only registers once).
 */
export function registerCacheInvalidationListeners(): void {
  if (registered) return;
  registered = true;

  registerListener("vehicle.created", (payload) => {
    void invalidatePrefix(inventoryPrefix(payload.dealershipId));
    void invalidatePrefix(dashboardPrefix(payload.dealershipId));
  });

  registerListener("vehicle.updated", (payload) => {
    void invalidatePrefix(inventoryPrefix(payload.dealershipId));
    void invalidatePrefix(dashboardPrefix(payload.dealershipId));
  });

  registerListener("deal.sold", (payload) => {
    void invalidatePrefix(dashboardPrefix(payload.dealershipId));
    void invalidatePrefix(pipelinePrefix(payload.dealershipId));
    void invalidatePrefix(reportsPrefix(payload.dealershipId));
  });

  registerListener("customer.created", (payload) => {
    void invalidatePrefix(dashboardPrefix(payload.dealershipId));
  });

  registerListener("deal.status_changed", (payload) => {
    void invalidatePrefix(pipelinePrefix(payload.dealershipId));
    void invalidatePrefix(dashboardPrefix(payload.dealershipId));
  });
}

/** Reset for tests — clears flag and removes our listeners from the bus. */
export function _resetCacheInvalidationListeners(): void {
  clearListeners();
  registered = false;
}

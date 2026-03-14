/**
 * Registry of dealer API routes under app/api/internal/.
 * Used by architecture tests to ensure every internal route is either:
 * - a platform-called bridge route (documented in docs/canonical/DEALER_PLATFORM_BRIDGE_SURFACE.md), or
 * - a dealer-only internal route (e.g. job triggers, worker-called).
 *
 * When adding a new route under app/api/internal/, add its path here to either
 * PLATFORM_CALLED_BRIDGE_ROUTES or DEALER_ONLY_INTERNAL_ROUTES, then run:
 *   npm run test:dealer -- tests/architecture/dealer-internal-routes-registered.test.ts
 */

/** Paths (relative to app/api/) for internal routes called by apps/platform. Must stay in sync with docs/canonical/DEALER_PLATFORM_BRIDGE_SURFACE.md. */
export const PLATFORM_CALLED_BRIDGE_ROUTES: string[] = [
  "internal/provision/dealership",
  "internal/dealerships/[dealerDealershipId]/status",
  "internal/dealerships/[dealerDealershipId]/owner-invite",
  "internal/dealerships/[dealerDealershipId]/owner-invite-status",
  "internal/dealerships/[dealerDealershipId]/invites",
  "internal/dealerships/[dealerDealershipId]/invites/[inviteId]",
  "internal/monitoring/job-runs",
  "internal/monitoring/job-runs/daily",
  "internal/monitoring/rate-limits",
  "internal/monitoring/rate-limits/daily",
  "internal/monitoring/maintenance/run",
  "internal/dealer-applications/[id]/platform-state",
];

/** Paths (relative to app/api/) for internal routes used only by dealer app or worker (e.g. job triggers). Not called by platform. */
export const DEALER_ONLY_INTERNAL_ROUTES: string[] = [
  "internal/jobs/crm",
  "internal/jobs/vin-decode",
  "internal/jobs/bulk-import",
  "internal/jobs/analytics",
  "internal/jobs/alerts",
];

const ALL_REGISTERED = new Set([
  ...PLATFORM_CALLED_BRIDGE_ROUTES,
  ...DEALER_ONLY_INTERNAL_ROUTES,
]);

export function isRegisteredInternalRoute(apiPath: string): boolean {
  return ALL_REGISTERED.has(apiPath);
}

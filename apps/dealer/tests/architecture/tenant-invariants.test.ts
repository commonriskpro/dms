/** @jest-environment node */
/**
 * Tenant-scope invariants: dealer tenant must be server-derived, not client-trusted.
 * - No tenant-facing route accepts dealershipId from body/query for scope.
 * - Protected routes use getAuthContext or approved internal/session helpers.
 */
import path from "node:path";
import { listFiles, toRelative, readFile, DEALER_ROOT } from "./helpers";

const DEALER_API_APP = path.join(DEALER_ROOT, "app/api");

/**
 * Path segments that are allowed to accept dealershipId in payload (trusted internal/admin callers or validated switch).
 * Documented in ARCHITECTURE_FITNESS_SUITE_SPEC.md.
 */
const ALLOWED_DEALERSHIP_ID_IN_PAYLOAD = [
  "internal/", // worker/platform call with signed JWT
  "admin/inventory/vehicle-photos/backfill/", // admin backfill with explicit scope
  "auth/session/switch/", // user switches active dealership; service validates membership
];

function isUnderAllowedPath(relativePath: string): boolean {
  return ALLOWED_DEALERSHIP_ID_IN_PAYLOAD.some((seg) => relativePath.includes(seg));
}

describe("tenant-scope invariants", () => {
  it("tenant-facing dealer route schemas do not accept client-supplied dealershipId for scope", () => {
    const routeFiles = listFiles(DEALER_API_APP)
      .map((f) => toRelative(f))
      .filter((p) => p.endsWith("/route.ts"));

    const violations: string[] = [];
    for (const relativePath of routeFiles) {
      if (isUnderAllowedPath(relativePath)) continue;
      const content = readFile(relativePath);
      // Schema/body that includes dealershipId for tenant scope is unsafe unless allowlisted.
      // We only flag routes that both (1) parse body/query and (2) use dealershipId from that parsed input for tenant scope.
      // High-signal: schema object with dealershipId that is used in a tenant-sensitive way is conventionally in a .schema or schema in same dir.
      // Simplified check: route file that references dealershipId in a zod schema (e.g. body.dealershipId or schema with dealershipId) and is NOT internal/admin backfill.
      const hasSchemaWithDealershipId =
        /\.(dealershipId|dealership_id)\s*[=:]|z\.object\([^)]*dealershipId|body\.dealershipId|query\.dealershipId/.test(
          content
        ) && /dealershipId.*z\.|z\..*dealershipId/.test(content);
      if (hasSchemaWithDealershipId) {
        violations.push(relativePath);
      }
    }
    expect(violations).toEqual([]);
  });

  it("protected dealer API routes use server-derived context (getAuthContext or verifyInternalRequest or session helpers)", () => {
    const routeFiles = listFiles(DEALER_API_APP)
      .map((f) => toRelative(f))
      .filter((p) => p.endsWith("/route.ts"));

    const noAuthRequiredPrefixes = [
      "public/",
      "invite/",
      "apply/",
      "auth/",
      "support-session/",
      "webhooks/",
      "health/",
      "metrics/",
      "cache/",
      "internal/",
    ];

    const missingAuth: string[] = [];
    const authPattern =
      /getAuthContext|verifyInternalRequest|getSessionContextOrNull|decryptSupportSessionPayload|requireUserFromRequest|requireUser\b/;

    for (const relativePath of routeFiles) {
      const noAuth = noAuthRequiredPrefixes.some((pref) => relativePath.includes(pref));
      if (noAuth) continue;
      const content = readFile(relativePath);
      if (!authPattern.test(content)) {
        missingAuth.push(relativePath);
      }
    }

    expect(missingAuth).toEqual([]);
  });
});

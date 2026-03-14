/** @jest-environment node */
/**
 * Phase 2 architecture fitness: shared contracts, RBAC consistency, cache keys, event payloads.
 * See docs/ARCHITECTURE_FITNESS_SUITE_SPEC.md and ARCHITECTURE_FITNESS_SUITE_REPORT.md.
 */
import path from "node:path";
import { listFiles, toRelative, readFile, DEALER_ROOT, isTestFile } from "./helpers";

// ---------------------------------------------------------------------------
// Shared contract discipline
// ---------------------------------------------------------------------------

describe("Phase 2: shared contract discipline", () => {
  it("dealer files using PublicVehicleSummary or PublicVehicleDetail import from @dms/contracts", () => {
    const sourceFiles = listFiles(DEALER_ROOT)
      .map((f) => toRelative(f))
      .filter((p) => (p.endsWith(".ts") || p.endsWith(".tsx")) && !isTestFile(p) && !p.includes("/docs/"))
      .filter((p) => {
        const content = readFile(p);
        return (
          content.includes("PublicVehicleSummary") || content.includes("PublicVehicleDetail")
        );
      });

    const violations = sourceFiles.filter((p) => {
      const content = readFile(p);
      const fromContracts =
        /from\s+["']@dms\/contracts["']/.test(content) ||
        /from\s+["']@dms\/contracts\/[\s\S]*websites-public["']/.test(content);
      return !fromContracts;
    });

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RBAC permission consistency
// ---------------------------------------------------------------------------

const ROUTES_ALLOWED_WITHOUT_GUARD = [
  "app/api/me/route.ts",
  "app/api/me/current-dealership/route.ts",
  "app/api/me/dealerships/route.ts",
  "app/api/auth/session/route.ts",
  "app/api/auth/session/switch/route.ts",
  "app/api/dashboard/layout/route.ts",
  "app/api/dashboard/layout/reset/route.ts",
  "app/api/admin/bootstrap-link-owner/route.ts",
  "app/api/search/route.ts",
];

describe("Phase 2: RBAC permission consistency", () => {
  it("dealer API route files that use getAuthContext also use guardPermission or guardAnyPermission (unless allowlisted)", () => {
    const apiApp = path.join(DEALER_ROOT, "app/api");
    const routeFiles = listFiles(apiApp)
      .map((f) => toRelative(f))
      .filter((p) => p.endsWith("/route.ts"));

    const noAuthPrefixes = [
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

    const missingGuard: string[] = [];
    for (const relativePath of routeFiles) {
      if (noAuthPrefixes.some((pref) => relativePath.includes(pref))) continue;
      if (ROUTES_ALLOWED_WITHOUT_GUARD.includes(relativePath)) continue;
      const content = readFile(relativePath);
      if (!content.includes("getAuthContext") && !content.includes("requireUser")) continue;
      const hasGuard =
        /guardPermission\s*\(/.test(content) || /guardAnyPermission\s*\(/.test(content);
      if (!hasGuard) missingGuard.push(relativePath);
    }

    expect(missingGuard).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cache key shape
// ---------------------------------------------------------------------------

const FILES_ALLOWED_WITHOUT_CACHEKEYS_IMPORT = [
  "modules/deals/service/board.ts", // uses BOARD_CACHE_KEY; migrate to cacheKeys in future
  "modules/inventory/service/inventory-page.ts", // uses keys from inventory intel / cache helpers
  "lib/infrastructure/cache/cacheHelpers.ts", // defines withCache
  "modules/core/tests/cache.test.ts",
  "modules/core/tests/cache-observability.test.ts",
  "tests/architecture/phase2-fitness.test.ts", // test file
];

describe("Phase 2: cache key shape", () => {
  it("dealer source files that call withCache import key builders from cacheKeys (unless allowlisted)", () => {
    const files = listFiles(DEALER_ROOT)
      .map((f) => toRelative(f))
      .filter((p) => (p.endsWith(".ts") || p.endsWith(".tsx")) && !p.includes("node_modules"));

    const usesWithCache = files.filter((p) => readFile(p).includes("withCache("));
    const violations = usesWithCache.filter((p) => {
      if (FILES_ALLOWED_WITHOUT_CACHEKEYS_IMPORT.includes(p)) return false;
      const content = readFile(p);
      const fromCacheKeys = /from\s+["']@\/lib\/infrastructure\/cache\/cacheKeys["']/.test(content);
      return !fromCacheKeys;
    });

    expect(violations).toEqual([]);
  });

  it("cacheKeys key builders follow dealer:{dealershipId}:cache:{resource} pattern", () => {
    const content = readFile("lib/infrastructure/cache/cacheKeys.ts");
    const keyPattern = /return\s*`([^`]+)`/g;
    const matches = [...content.matchAll(keyPattern)];
    for (const m of matches) {
      const keyTemplate = m[1];
      expect(keyTemplate.startsWith("dealer:")).toBe(true);
      expect(keyTemplate).toMatch(/dealer:\$\{[^}]+\}:cache:/);
    }
  });
});

// ---------------------------------------------------------------------------
// Event payload shape (dealershipId)
// ---------------------------------------------------------------------------

describe("Phase 2: event payload shape", () => {
  it("non-test dealer source files that call emitEvent include dealershipId in the same call block", () => {
    const sourceFiles = listFiles(DEALER_ROOT)
      .map((f) => toRelative(f))
      .filter(
        (p) =>
          (p.endsWith(".ts") || p.endsWith(".tsx")) &&
          !isTestFile(p) &&
          !p.includes("/node_modules/") &&
          !p.includes("/docs/")
      );

    const violations: string[] = [];
    for (const relativePath of sourceFiles) {
      const content = readFile(relativePath);
      if (!content.includes("emitEvent(")) continue;

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes("emitEvent(")) continue;
        const blockLines = lines.slice(i, Math.min(i + 15, lines.length)).join("\n");
        const blockEnd = blockLines.search(/\}\)\s*;|}\)\s*\)/);
        const block = blockEnd >= 0 ? blockLines.slice(0, blockEnd + 5) : blockLines;
        if (!/\bdealershipId\b/.test(block)) {
          violations.push(`${relativePath}:${i + 1}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

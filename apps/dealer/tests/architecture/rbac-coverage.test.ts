/** @jest-environment node */
/**
 * RBAC coverage: protected routes must use guard/auth patterns.
 * - Dealer: routes that require auth should use getAuthContext (already asserted in tenant-invariants).
 * - Platform: api/platform routes must use requirePlatformAuth or requirePlatformRole except allowlisted.
 */
import path from "node:path";
import { listFiles, readAbsolute, REPO_ROOT } from "./helpers";

const PLATFORM_API = path.join(REPO_ROOT, "apps/platform/app/api/platform");

/**
 * Platform route path segments that do not require requirePlatformAuth (e.g. auth callback, public).
 */
const PLATFORM_NO_GUARD_PATHS = [
  "auth/callback/",
  "auth/logout/",
  "auth/forgot-password/",
  "auth/reset-password/",
  "auth/verify-email/",
  "auth/debug/",
  "bootstrap/", // may be unauthenticated bootstrap
];

describe("RBAC coverage", () => {
  it("platform API routes under api/platform use requirePlatformAuth or requirePlatformRole", () => {
    const routeFiles = listFiles(PLATFORM_API)
      .filter((p) => p.endsWith("/route.ts"))
      .map((p) => path.relative(REPO_ROOT, p).replaceAll(path.sep, "/"));

    const missing: string[] = [];
    const guardPattern = /requirePlatformAuth|requirePlatformRole/;

    for (const relativePath of routeFiles) {
      const allowed = PLATFORM_NO_GUARD_PATHS.some((pref) => relativePath.includes(pref));
      if (allowed) continue;
      const content = readAbsolute(path.join(REPO_ROOT, relativePath));
      if (!guardPattern.test(content)) {
        missing.push(relativePath);
      }
    }

    expect(missing).toEqual([]);
  });
});

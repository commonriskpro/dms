/** @jest-environment node */
/**
 * Every dealer internal API route under app/api/internal/ must be registered
 * in lib/dealer-bridge-routes.ts as either a platform-called bridge route or a dealer-only internal route.
 * This prevents accidental addition of unregistered internal routes and keeps the boundary doc in sync.
 */
import path from "node:path";
import { listFiles, DEALER_ROOT } from "./helpers";
import { isRegisteredInternalRoute } from "@/lib/dealer-bridge-routes";

const APP_API = path.join(DEALER_ROOT, "app", "api");

function getInternalRoutePaths(): string[] {
  const allFiles = listFiles(path.join(DEALER_ROOT, "app", "api"));
  const internalRouteFiles = allFiles.filter(
    (f) => f.includes("/internal/") && f.endsWith("route.ts")
  );
  return internalRouteFiles.map((f) => {
    const relative = path.relative(APP_API, f);
    return relative.replace(/\/route\.ts$/, "");
  });
}

describe("dealer internal routes are registered", () => {
  it("every app/api/internal/**/route.ts is in dealer-bridge-routes registry", () => {
    const paths = getInternalRoutePaths();
    const unregistered = paths.filter((p) => !isRegisteredInternalRoute(p));
    expect(unregistered).toEqual([]);
  });
});

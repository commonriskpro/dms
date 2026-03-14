/** @jest-environment node */
/**
 * Dealer must not host platform-only routes or pages.
 * - No app/platform/* page tree.
 * - No app/api/platform/* API routes.
 * Adding platform control-plane surface in dealer would violate the dealer/platform boundary.
 */
import path from "node:path";
import { listFiles, DEALER_ROOT } from "./helpers";

describe("dealer must not have platform routes or pages", () => {
  it("has no files under app/platform", () => {
    const platformAppDir = path.join(DEALER_ROOT, "app", "platform");
    const files = listFiles(platformAppDir);
    expect(files).toHaveLength(0);
  });

  it("has no route files under app/api/platform", () => {
    const platformApiDir = path.join(DEALER_ROOT, "app", "api", "platform");
    const files = listFiles(platformApiDir).filter((f) => f.endsWith("route.ts"));
    expect(files).toHaveLength(0);
  });
});

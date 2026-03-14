/** @jest-environment node */
/**
 * App boundary enforcement:
 * - Platform must not import dealer app/modules.
 * - Mobile must not import platform or dealer server-only internals.
 * - Worker must not import dealer business modules (service/db).
 */
import path from "node:path";
import { listFiles, readAbsolute, REPO_ROOT } from "./helpers";

const PLATFORM_SOURCE = path.join(REPO_ROOT, "apps/platform");
const MOBILE_SOURCE = path.join(REPO_ROOT, "apps/mobile");
const WORKER_SOURCE = path.join(REPO_ROOT, "apps/worker");

function getImports(content: string): string[] {
  const fromMatches = [...content.matchAll(/from\s+["']([^"']+)["']/g)];
  return fromMatches.map((m) => m[1]);
}

describe("app boundary enforcement", () => {
  it("platform must not import from dealer app or dealer modules", () => {
    const files = listFiles(PLATFORM_SOURCE).filter(
      (f) => !f.includes("/node_modules/") && (f.endsWith(".ts") || f.endsWith(".tsx"))
    );
    const violations: string[] = [];
    for (const file of files) {
      const content = readAbsolute(file);
      const imports = getImports(content);
      const dealerImport = imports.find(
        (i) =>
          i.startsWith("dealer/") ||
          i.includes("apps/dealer") ||
          i === "@dms/dealer" ||
          /@\/.*modules\/.*dealer/.test(i)
      );
      if (dealerImport) {
        violations.push(path.relative(REPO_ROOT, file) + " -> " + dealerImport);
      }
    }
    expect(violations).toEqual([]);
  });

  it("mobile must not import platform app or dealer server-only internals", () => {
    const files = listFiles(MOBILE_SOURCE).filter(
      (f) => !f.includes("/node_modules/") && (f.endsWith(".ts") || f.endsWith(".tsx"))
    );
    const violations: string[] = [];
    for (const file of files) {
      const content = readAbsolute(file);
      const imports = getImports(content);
      for (const imp of imports) {
        if (imp.includes("apps/platform") || imp.startsWith("platform/") || imp === "@dms/platform") {
          violations.push(path.relative(REPO_ROOT, file) + " -> " + imp);
        }
        if (imp.includes("apps/dealer") || imp.startsWith("dealer/") || imp === "@dms/dealer") {
          violations.push(path.relative(REPO_ROOT, file) + " -> " + imp);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("worker must not import dealer module service or db layers", () => {
    const files = listFiles(WORKER_SOURCE).filter(
      (f) => !f.includes("/node_modules/") && (f.endsWith(".ts") || f.endsWith(".tsx"))
    );
    const violations: string[] = [];
    for (const file of files) {
      const content = readAbsolute(file);
      const imports = getImports(content);
      for (const imp of imports) {
        if (imp.includes("apps/dealer") && (imp.includes("/modules/") && (imp.includes("/service/") || imp.includes("/db/")))) {
          violations.push(path.relative(REPO_ROOT, file) + " -> " + imp);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

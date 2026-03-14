/** @jest-environment node */
import path from "node:path";
import { listFiles, toRelative, isTestFile, readFile, DEALER_ROOT } from "./helpers";

const ROUTE_PRISMA_ALLOWLIST: string[] = [];
const CROSS_MODULE_DB_ALLOWLIST: string[] = [];
const LIB_LAYER_IMPORT_ALLOWLIST: string[] = [];

describe("dealer modular boundary guardrails", () => {
  it("keeps route files off direct Prisma imports except documented legacy exceptions", () => {
    const files = listFiles(path.join(DEALER_ROOT, "app"));
    const violations = files
      .map((f) => toRelative(f))
      .filter((relativePath) => relativePath.endsWith("/route.ts"))
      .filter((relativePath) => /from\s+["']@\/lib\/db["']/.test(readFile(relativePath)))
      .sort();

    expect(violations).toEqual(ROUTE_PRISMA_ALLOWLIST);
  });

  it("keeps UI files off module db imports", () => {
    const appUiFiles = listFiles(path.join(DEALER_ROOT, "app"))
      .map((f) => toRelative(f))
      .filter((relativePath) => !relativePath.includes("/api/"))
      .filter((relativePath) => !isTestFile(relativePath));
    const moduleUiFiles = listFiles(path.join(DEALER_ROOT, "modules"))
      .map((f) => toRelative(f))
      .filter((relativePath) => relativePath.includes("/ui/"))
      .filter((relativePath) => !isTestFile(relativePath));

    const violations = [...appUiFiles, ...moduleUiFiles]
      .filter((relativePath) => /from\s+["']@\/modules\/.+\/db\//.test(readFile(relativePath)))
      .sort();

    expect(violations).toEqual([]);
  });

  it("prevents new cross-module db imports in module source files", () => {
    const violations = listFiles(path.join(DEALER_ROOT, "modules"))
      .map((f) => toRelative(f))
      .filter((relativePath) => !relativePath.includes("/db/"))
      .filter((relativePath) => !isTestFile(relativePath))
      .filter((relativePath) => {
        const source = readFile(relativePath);
        const currentModule = relativePath.split("/")[1];
        const matches = [...source.matchAll(/from\s+["']@\/modules\/([^/]+)\/db\//g)];
        return matches.some((match) => match[1] !== currentModule);
      })
      .sort();

    expect(violations).toEqual(CROSS_MODULE_DB_ALLOWLIST);
  });

  it("keeps lib free of module-layer imports", () => {
    const violations = listFiles(path.join(DEALER_ROOT, "lib"))
      .map((f) => toRelative(f))
      .filter((relativePath) => !isTestFile(relativePath))
      .filter((relativePath) => /from\s+["']@\/modules\/.+\/(db|service|ui)\//.test(readFile(relativePath)))
      .sort();

    expect(violations).toEqual(LIB_LAYER_IMPORT_ALLOWLIST);
  });
});

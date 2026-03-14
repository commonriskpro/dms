/**
 * Shared helpers for architecture tests.
 * All paths are relative to DEALER_ROOT (apps/dealer) unless REPO_ROOT is used.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const DEALER_ROOT = process.cwd();
export const REPO_ROOT = path.resolve(DEALER_ROOT, "../..");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

export function listFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...listFiles(fullPath));
        continue;
      }
      if (SOURCE_EXTENSIONS.has(path.extname(fullPath))) {
        results.push(fullPath);
      }
    }
  } catch {
    // directory may not exist in some workspaces
  }
  return results;
}

export function toRelative(filePath: string, base: string = DEALER_ROOT): string {
  return path.relative(base, filePath).replaceAll(path.sep, "/");
}

export function isTestFile(relativePath: string): boolean {
  return (
    relativePath.includes("/__tests__/") ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".test.tsx") ||
    relativePath.endsWith(".spec.ts") ||
    relativePath.endsWith(".spec.tsx")
  );
}

export function readFile(relativePath: string, base: string = DEALER_ROOT): string {
  return readFileSync(path.join(base, relativePath), "utf8");
}

export function readAbsolute(absolutePath: string): string {
  return readFileSync(absolutePath, "utf8");
}

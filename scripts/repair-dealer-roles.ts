/**
 * Run dealer role repair using DIRECT_DATABASE_URL when set (avoids pooler hang on Supabase).
 * With Supabase, use pooler (port 6543) for app and direct (port 5432) for this script.
 *
 * Usage: npx tsx scripts/repair-dealer-roles.ts
 * Loads .env.local; if DIRECT_DATABASE_URL is set, uses it as DATABASE_URL.
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "dotenv";

const ROOT = resolve(process.cwd());

function loadEnv(path: string): Record<string, string> {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) return {};
  try {
    return parse(readFileSync(full, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function main() {
  const env = loadEnv(".env.local");
  const databaseUrl = env.DIRECT_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      ".env.local: set DATABASE_URL or DIRECT_DATABASE_URL. For Supabase, use direct (port 5432) to avoid pooler hang."
    );
    process.exit(1);
  }

  const appDir = resolve(ROOT, "apps/dealer");
  const envForChild = { ...process.env, DATABASE_URL: databaseUrl };
  const source = env.DIRECT_DATABASE_URL ? "DIRECT_DATABASE_URL" : "DATABASE_URL";
  console.log(`Running repair-provisioned-roles in apps/dealer (using ${source})...`);
  execSync("npx tsx scripts/repair-provisioned-roles.ts", {
    encoding: "utf-8",
    stdio: "inherit",
    env: envForChild,
    cwd: appDir,
  });
  console.log("Done.");
}

main();

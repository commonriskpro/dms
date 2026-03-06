/**
 * Run Prisma migrate reset using DIRECT_DATABASE_URL when set (avoids pooler hang on Supabase).
 * With Supabase, use pooler (port 6543) for app and direct (port 5432) for reset.
 *
 * Usage: npx tsx scripts/prisma-reset.ts dealer | platform
 * Loads .env.local (dealer) or .env.platform-admin (platform); if DIRECT_DATABASE_URL
 * is set, uses it as DATABASE_URL for the reset so Prisma talks to Postgres directly.
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
  const target = process.argv[2];
  if (target !== "dealer" && target !== "platform") {
    console.error("Usage: npx tsx scripts/prisma-reset.ts dealer | platform");
    process.exit(1);
  }

  const envFile = target === "dealer" ? ".env.local" : ".env.platform-admin";
  const env = loadEnv(envFile);
  const databaseUrl = env.DIRECT_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(`${envFile}: set DATABASE_URL or DIRECT_DATABASE_URL. For Supabase reset, use direct connection (port 5432) to avoid pooler hang.`);
    process.exit(1);
  }

  const appDir = target === "dealer" ? "apps/dealer" : "apps/platform";
  const envForChild = { ...process.env, DATABASE_URL: databaseUrl };
  console.log(`Running prisma migrate reset --force in ${appDir} (using ${env.DIRECT_DATABASE_URL ? "DIRECT_DATABASE_URL" : "DATABASE_URL"})...`);
  execSync("npx prisma migrate reset --force", {
    encoding: "utf-8",
    stdio: "inherit",
    env: envForChild,
    cwd: resolve(ROOT, appDir),
  });
  console.log("Done.");
}

main();

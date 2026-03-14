/**
 * Print which DB and auth URLs dev:dealer and dev:platform use.
 * Run from repo root: npx tsx scripts/check-dev-env.ts
 *
 * dev:dealer uses: dotenv -e .env.local
 * dev:platform uses: dotenv -e .env.platform-admin
 */
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

function maskUrl(url: string): string {
  if (!url || !url.includes("://")) return url;
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username && u.username !== "postgres") u.username = "***";
    return u.toString();
  } catch {
    return url.replace(/:[^:@]+@/, ":***@");
  }
}

function main() {
  const dealerEnv = loadEnv(".env.local");
  const platformEnv = loadEnv(".env.platform-admin");

  const dealerDb = dealerEnv.DIRECT_DATABASE_URL ?? dealerEnv.DATABASE_URL ?? "";
  const platformDb = platformEnv.DIRECT_DATABASE_URL ?? platformEnv.DATABASE_URL ?? "";
  const dealerSupabase = dealerEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const platformSupabase = platformEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const isLocal = (url: string) =>
    /127\.0\.0\.1|localhost|:\/\/postgres:/.test(url) || url.includes("dms_dealer") || url.includes("dms_platform");

  console.log("npm run dev:dealer  (loads .env.local)");
  if (!dealerDb) {
    console.log("  .env.local not found or has no DATABASE_URL/DIRECT_DATABASE_URL");
  } else {
    console.log("  DB:  ", maskUrl(dealerDb), isLocal(dealerDb) ? "→ local" : "→ remote");
  }
  if (!dealerSupabase) {
    console.log("  Auth: (no NEXT_PUBLIC_SUPABASE_URL)");
  } else {
    console.log("  Auth:", dealerSupabase, dealerSupabase.includes("supabase.co") ? "→ Supabase cloud" : "");
  }
  console.log("");

  console.log("npm run dev:platform  (loads .env.platform-admin)");
  if (!platformDb) {
    console.log("  .env.platform-admin not found or has no DATABASE_URL/DIRECT_DATABASE_URL");
  } else {
    console.log("  DB:  ", maskUrl(platformDb), isLocal(platformDb) ? "→ local" : "→ remote");
  }
  if (!platformSupabase) {
    console.log("  Auth: (no NEXT_PUBLIC_SUPABASE_URL)");
  } else {
    console.log("  Auth:", platformSupabase, platformSupabase.includes("supabase.co") ? "→ Supabase cloud" : "");
  }
  console.log("");

  console.log("Summary:");
  console.log(
    "  Dealer:   DB = " +
      (dealerDb ? (isLocal(dealerDb) ? "local" : "remote") : "?") +
      ", Auth = Supabase (users live in Supabase Auth; Profile/Membership in dealer DB)"
  );
  console.log(
    "  Platform: DB = " +
      (platformDb ? (isLocal(platformDb) ? "local" : "remote") : "?") +
      ", Auth = Supabase (users live in Supabase Auth; platform_users in platform DB)"
  );
}

main();

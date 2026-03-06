/**
 * Fetch Supabase project API keys via Supabase CLI and write them into .env files.
 *
 * Prerequisites:
 *   1. Install Supabase CLI: https://supabase.com/docs/guides/cli/getting-started
 *      (e.g. npm install -g supabase, or scoop install supabase on Windows)
 *   2. Log in: supabase login
 *   3. Get project refs from Dashboard → Project Settings → General (Project ID)
 *
 * Usage (from repo root):
 *   npx tsx scripts/fetch-supabase-env.ts --dealer <dealer-project-ref>
 *   npx tsx scripts/fetch-supabase-env.ts --platform <platform-project-ref>
 *   npx tsx scripts/fetch-supabase-env.ts --dealer <ref> --platform <ref>
 *
 * Writes:
 *   --dealer   → .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
 *   --platform → .env.platform-admin (same vars)
 *
 * DATABASE_URL is not returned by the CLI (contains DB password). Add it manually from
 * Dashboard → Settings → Database → Connection string (URI).
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd());

function runSupabaseApiKeys(projectRef: string): string {
  try {
    const out = execSync(`npx supabase projects api-keys --project-ref ${projectRef} -o env`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out;
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string };
    throw new Error(
      `Supabase CLI failed. Install and log in: supabase login. Error: ${err.message ?? ""} ${err.stderr ?? ""}`
    );
  }
}

function parseEnvOutput(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/\\'/g, "'");
    env[key] = value;
  }
  return env;
}

/** Map CLI env names to our .env names */
function mapToOurVars(env: Record<string, string>): Record<string, string> {
  const url =
    env.SUPABASE_URL ??
    env.NEXT_PUBLIC_SUPABASE_URL ??
    env.API_URL;
  const anon =
    env.SUPABASE_ANON_KEY ??
    env.ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole =
    env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY;

  const out: Record<string, string> = {};
  if (url) out.NEXT_PUBLIC_SUPABASE_URL = url;
  if (anon) out.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
  if (serviceRole) out.SUPABASE_SERVICE_ROLE_KEY = serviceRole;
  return out;
}

function mergeIntoEnvFile(
  targetPath: string,
  newVars: Record<string, string>,
  templatePath: string,
  label: string
): void {
  const targetFull = resolve(ROOT, targetPath);
  const templateFull = resolve(ROOT, templatePath);

  let existing: Record<string, string> = {};
  if (existsSync(targetFull)) {
    const content = readFileSync(targetFull, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      existing[key] = value;
    }
  }

  const merged = { ...existing, ...newVars };

  const templateLines = existsSync(templateFull) ? readFileSync(templateFull, "utf-8").split("\n") : [];
  const lines: string[] = [];
  const written = new Set<string>();

  for (const line of templateLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      lines.push(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      if (merged[key] !== undefined) {
        lines.push(`${key}=${merged[key]}`);
        written.add(key);
        continue;
      }
      if (existing[key] !== undefined) {
        lines.push(`${key}=${existing[key]}`);
        written.add(key);
        continue;
      }
    }
    lines.push(line);
  }

  for (const [k, v] of Object.entries(merged)) {
    if (!written.has(k)) lines.push(`${k}=${v}`);
  }

  writeFileSync(targetFull, lines.join("\n").trimEnd() + "\n", "utf-8");
  console.log(`Wrote ${label} → ${targetPath}`);
}

function main() {
  const args = process.argv.slice(2);
  let dealerRef: string | null = null;
  let platformRef: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dealer" && args[i + 1]) {
      dealerRef = args[i + 1];
      i++;
    } else if (args[i] === "--platform" && args[i + 1]) {
      platformRef = args[i + 1];
      i++;
    }
  }

  if (!dealerRef && !platformRef) {
    console.error(`
Usage:
  npx tsx scripts/fetch-supabase-env.ts --dealer <project-ref> [--platform <project-ref>]
  npx tsx scripts/fetch-supabase-env.ts --platform <project-ref>

Get project ref from: Supabase Dashboard → Project Settings → General → Reference ID.
Login first: supabase login
`);
    process.exit(1);
  }

  if (dealerRef) {
    const raw = runSupabaseApiKeys(dealerRef);
    const env = parseEnvOutput(raw);
    const our = mapToOurVars(env);
    if (Object.keys(our).length === 0) {
      console.warn("Dealer: no known keys in CLI output. Check 'supabase projects api-keys --project-ref", dealerRef, "-o env'");
    } else {
      mergeIntoEnvFile(".env.local", our, ".env.local.example", "Dealer");
    }
  }

  if (platformRef) {
    const raw = runSupabaseApiKeys(platformRef);
    const env = parseEnvOutput(raw);
    const our = mapToOurVars(env);
    if (Object.keys(our).length === 0) {
      console.warn("Platform: no known keys in CLI output.");
    } else {
      mergeIntoEnvFile(".env.platform-admin", our, ".env.platform-admin.example", "Platform");
    }
  }

  console.log(`
Next: add DATABASE_URL to each .env file from Dashboard → Settings → Database → Connection string (URI).
For .env.local also set: NEXT_PUBLIC_APP_URL, COOKIE_ENCRYPTION_KEY, CRON_SECRET.
`);
}

main();

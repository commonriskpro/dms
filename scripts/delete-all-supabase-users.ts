/**
 * Delete all users from Supabase Auth (auth.users).
 * Uses Supabase Admin API (not CLI; CLI has no bulk user-delete command).
 *
 * Single project (env from process):
 *   npx dotenv -e .env.local -- tsx scripts/delete-all-supabase-users.ts
 *
 * Both DMS + platform-admin (from repo root):
 *   npm run auth:delete-all-users
 * DMS: .env.local or .env. Platform: .env.platform-admin.
 * Each must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "dotenv";

function loadEnvFile(path: string): Record<string, string> {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) return {};
  try {
    const raw = readFileSync(fullPath, "utf-8");
    return parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function pickEnv(env: Record<string, string>, label: string): { url: string; key: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return { url, key };
  return null;
}

async function deleteAllUsersInProject(
  supabaseUrl: string,
  serviceRoleKey: string,
  label: string
): Promise<number> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let page = 1;
  const perPage = 1000;
  let totalDeleted = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`[${label}] listUsers error:`, error.message);
      throw new Error(error.message);
    }
    const users = data.users;
    if (users.length === 0) break;

    for (const user of users) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error(`[${label}] Failed to delete ${user.id} (${user.email ?? "no email"}):`, delError.message);
      } else {
        totalDeleted += 1;
        console.log(`[${label}] Deleted: ${user.email ?? user.id}`);
      }
    }
    page += 1;
  }

  return totalDeleted;
}

async function main() {
  const runBoth = process.argv.includes("--both");

  if (runBoth) {
    const dmsEnv = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
    const platformEnv = loadEnvFile(".env.platform-admin");

    const dms = pickEnv(dmsEnv, "DMS");
    const platform = pickEnv(platformEnv, "platform-admin");

    if (!dms) {
      console.error("DMS: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env or .env.local");
      process.exit(1);
    }
    if (!platform) {
      console.error("Platform: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.platform-admin");
      process.exit(1);
    }

    const dmsCount = await deleteAllUsersInProject(dms.url, dms.key, "dms");
    console.log(`DMS: removed ${dmsCount} user(s).`);

    const platformCount = await deleteAllUsersInProject(platform.url, platform.key, "platform-admin");
    console.log(`platform-admin: removed ${platformCount} user(s).`);

    console.log(`Done. Total removed: ${dmsCount + platformCount} user(s).`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Or run: npm run auth:delete-all-users");
    process.exit(1);
  }

  const count = await deleteAllUsersInProject(supabaseUrl, serviceRoleKey, "project");
  console.log(`Done. Removed ${count} user(s).`);
}

main();

/**
 * Run Prisma migrate (deploy or status) using DIRECT_DATABASE_URL when set (avoids pooler hang on Supabase).
 * With Supabase, use pooler (port 6543) for app and direct (port 5432) for migrations.
 *
 * Usage: npx tsx scripts/prisma-migrate.ts dealer deploy | dealer status | platform deploy | platform status
 *        npx tsx scripts/prisma-migrate.ts dealer | platform resolve <migration_name>
 *        npx tsx scripts/prisma-migrate.ts dealer recover [migration_name]
 * Loads .env.local (dealer) or .env.platform-admin (platform); if DIRECT_DATABASE_URL
 * is set, uses it as DATABASE_URL so Prisma talks to Postgres directly.
 */
import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "fs";
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

function runPrisma(
  appDir: string,
  envForChild: NodeJS.ProcessEnv,
  args: string,
  opts?: { stdin?: string }
) {
  execSync(`npx prisma ${args}`, {
    encoding: "utf-8",
    stdio: opts?.stdin ? "pipe" : "inherit",
    input: opts?.stdin,
    env: envForChild,
    cwd: resolve(ROOT, appDir),
  });
}

function main() {
  const target = process.argv[2];
  const command = process.argv[3];
  const migrationName = process.argv[4];

  if (target !== "dealer" && target !== "platform") {
    console.error("Usage: npx tsx scripts/prisma-migrate.ts dealer | platform deploy | status | recover [migration_name]");
    process.exit(1);
  }

  const envFile = target === "dealer" ? ".env.local" : ".env.platform-admin";
  const env = loadEnv(envFile);
  const databaseUrl = env.DIRECT_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      `${envFile}: set DATABASE_URL or DIRECT_DATABASE_URL. For Supabase, use direct (port 5432) to avoid pooler hang.`
    );
    process.exit(1);
  }

  const appDir = target === "dealer" ? "apps/dealer" : "apps/platform";
  const envForChild = { ...process.env, DATABASE_URL: databaseUrl };
  const source = env.DIRECT_DATABASE_URL ? "DIRECT_DATABASE_URL" : "DATABASE_URL";

  if (command === "resolve") {
    if (!migrationName) {
      console.error("Usage: npx tsx scripts/prisma-migrate.ts dealer | platform resolve <migration_name>");
      process.exit(1);
    }
    console.log(`Marking migration ${migrationName} as rolled back in ${appDir}...`);
    runPrisma(appDir, envForChild, `migrate resolve --rolled-back ${migrationName}`);
    console.log("Done. Run deploy to re-apply migrations.");
    return;
  }

  if (command === "recover") {
    const name = migrationName ?? "20260307160000_add_auction_purchase";
    console.log(`Recovering failed migration ${name} in ${appDir}...`);
    const sqlPath = resolve(ROOT, appDir, "prisma", "recover-drop.sql");
    writeFileSync(
      sqlPath,
      'DROP TABLE IF EXISTS "auction_purchase"; DROP TYPE IF EXISTS "AuctionPurchaseStatus";\n'
    );
    try {
      runPrisma(appDir, envForChild, `db execute --file prisma/recover-drop.sql --schema prisma/schema.prisma`);
    } finally {
      try {
        unlinkSync(sqlPath);
      } catch {
        // ignore
      }
    }
    runPrisma(appDir, envForChild, `migrate resolve --rolled-back ${name}`);
    console.log(`Running prisma migrate deploy (using ${source})...`);
    runPrisma(appDir, envForChild, "migrate deploy");
    console.log("Recovery done.");
    return;
  }

  if (command !== "deploy" && command !== "status") {
    console.error("Usage: npx tsx scripts/prisma-migrate.ts dealer | platform deploy | status | resolve <migration_name> | recover [migration_name]");
    process.exit(1);
  }

  console.log(`Running prisma migrate ${command} in ${appDir} (using ${source})...`);
  runPrisma(appDir, envForChild, `migrate ${command}`);
  if (command === "status") {
    console.log("Done.");
  }
}

main();

/**
 * Read-only DB schema audit: tables, columns, enums, FKs, indexes.
 * Outputs JSON to stdout for comparison with Prisma schema and migrations.
 *
 * Usage: from repo root with DATABASE_URL or TEST_DATABASE_URL in .env.local:
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-db-schema.ts
 * Or: DATABASE_URL=... npx tsx scripts/audit-db-schema.ts
 *
 * If only TEST_DATABASE_URL is set in .env.local, set DATABASE_URL to the same value first.
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

// Load .env.local and ensure DATABASE_URL before Prisma is loaded
const env = loadEnv(".env.local");
if (env.TEST_DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.TEST_DATABASE_URL;
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

type TableRow = { table_name: string };
type ColumnRow = { table_name: string; column_name: string; data_type: string; is_nullable: string };
type EnumRow = { typname: string; enumlabel: string };
type FkRow = { from_table: string; from_col: string; to_table: string; to_col: string; constraint_name: string };
type IndexRow = { tablename: string; indexname: string; indexdef: string };

async function main() {
  const out: {
    database_url_preview: string;
    tables: string[];
    columns: ColumnRow[];
    enums: Record<string, string[]>;
    foreign_keys: FkRow[];
    indexes: IndexRow[];
    migration_history: { migration_name: string; finished_at: string | null }[];
    error?: string;
  } = {
    database_url_preview: "",
    tables: [],
    columns: [],
    enums: {},
    foreign_keys: [],
    indexes: [],
    migration_history: [],
  };

  try {
    const url = process.env.DATABASE_URL ?? "";
    out.database_url_preview = url ? url.replace(/:[^:@]+@/, ":****@") : "(not set)";

    const tables = await prisma.$queryRaw<TableRow[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    out.tables = tables.map((r) => r.table_name);

    const columns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;
    out.columns = columns;

    const enumLabels = await prisma.$queryRaw<EnumRow[]>`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `;
    for (const r of enumLabels) {
      if (!out.enums[r.typname]) out.enums[r.typname] = [];
      out.enums[r.typname].push(r.enumlabel);
    }

    const fks = await prisma.$queryRaw<FkRow[]>`
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_col,
        ccu.table_name AS to_table,
        ccu.column_name AS to_col,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `;
    out.foreign_keys = fks;

    const indexes = await prisma.$queryRaw<IndexRow[]>`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    out.indexes = indexes;

    const migrationHistory = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at
    `;
    out.migration_history = migrationHistory.map((m) => ({
      migration_name: m.migration_name,
      finished_at: m.finished_at ? m.finished_at.toISOString() : null,
    }));
  } catch (e) {
    out.error = (e as Error).message;
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify(out, null, 2));
}

main();

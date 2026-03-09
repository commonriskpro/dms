# DB Schema Audit Report

**Sprint:** DB Schema Audit + Drift Verification  
**Goal:** Audit database schema and identify drift between Prisma schema, applied migrations, and actual PostgreSQL.

---

## 1. Repo inspection summary

- **Prisma schema:** `apps/dealer/prisma/schema.prisma` — single datasource `db` (PostgreSQL), 80+ models, 50+ enums. Generator uses default output (repo root `node_modules/@prisma/client`).
- **Migrations:** 36 migration folders under `apps/dealer/prisma/migrations/`, applied in chronological order. Migration SQL uses quoted identifiers (e.g. `"Dealership"`, `"auction_purchase"`).
- **Physical DB:** Introspected via read-only script `scripts/audit-db-schema.ts` (queries `information_schema`, `pg_catalog`, `_prisma_migrations`). Script loads `.env.local` and uses `DATABASE_URL` or `TEST_DATABASE_URL`; outputs JSON (tables, columns, enums, FKs, indexes, migration history).
- **Environment inspected:** DB pointed to by `DATABASE_URL` / `TEST_DATABASE_URL` in `.env.local` (Supabase Postgres; URL preview redacted in script output).

---

## 2. Prisma schema audit

- **Models (tables):** 80+ models. Most use default table name = model name (PascalCase), e.g. `Dealership` → table `"Dealership"`.
- **Models with `@@map` (explicit table name):**
  - `DealerRateLimitEvent` → `@@map("dealer_rate_limit_events")`
  - `DealerRateLimitStatsDaily` → `@@map("dealer_rate_limit_stats_daily")`
  - `DealerJobRun` → `@@map("dealer_job_runs")`
  - `DealerJobRunsDaily` → `@@map("dealer_job_runs_daily")`
- **AuctionPurchase:** Model exists, **no `@@map`**. So Prisma expects table name **`AuctionPurchase`** (default = model name).
- **Enums:** Many enums; Prisma maps them to PostgreSQL enums (same name in `public` schema).
- **Fields:** Widespread use of `@map("snake_case")` for column names; tables use PascalCase unless `@@map` overrides.

---

## 3. Migration history audit

- **Source:** `_prisma_migrations` table (via audit script). All 36 migrations show `finished_at` set (no pending or failed).
- **Order (first/last):** From `20250228000000_core_platform_init` through `20260308100000_title_dmv_workflow`.
- **Relevant migrations for drift:**
  - **20260307160000_add_auction_purchase:** Creates enum `"AuctionPurchaseStatus"` and table **`"auction_purchase"`** (snake_case, quoted). No table `"AuctionPurchase"` is created.
  - **20260302180000_add_dealer_job_runs:** Creates table `"dealer_job_runs"` (matches schema `@@map("dealer_job_runs")`).
  - **20260302203000_add_dealer_monitoring_daily_tables:** Creates `"dealer_job_runs_daily"` (matches schema `@@map("dealer_job_runs_daily")`).
  - **20260302120000_dealer_rate_limit_events:** Creates `"dealer_rate_limit_events"` (matches schema `@@map`).
- **Conclusion:** Migration history is consistent; the only naming mismatch is **AuctionPurchase**: migration creates `auction_purchase`, schema expects `AuctionPurchase` (no `@@map`).

---

## 4. Physical DB audit

- **Introspection:** Run from repo root: `npx tsx scripts/audit-db-schema.ts` (with `DATABASE_URL` or `TEST_DATABASE_URL` in `.env.local`). Output: JSON with `tables`, `columns`, `enums`, `foreign_keys`, `indexes`, `migration_history`.
- **Tables found (sample):** 91 physical tables including:
  - PascalCase: `AccountingAccount`, `AuditLog`, `Dealership`, `Vehicle`, …
  - Snake_case (from migrations / @@map): `auction_purchase`, `dealer_job_runs`, `dealer_job_runs_daily`, `dealer_rate_limit_events`, `dealer_rate_limit_stats_daily`
  - `_prisma_migrations`
- **No table named `AuctionPurchase`** (PascalCase) exists; the only matching table is **`auction_purchase`** (snake_case).
- **Columns / enums / FKs / indexes:** Present and consistent with migrations for sampled tables; no systematic column or enum drift found beyond the table-name issue above.

---

## 5. Drift findings

| # | Type | Finding | Severity |
|---|------|---------|----------|
| 1 | **Table name** | **AuctionPurchase:** Prisma schema has `model AuctionPurchase` with **no `@@map`**, so the client queries table `"AuctionPurchase"`. The migration `20260307160000_add_auction_purchase` creates table **`"auction_purchase"`**. The physical DB has only `auction_purchase`. So Prisma queries fail with “relation \"AuctionPurchase\" does not exist” (or “table does not exist”). | **High** — breaks all AuctionPurchase access (e.g. acquisition-engine tests, any code using `prisma.auctionPurchase`). |
| 2 | **Naming convention** | Four other models correctly use `@@map` for snake_case table names (`dealer_rate_limit_events`, `dealer_rate_limit_stats_daily`, `dealer_job_runs`, `dealer_job_runs_daily`). AuctionPurchase is the only model whose migration used snake_case without a matching `@@map`. | — |
| 3 | **Migration vs schema** | Migration SQL and schema are otherwise aligned: same columns, enums, and FKs for checked models. No missing columns or extra tables detected in the inspected set. | — |

**Summary:** One concrete drift: **AuctionPurchase table name.** Physical table is `auction_purchase`; Prisma expects `AuctionPurchase`. All other checked objects (tables with `@@map`, migrations, and physical DB) are consistent.

---

## 6. Recommended fix plan

1. **AuctionPurchase (required):** In `apps/dealer/prisma/schema.prisma`, add `@@map("auction_purchase")` to the `AuctionPurchase` model so the client uses the existing table name. No new migration is required (table already exists as `auction_purchase`).
2. **Regenerate client:** Run `npm run db:generate` (or `npx prisma generate` in `apps/dealer`) after the schema change.
3. **Verification:** Re-run integration tests that use `prisma.auctionPurchase` (e.g. `modules/inventory/tests/acquisition-engine.test.ts`) and any app flows that touch auction purchases. The “table does not exist” / “relation AuctionPurchase does not exist” errors should disappear.
4. **No migration rollback or re-run:** Do not create a migration that renames the table to `AuctionPurchase`; that would break existing references and is unnecessary. Aligning the schema to the existing table via `@@map` is the correct fix.
5. **Optional:** Add a one-line comment in the schema above `model AuctionPurchase`: `// Table name in DB: auction_purchase (see migration 20260307160000).`

---

## 7. Final report

- **Environment / DB target:** Postgres DB configured via `DATABASE_URL` / `TEST_DATABASE_URL` in `.env.local` (Supabase; URL redacted in audit output).
- **Migration history:** 36 migrations applied; all show as completed in `_prisma_migrations`. No pending or failed migrations.
- **Table inventory:** 91 physical tables (including `_prisma_migrations`); matches expected set from schema + migrations except for the AuctionPurchase naming.
- **Missing tables:** None. The only issue is **name mismatch:** Prisma looks for `AuctionPurchase`, DB has `auction_purchase`.
- **Missing columns / enum drift / FK or index drift:** None identified for the tables and columns inspected.
- **Tables with `@@map` or naming differences:** Documented in §2; the only problematic case is AuctionPurchase (missing `@@map`).
- **Exact mismatch:** **Model `AuctionPurchase`** → Prisma table name **`AuctionPurchase`** vs physical table **`auction_purchase`**.
- **Recommended repair:** Add `@@map("auction_purchase")` to `model AuctionPurchase` in `schema.prisma` and regenerate the Prisma client. No DB migration needed.

---

**Audit script (read-only):** `scripts/audit-db-schema.ts` — run with `npx tsx scripts/audit-db-schema.ts` from repo root (env from `.env.local`). Use the JSON output to re-check tables, columns, enums, FKs, indexes, and migration history after any schema or migration change.

**Applied:** `@@map("auction_purchase")` was added to `model AuctionPurchase` in `schema.prisma` so the client uses the existing table. Regenerate with `npm run db:generate` and re-run integration tests as needed.

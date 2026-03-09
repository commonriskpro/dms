# Prisma @@map / @map Drift Audit — Report

**Sprint:** Prisma @@map Drift Audit  
**Goal:** Audit dealer Prisma schema for missing @map/@@map mismatches vs migration-created tables and fix only confirmed drift.

---

## 1. Repo inspection summary

- **Schema:** `apps/dealer/prisma/schema.prisma` — 80+ models, mix of PascalCase table names (no @@map) and snake_case table names (with @@map).
- **Migrations:** 38 migration SQL files under `apps/dealer/prisma/migrations/`. Tables are created either as quoted PascalCase (e.g. `"Dealership"`, `"Vehicle"`) or quoted snake_case (e.g. `"dealer_job_runs"`, `"auction_purchase"`, `"dealer_rate_limit_events"`).
- **Context:** A prior fix added `@@map("auction_purchase")` to model `AuctionPurchase` after the migration created table `"auction_purchase"`. This audit checked for further drift between schema and migrations/DB.

**Method:**

- Listed all `CREATE TABLE "..."` names from migrations.
- Listed all `model X` and `@@map("...")` from schema.
- For every migration-created table with a **snake_case** name, verified the corresponding model has `@@map("snake_case_name")` and that every scalar field has `@map("snake_case")` where the migration defines a snake_case column.

---

## 2. Drift findings

### Table-level @@map

All migration-created **snake_case** tables have a matching model with correct `@@map`:

| Migration table name              | Schema model             | @@map status   |
|----------------------------------|--------------------------|----------------|
| `dealer_job_runs`                | DealerJobRun             | ✅ `@@map("dealer_job_runs")` |
| `dealer_job_runs_daily`          | DealerJobRunsDaily       | ✅ `@@map("dealer_job_runs_daily")` |
| `dealer_rate_limit_events`      | DealerRateLimitEvent     | ✅ `@@map("dealer_rate_limit_events")` |
| `dealer_rate_limit_stats_daily` | DealerRateLimitStatsDaily| ✅ `@@map("dealer_rate_limit_stats_daily")` |
| `auction_purchase`              | AuctionPurchase          | ✅ `@@map("auction_purchase")` (previously fixed) |

No missing table-level @@map found.

### Field-level @map (confirmed drift)

**DealerJobRun.deadLetter**

- **Migration:** `20260302180000_add_dealer_job_runs/migration.sql` defines column `"dead_letter" INTEGER NOT NULL DEFAULT 0`.
- **Schema (before fix):** `deadLetter Int @default(0)` with **no** `@map("dead_letter")`.
- **Effect:** Prisma client expects a column named `deadLetter` (default camelCase); the database has `dead_letter`. This caused:
  - `Invalid prisma.dealerJobRun.create() invocation … The column 'deadLetter' does not exist in the current database.`
- **Classification:** Confirmed field-level mapping drift.

No other scalar fields on the snake_case tables above were missing @map; all other columns in those migrations use snake_case and the schema already had matching `@map("...")` (e.g. `dealership_id`, `started_at`, `skipped_reason`, `duration_ms`).

---

## 3. Safe fixes applied

- **File:** `apps/dealer/prisma/schema.prisma`
- **Change:** On model `DealerJobRun`, added `@map("dead_letter")` to the `deadLetter` field:
  - Before: `deadLetter   Int       @default(0)`
  - After:  `deadLetter   Int       @default(0) @map("dead_letter")`
- **Scope:** Schema-only; no migration and no table rename. DB already had column `dead_letter`; only the Prisma ↔ DB column name mapping was corrected.

---

## 4. Validation results

- **Prisma generate:** `npx prisma generate` (apps/dealer) completed successfully.
- **CRM Pipeline Automation integration suite:**  
  `npx jest modules/crm-pipeline-automation/tests/integration.test.ts` — **28 tests passed**, including:
  - Job retry and dead-letter (job worker processes pending jobs, failJob with deadLetter sets status dead_letter)
  - Atomic job claim
  - Sequence stop conditions (delayed step after WON)
- No additional table renames or data changes; behavior preserved.

---

## 5. Final report

- **Drift identified:** One field-level drift — `DealerJobRun.deadLetter` missing `@map("dead_letter")` while the migration defines column `dead_letter`.
- **Fixes applied:** Single schema-only fix: add `@map("dead_letter")` to `DealerJobRun.deadLetter`.
- **Table-level @@map:** No missing @@map for snake_case tables; no change required.
- **Validation:** Prisma client regenerated; CRM integration suite (including DealerJobRun/create and dead-letter tests) passes.
- **Artifacts:** This report: `docs/PRISMA_MAP_DRIFT_AUDIT_REPORT.md`.

# DMS Deployment (Vercel + Supabase)

> Superseded: canonical deployment and contributor guidance now lives in [`docs/canonical/INDEX.md`](./canonical/INDEX.md) and [`docs/canonical/DEVELOPER_GUIDE_CANONICAL.md`](./canonical/DEVELOPER_GUIDE_CANONICAL.md). This file is retained as a legacy deployment runbook and has been minimally corrected where the old text was clearly out of date.

For the canonical documentation set, start with [`docs/canonical/INDEX.md`](./canonical/INDEX.md). For legacy localhost details, see `docs/LOCALHOST.md`.

## Fully cloud deployed (recommended)

With the repo and GitHub Action in place, a **push to `main`** runs migrations in the cloud and triggers a Vercel production deploy. No local migration or deploy steps required.

1. **Connect GitHub to Vercel**  
   Vercel → Project **dms** → Settings → Git → Connect to your repo. Set Production branch to `main`. Each push to `main` will deploy.

2. **Secrets and env vars**  
   - **GitHub:** Repository → Settings → Secrets and variables → Actions → New repository secret. Add **DATABASE_URL** with your Supabase **direct** Postgres URI (port 5432). The workflow `.github/workflows/deploy.yml` runs `prisma migrate deploy` on every push to `main` using this secret.  
   - **Vercel:** Project → Settings → Environment Variables. Add all variables from **Vercel environment variables** below for **Production** (same list; use the same Supabase project).

3. **Supabase Auth**  
   In Supabase: Authentication → URL Configuration. Add your production URL to **Redirect URLs** (e.g. `https://dms-gold.vercel.app/**`). Set **Site URL** to that URL. Must match **NEXT_PUBLIC_APP_URL** in Vercel.

4. **One-time: VIN dedupe (if needed)**  
   If you have the inventory VIN unique migration and production may have duplicate VINs, run the dedupe script once from your machine before or after the first cloud deploy:  
   `DATABASE_URL="<production-uri>" npx tsx scripts/dedupe-vins.ts`

**Flow:** Push to `main` → GitHub Action runs `prisma migrate deploy` (using `DATABASE_URL` secret) → Vercel builds and deploys. App and database stay in sync.

---

## Environment variables

**Production (Vercel):** `.env.local` is **not** used in production. Set all variables in Vercel Project Environment Variables only; see **Vercel environment variables** below.

### Required (all environments)

- **DATABASE_URL** — PostgreSQL connection string (Supabase: Project Settings → Database → Connection string, URI). **Do not use for tests**; use **TEST_DATABASE_URL** for integration tests.
- **NEXT_PUBLIC_SUPABASE_URL** — Supabase project URL.
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** — Supabase anon/public key.
- **SUPABASE_SERVICE_ROLE_KEY** — Supabase service role key (server-only; for Storage and admin operations).
- **COOKIE_ENCRYPTION_KEY** — At least 32 bytes (hex or base64); used to encrypt the active-dealership cookie (AES-256-GCM). **Required** for session/switch and protected routes.
- **NEXT_PUBLIC_APP_URL** — Full canonical app URL for auth callbacks and links. **Local dev:** use only `http://localhost:3000` in `.env.local`. **Production (e.g. Vercel):** set in Project Settings → Environment Variables to your production URL (e.g. `https://your-app.vercel.app`). Do not put the Vercel URL in `.env.local`; `.env.local` overrides for `npm run dev` and should contain only the localhost URL.
- **CRON_SECRET** — Secret for `GET /api/crm/jobs/run` (cron worker). Set in production; use any random string in dev.

### Optional

- **ALLOW_BOOTSTRAP_LINK** — Set to `1` to allow linking an existing user as Owner via `POST /api/admin/bootstrap-link-owner` when the dealership already has members (e.g. re-bootstrap). **Production:** set to `0` (or leave unset) to disable.
- **TEST_DATABASE_URL** — PostgreSQL connection string used **only for integration tests**. Current dealer Jest integration runs copy this into `DATABASE_URL` during test setup so production DB is never used for tests. Omit in production.
- **SKIP_INTEGRATION_TESTS** — Set to `1` to skip DB-backed integration tests (tenant isolation, RBAC, audit, files, session switch). Unit tests still run.
- **NHTSA_API_URL** — Base URL for NHTSA vPIC API (default: `https://vpic.nhtsa.dot.gov/api`). Used by inventory VIN decode. Override only for testing or custom proxy.

---

## Vercel environment variables

**Production does not use `.env.local`.** Build and runtime on Vercel use **only** Vercel Project Environment Variables (Project Settings → Environment Variables). Do not commit `.env.production` or real secrets to git.

Set these in Vercel for **Production** (and optionally Preview/Development as needed):

| Variable | Required | Notes |
|----------|----------|--------|
| **DATABASE_URL** | Yes | Supabase **production** Postgres. Prefer **direct** (host `db.xxx.supabase.co`, port 5432). If Vercel gets "Can't reach database server", use the **Transaction mode pooler** URI (port 6543) and append `?pgbouncer=true` (see [Troubleshooting: Vercel DB connection](#troubleshooting-vercel-cant-reach-database) below). |
| **NEXT_PUBLIC_SUPABASE_URL** | Yes | Supabase project URL (e.g. `https://xxxx.supabase.co`). |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Yes | Supabase anon/public key. |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes | Server-only; never exposed to client. |
| **COOKIE_ENCRYPTION_KEY** | Yes | 32+ bytes (e.g. 64 hex chars). Used for active-dealership cookie. |
| **CRON_SECRET** | Yes | Secret for `GET /api/crm/jobs/run` (Vercel Cron or external scheduler). Use a long random string. |
| **NEXT_PUBLIC_APP_URL** | Yes | `https://<your-vercel-domain>` (your Vercel domain or custom domain). |
| **ALLOW_BOOTSTRAP_LINK** | Yes (recommended) | Set to `0` in production to disable bootstrap-link-owner when dealership already has members. |

**Production values:** Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://<your-vercel-domain>.vercel.app`) and `ALLOW_BOOTSTRAP_LINK=0` in Vercel.

- **Build:** Vercel runs `npm install` (which runs `prisma generate` via `postinstall`), then `npm run build` (`next build`). No `.env.local` is required in production; all values are injected by Vercel.
- **Runtime:** Same; server and client read from Vercel-injected environment only.

---

## Deploy to Production

### 1. Exact production migration commands

Run migrations **from local or CI** with the production database URL. Do **not** use `prisma migrate dev` or `prisma db push` in production.

**One-liner (Unix/macOS/Git Bash):**
```bash
DATABASE_URL="<production-postgres-uri>" npx prisma migrate deploy
```
Or using the npm script:
```bash
DATABASE_URL="<production-postgres-uri>" npm run db:migrate:prod
```

**Pre-step when VIN unique migration applies:** If you have (or will apply) the inventory VIN unique migration `20250303000000_inventory_vehicle_lifecycle_costs` and your production DB may have duplicate VINs per dealership, run the dedupe script **before** `migrate deploy`:
```bash
DATABASE_URL="<production-postgres-uri>" npx tsx scripts/dedupe-vins.ts
```
Then run `migrate deploy` as above.

**From CI (e.g. GitHub Actions):** Use a secret `DATABASE_URL` and run `npx prisma migrate deploy` (or `npm run db:migrate:prod`) in a step after checkout and `npm ci`; see the optional workflow in **Vercel (build and deploy)** below.

### 2. Exact Vercel env var list (Production)

Set these in **Vercel → Project → Settings → Environment Variables** for the **Production** environment so a deployer or DevOps can copy them:

| Variable | Required | Notes |
|----------|----------|--------|
| **DATABASE_URL** | Yes | Supabase production Postgres, **DIRECT** connection string (port 5432). |
| **NEXT_PUBLIC_SUPABASE_URL** | Yes | Supabase project URL (e.g. `https://xxxx.supabase.co`). |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Yes | Supabase anon/public key. |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes | Server-only; never exposed to client. |
| **COOKIE_ENCRYPTION_KEY** | Yes | 32+ bytes (e.g. 64 hex chars). Used for active-dealership cookie. |
| **CRON_SECRET** | Yes | Secret for `GET /api/crm/jobs/run` (Vercel Cron or external scheduler). |
| **NEXT_PUBLIC_APP_URL** | Yes | `https://<your-vercel-domain>` (Vercel or custom domain). |
| **ALLOW_BOOTSTRAP_LINK** | Yes (recommended) | Set to `0` in production. |

### 3. Final "Deploy to Production" command block (step-by-step)

1. **Set Vercel env vars**  
   In Vercel → Project → Settings → Environment Variables, add all variables from **§ Exact Vercel env var list** above for the **Production** scope.

2. **(Optional) Run VIN dedupe**  
   Only if you have or will apply migration `20250303000000_inventory_vehicle_lifecycle_costs` and production may have duplicate VINs per dealership:
   ```bash
   DATABASE_URL="<production-postgres-uri>" npx tsx scripts/dedupe-vins.ts
   ```

3. **Run production migrations**  
   From your machine or CI (with production `DATABASE_URL` set):
   ```bash
   DATABASE_URL="<production-postgres-uri>" npx prisma migrate deploy
   ```
   Or: `DATABASE_URL="<production-postgres-uri>" npm run db:migrate:prod`  
   Confirm the command exits with code 0.

4. **Deploy to Vercel**  
   Trigger a production deploy using your normal process, for example:
   - **Git push:** Push to the branch connected to Vercel production (e.g. `main`).
   - **Vercel CLI:** `vercel --prod` from the project root (after `vercel link` if needed).

5. **Post-deploy**  
   Run the **Post-deploy checklist** below; at minimum verify `GET /api/health` returns 200 with `db: "ok"`.

### 4. Rollback plan (if migration fails)

If `prisma migrate deploy` fails or a migration breaks production:

- **Do not** run `prisma migrate dev` or `prisma db push` against production. They can change schema in ways that are not tracked or reversible.
- **Fix forward** when possible: fix the failing migration or application code, then add a **new** migration to correct schema or data, and run `prisma migrate deploy` again with production `DATABASE_URL`.
- **Restore from backup** if the database is corrupted or you must revert data/schema: use your database provider’s backup and restore (e.g. **Supabase Dashboard → Project Settings → Database → Backups**, or your provider’s point-in-time restore). Restore to a point before the bad migration, then fix the migration and redeploy.
- Document where backup/restore is configured (e.g. Supabase dashboard, retention, and how to restore) in your runbook; no code changes are required for this rollback process.

---

## Supabase Auth (production)

Configure Supabase Auth for your production domain so sign-in and callbacks work:

1. **Redirect URLs**  
   In Supabase: **Authentication → URL Configuration → Redirect URLs**, add:
   - `https://<vercel-domain>/**`  
   (Replace `<vercel-domain>` with your actual Vercel domain or custom domain, e.g. `your-app.vercel.app`.)

2. **Site URL**  
   Set **Site URL** (same URL Configuration page) to your **production domain** (e.g. `https://<vercel-domain>.vercel.app` or your custom domain).

These must match **NEXT_PUBLIC_APP_URL** set in Vercel.

---

## Vercel (build and deploy)

1. Connect the repo to Vercel.
2. Add all required env vars above in Project Settings → Environment Variables (Production scope).
3. Build command: `npm run build` (default; runs `next build`).
4. Install command: `npm install` (default; runs `prisma generate` via postinstall).

**Database migrations:** Migrations are **not** run during the Vercel build. They run in the cloud via the **GitHub Action** (see **Fully cloud deployed** above): `.github/workflows/deploy.yml` runs `prisma migrate deploy` on every push to `main` using the **DATABASE_URL** repository secret. Ensure that secret is set in GitHub (Settings → Secrets and variables → Actions).

- **From local (one-off or without CI):**  
  `DATABASE_URL=<production-url> npx prisma migrate deploy`  
  or  
  `DATABASE_URL=<production-url> npm run db:migrate:prod`

## Supabase

1. Create a Postgres project.
2. In Database → Extensions, enable any required extensions (none for core-platform).
3. Create Storage buckets (e.g. `deal-documents`, `inventory-photos`) and set policies so only service role can write; use RLS or bucket policies as needed.
4. Run migrations: `npx prisma migrate deploy` (use DATABASE_URL from Supabase).
5. (Optional) Run seed: `npm run db:seed` for permissions and demo dealership.

## Prisma migrations

- **Local dev:** `npm run db:migrate` (runs `prisma migrate deploy` using `.env.local`). See **docs/LOCALHOST.md** for full run order.
- **Production:** Use **only** `npx prisma migrate deploy` (or `npm run db:migrate:prod`). Do **not** use `prisma migrate dev` or `prisma db push` in production. Run with production `DATABASE_URL` set in the environment (CI or local).

### Production pre-migration checklist (migration order)

1. **If you have the inventory VIN unique migration** (e.g. `20250303000000_inventory_vehicle_lifecycle_costs`): run the VIN dedupe script **before** applying migrations. See **Inventory: VIN unique constraint** below.
2. Run migrations with the production database URL:  
   `DATABASE_URL=<production-url> npx prisma migrate deploy`  
   or  
   `DATABASE_URL=<production-url> npm run db:migrate:prod`
3. Do not run `prisma migrate dev` or `prisma db push` against production.

### Inventory: VIN unique constraint (20250303000000)

Migration `20250303000000_inventory_vehicle_lifecycle_costs` adds a unique constraint on `(dealership_id, vin)`. **If you have existing data with duplicate VINs within the same dealership, the migration will fail.** Before applying that migration:

1. Run the dedupe script: `npx tsx scripts/dedupe-vins.ts`
2. The script finds all `(dealershipId, vin)` groups with more than one vehicle (vin not null), keeps the newest row (by `created_at`) and sets `vin = null` on the older rows. It logs each change (dealershipId, vin, keptVehicleId, nulledVehicleIds).
3. Then run `npx prisma migrate deploy` (or `npm run db:migrate` for dev).

## Pre-deploy checklist (before go-live)

Run these checks before promoting to production (or in staging with production-like config):

- [ ] **Prisma migrate** — `prisma migrate deploy` exits 0 with production `DATABASE_URL` (run locally or in CI: `DATABASE_URL=<production-url> npx prisma migrate deploy`).
- [ ] **Prisma generate** — Confirmed that `prisma generate` runs (e.g. in `postinstall`); Vercel runs this automatically on `npm install`.
- [ ] **Seed** — Seed is **not** run in production unless intentional. Seed is for **dev only** (permissions, demo dealership). Do not run `npm run db:seed` against production.
- [ ] **Health** — `GET /api/health` returns 200 and body includes `db: "ok"` (after deploy or in staging).
- [ ] **Login** — Login works; Supabase Auth **Redirect URLs** and **Site URL** are set to your production (or staging) URL and match `NEXT_PUBLIC_APP_URL`.
- [ ] **Bootstrap disabled** — `ALLOW_BOOTSTRAP_LINK=0` in production (or unset) so bootstrap-link-owner is disabled when the dealership already has members.

## Post-deploy checklist (after go-live)

Smoke checks to confirm core flows work:

- [ ] **Inventory** — Inventory list and detail pages load.
- [ ] **Deal + Finance** — Deal and Finance flows work (create/view deal, finance steps as applicable).
- [ ] **Reports** — Reports pages load.
- [ ] **CRM** — CRM (pipelines, opportunities, sequences, etc.) loads.
- [ ] **Export rate limiting works** — Verify export endpoints return 429 on excess requests.

## Troubleshooting: Vercel can't reach database

If you see **"Can't reach database server at \`db.xxx.supabase.co:5432\`"** in Vercel logs or from `GET /api/health` (response includes `dbError`), the **direct** connection works from your machine but not from Vercel's network. Try:

1. **Use the Transaction mode pooler**  
   In Supabase: **Project Settings → Database → Connection string**. Choose **URI** and **Transaction** (or "Connection pooling"). Copy the URI (it uses a pooler host like `aws-0-xx.pooler.supabase.com` and **port 6543**). Append `?pgbouncer=true` so Prisma does not use prepared statements (e.g. `...postgres?pgbouncer=true`). Set this as **DATABASE_URL** in Vercel → Production, then **Redeploy**.

2. **Resume the project**  
   Free-tier Supabase projects pause after inactivity. In the dashboard, if the project shows as paused, click **Resume**. Wait until it is running, then try again.

3. **Confirm no IP restrictions**  
   In **Project Settings → Database**, ensure connections are not restricted to specific IPs (Vercel's IPs change; allow public access for serverless).

4. **Debug**  
   Hit **GET https://your-app.vercel.app/api/health** and check the JSON: `dbError` shows the exact Prisma error (no secrets). Use that to confirm it's a reachability issue vs auth/schema.

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `COOKIE_ENCRYPTION_KEY` to the client.
- Use Vercel env scopes (Production / Preview / Development) appropriately.

## Rate limiting

- The app uses an in-memory rate limiter for auth, session switch, file upload, and signed-url endpoints. It is suitable for development and single-instance deployments.
- **Production**: For multi-instance or high-traffic deployments, replace with a pluggable backend (e.g. **Upstash Redis**). The limiter lives in `lib/api/rate-limit.ts`; implement the same `checkRateLimit(identifier, type)` / `incrementRateLimit(identifier, type)` contract and swap the implementation. Document the production limiter in your runbook; no vendor implementation is included in the repo.

---

## Production hardening (Sprint 8)

### DB indexes (large datasets)

All business tables are tenant-scoped with `dealership_id`. The Prisma schema includes indexes for:

- **Tenant + list ordering:** `@@index([dealershipId])`, `@@index([dealershipId, createdAt])` on high-volume tables (AuditLog, Vehicle, Customer, Deal, FileObject, etc.).
- **Filters:** `@@index([dealershipId, status])`, `@@index([dealershipId, stageId])`, and similar where list APIs filter by status or FK.
- **Foreign keys:** Indexes on `dealId`, `customerId`, `applicationId`, `submissionId`, etc. for joins and list-by-parent.

See `prisma/schema.prisma` for the full list. For large datasets, ensure list queries use `where.dealershipId` and order by indexed columns (e.g. `createdAt desc`).

### Slow query detection

- **Config:** `lib/db.ts` registers a Prisma query event listener. Any query whose duration exceeds the threshold is logged with `[slow-query] <duration>ms` and a truncated query preview (no bound parameters to avoid PII).
- **Env:** `SLOW_QUERY_THRESHOLD_MS` (default `2000`). Set in production to tune (e.g. `1000` for stricter monitoring).
- Logs go to stdout (Vercel logs / your log aggregator). Use them to find missing indexes or N+1 patterns.

### Pagination verification

- All list APIs use **limit/offset** with a **bounded max** (typically 100). See **docs/pagination-verification.md** for the full table.
- Export endpoints (inventory CSV, sales CSV) are not list endpoints; they are rate-limited and audited.

### Export audit verification

- **GET /api/reports/export/inventory** and **GET /api/reports/export/sales** both call `auditLog` with `action: "report.exported"` and metadata (reportName, from, to, format) after a successful export. No PII in metadata. This satisfies auditability for exports.

### Access / audit logs view

- **Admin → Audit Log** (`/admin/audit`) shows a paginated, filterable list of audit entries (action, entity, entityId, time, metadata). Requires permission `admin.audit.read`. Use this as the **access and audit log** view for compliance and debugging.

### Prisma migrate deploy safety

- **Production must use only** `npx prisma migrate deploy` (or `npm run db:migrate:prod`) with the production `DATABASE_URL`.
- **Do not run** `prisma migrate dev` or `prisma db push` against production. They can create or apply migrations in ways that are not idempotent or reversible.
- Migrations run in CI (e.g. GitHub Action) or manually before deploy; they do **not** run during the Vercel build.

### Vercel env validation

- **GET /api/health** calls `validateEnv()` from `lib/env.ts` and returns **503** with a `missingVars` list if any required env var is missing or empty. Required vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COOKIE_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
- Use health in your deploy or monitoring pipeline to confirm env is valid before traffic. No secrets are echoed in the response.

# Running DMS on localhost (Supabase + Postgres)

> Superseded: canonical contributor setup guidance now lives in [`docs/canonical/INDEX.md`](./canonical/INDEX.md) and [`docs/canonical/DEVELOPER_GUIDE_CANONICAL.md`](./canonical/DEVELOPER_GUIDE_CANONICAL.md). This file is retained as a legacy runbook and has been minimally corrected where the old commands were clearly wrong.

The app uses **Supabase remote DB**, **Supabase Auth**, and **Supabase Storage** for local development (no local Postgres required). Use `.env.local` as the single source for local env vars.

## Supabase Auth (local)

For login and the **/get-started** bootstrap flow to work on localhost, configure Supabase Dashboard as follows:

1. **Auth → URL Configuration**
   - **Redirect URLs:** Add `http://localhost:3000/**` (and optionally `http://localhost:3000/auth/callback` if you add a callback route). Supabase will only redirect to URLs in this list (e.g. after magic link sign-in).
   - **Site URL:** Set to `http://localhost:3000` for local dev. At minimum, Redirect URLs must include the origin you use (e.g. `http://localhost:3000/**`).

2. **After these are set**
   - **Login** at `/login` (password or magic link) works; Supabase sets session cookies and the app reads them via the server Supabase client.
   - **Post-login redirect:** Authenticated users go to `/`; if they have no active dealership they are sent to **/get-started**.
   - **/get-started:** When `ALLOW_BOOTSTRAP_LINK=1`, the "Link me as Owner" button calls **POST /api/admin/bootstrap-link-owner**, which sets the **active dealership** cookie (using `COOKIE_ENCRYPTION_KEY`). The **GET /api/auth/session** endpoint then returns `activeDealership` and `permissions` so the UI shows the correct post-login state.

3. **Session and cookies**
   - The server Supabase client (`lib/supabase/server.ts`) reads cookies via Next.js `cookies()` (App Router). No cookie domain is set, so localhost works. Ensure `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local` so any redirect or callback URLs built from env point to localhost.

## Required environment (`.env.local`)

Copy from `.env.example` and fill in real values. Required for local:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `DATABASE_URL` | Direct Postgres connection string (Supabase → Database → Connection string, URI) |
| `COOKIE_ENCRYPTION_KEY` | 32+ bytes hex/base64 (e.g. `openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | **Must be `http://localhost:3000`** for local dev (no other value here) |
| `CRON_SECRET` | Secret for `GET /api/crm/jobs/run` (any random string in dev) |
| `ALLOW_BOOTSTRAP_LINK` | Set to `1` for first-user owner linking in dev |

For production (e.g. Vercel), set `NEXT_PUBLIC_APP_URL` in that environment (e.g. `https://your-app.vercel.app`). Keep localhost only in `.env.local`; it overrides for `npm run dev`.

## Run order (Quickstart)

Run these in order from the project root:

```bash
npm install
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev:dealer
```

**Expected results:**

- **npm install** — Completes without errors; `postinstall` runs `prisma generate` (Prisma Client generated to `node_modules/@prisma/client`).
- **npx prisma generate** — Prints "Generated Prisma Client" (optional if postinstall already ran).
- **npm run db:migrate** — Loads `.env.local` via dotenv-cli; applies migrations; exits 0 when `DATABASE_URL` is correct and DB is reachable.
- **npm run db:seed** — Seeds permissions and demo dealership; exits 0 when DB is ready.
- **npm run dev:dealer** — Starts the dealer Next.js app; you should see "Ready" and the app at **http://localhost:3000**.

**Health check:** With the dev server running, open or curl **GET http://localhost:3000/api/health**. Expect **200** and body with `"ok": true`, `"db": "ok"` when `DATABASE_URL` is correct. If DB is unreachable, response is 503 and `"db": "error"`.

**Next:** Open http://localhost:3000 in a browser and run through the [Localhost smoke test](MANUAL-SMOKE-TEST-CHECKLIST.md#localhost-smoke-test) in the manual smoke checklist (login, get-started bootstrap, inventory, minimal E2E, reports, CRM).

---

- **npm install** — Installs deps and runs `prisma generate` via `postinstall`.
- **npx prisma generate** — Regenerates Prisma client (optional if postinstall ran).
- **npm run db:migrate** — Applies migrations to the DB (uses `DATABASE_URL` from `.env.local`).
- **npm run db:seed** — Seeds permissions and demo dealership (uses `.env.local`).
- **npm run dev** — Starts Next.js at **http://localhost:3000**.

## Sanity check (health endpoint)

After `npm run dev`, confirm the app and DB are wired correctly:

- **GET http://localhost:3000/api/health** — Returns 200 when the app can reach the database and reports whether required env vars are set (no secrets in the response).
- When `DATABASE_URL` in `.env.local` is correct, the response looks like: `{ "ok": true, "db": "ok", "env": { "appUrlSet": true, "cookieKeySet": true } }`.
- If the DB is unreachable, you get 503 and `"db": "error"`. Fix `DATABASE_URL` or connectivity (see [DATABASE_URL connectivity](#database_url-connectivity--pooler-vs-direct)) then try again.

## Scripts reference

| Script | Command | Notes |
|--------|---------|------|
| `db:migrate` | `prisma migrate deploy` | Loads `.env.local` via dotenv-cli |
| `db:seed` | `prisma db seed` | Loads `.env.local` |
| `db:reset` | `prisma migrate reset --force` | Optional; wipes DB and reapplies migrations + seed |
| `test` | `npm run test:dealer` | Dealer Jest suite |
| `test:unit` | `npm run test:dealer:unit` | Dealer Jest unit/default suite with `.env.unit` |
| `test:integration` | `npm run test:dealer:integration` | Dealer Jest integration run with `.env.test` |
| `test:all` | `npm run test:all` | Root dealer + platform test pipeline |

## Running full test suite with DB

Integration tests run when **`TEST_DATABASE_URL`** is set and **`SKIP_INTEGRATION_TESTS`** is not `1`. Use a **dedicated test database** (not production or your main dev DB).

### Option A: Supabase (separate project)

1. **Create a separate Supabase project** for testing (e.g. "dms-test") so test data never touches dev/prod.
2. **Get the direct Postgres connection string**  
   Supabase Dashboard → Project → **Settings** → **Database** → **Connection string** → **URI** (direct, port 5432: `postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres`).
3. **Create `.env.test`** in the project root (already gitignored) with at least:
   ```bash
   TEST_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   Do **not** set `SKIP_INTEGRATION_TESTS=1` in `.env.test` if you want integration tests to run.
4. **Apply migrations and seed to the test DB** (one-time or after schema changes):
   ```powershell
   $env:DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"; npx prisma migrate deploy
   $env:DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"; npx prisma db seed
   ```
   Or copy `TEST_DATABASE_URL` from `.env.test` into `DATABASE_URL` for that session. Prisma always reads `DATABASE_URL`; for normal dev, use `npm run db:migrate` and `npm run db:seed` (they load `.env.local`).
5. **Run the full test pipeline** (lint, build, unit tests, integration tests):
   ```powershell
   npm run test:all
   ```
   Or run only integration tests: `npm run test:integration`.

### Option B: Docker Postgres

1. **Start a local Postgres** (no Supabase Auth needed for DB-only tests):
   ```powershell
   docker run -d --name dms-test-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
   ```
   (Port 5433 avoids clashing with a local Postgres on 5432.)
2. **Create `.env.test`** with:
   ```bash
   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
   ```
3. **Apply migrations and seed** (one-time or after schema changes):
   ```powershell
   $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/postgres"; npx prisma migrate deploy
   $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/postgres"; npx prisma db seed
   ```
4. **Run the full test pipeline:**
   ```powershell
   npm run test:all
   ```

### Notes

- **Prisma and env:** `db:migrate`, `db:seed`, and `db:reset` use **`.env.local`** via dotenv-cli (see Scripts reference). Use `DATABASE_URL` in the shell or in a separate env file when targeting the test DB for migrations/seed.
- **Windows PowerShell:** `npm run test:all` works as-is; the script uses `&&` and npm runs it in a way that works on Windows. If you run steps manually, set env vars with `$env:VAR = "value"; command`.
- **Skip integration tests:** Set `SKIP_INTEGRATION_TESTS=1` (e.g. in `.env.unit` or in the shell) to run only unit tests. `npm run test:unit` loads `.env.unit`, which sets this so only unit tests run.

## Troubleshooting

### Missing COOKIE_ENCRYPTION_KEY

**Symptom:** Session/switch or protected routes fail; errors about cookie or encryption.

**Fix:** Add to `.env.local` a key of 32+ bytes. Generate one:

```bash
openssl rand -hex 32
```

Set `COOKIE_ENCRYPTION_KEY=<output>` in `.env.local`.

---

### Supabase redirect URL mismatch

**Symptom:** After login (especially magic link), Supabase redirects to the wrong URL or shows a "redirect_uri" error.

**Fix:** See [Supabase Auth (local)](#supabase-auth-local) above. In short:

1. Supabase Dashboard → **Authentication → URL Configuration**: set **Site URL** to `http://localhost:3000`.
2. Add **Redirect URLs**: `http://localhost:3000/**` (and `http://localhost:3000/auth/callback` if you use a callback route).
3. In `.env.local` set `NEXT_PUBLIC_APP_URL=http://localhost:3000` (no trailing slash; do not use a Vercel URL here for local dev).

---

### DATABASE_URL connectivity / pooler vs direct

**Symptom:** `prisma migrate deploy` or app fails with connection timeouts or "too many connections".

**Fix:**

- **Pooler (port 6543):** Use for app in serverless or high concurrency. Supabase connection string with `:6543` is the pooler.
- **Direct (port 5432):** Use for migrations and sometimes for long-running scripts. In Supabase → Database → Connection string, choose "Session" or "Direct" (port 5432) for running migrations if the pooler gives issues.
- If using pooler for both app and migrations, ensure your plan allows enough connections. For local dev, direct connection is usually fine for everything; try switching to the direct URI if pooler fails.

---

### Node version mismatch

**Symptom:** Build or runtime errors; "Engine" or module resolution errors.

**Fix:** Use the Node version required by the project (see `package.json` `engines` or repo docs). Example with nvm:

```bash
nvm use
# or
nvm install 20
nvm use 20
```

Then run `npm install` and `npm run dev` again.

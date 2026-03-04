# Fresh environment deployment runbook

Use this runbook to deploy both apps (Dealer + Platform) from scratch with **new** Vercel projects and **new** Supabase projects. After following these steps, the system works end-to-end: platform can provision dealerships and send owner invites; dealer can accept invites and operate; lifecycle (ACTIVE/SUSPENDED/CLOSED) and read-only UX are enforced.

---

## Prerequisites

- Monorepo cloned; Node 20+; npm.
- Two **new** Supabase projects (one for dealer, one for platform).
- Two **new** Vercel projects (one for dealer, one for platform), both linked to the same repo.

---

## 1. Create Supabase projects

1. Create **Dealer** Supabase project (e.g. `dms-dealer-prod`). Note:
   - Project URL → for `NEXT_PUBLIC_SUPABASE_URL` (dealer)
   - API → anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - API → service_role key → `SUPABASE_SERVICE_ROLE_KEY`
   - Settings → Database → Connection string (URI) → `DATABASE_URL` (dealer). Prefer **Session** or **Transaction** mode; for serverless you can use **Pooler** (port 6543).

2. Create **Platform** Supabase project (e.g. `dms-platform-prod`). Note:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` (platform)
   - API → anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Database connection string → `DATABASE_URL` (platform)

3. **Platform Supabase (use your Vercel URL):**  
   In the **platform** Supabase project: **Authentication → URL Configuration**
   - **Site URL:** your platform Vercel URL, e.g. `https://platform-admin-xxxx.vercel.app` (no trailing slash).
   - **Redirect URLs:** add:
     - `https://platform-admin-xxxx.vercel.app/api/platform/auth/callback`
     - `https://platform-admin-xxxx.vercel.app/**`  
   Use the **exact** URL you use for the platform app (same as `NEXT_PUBLIC_APP_URL` in the platform Vercel project). Magic links will then redirect to Vercel, not localhost.

4. In **Dealer** Supabase: Set Site URL to dealer app URL and redirect URLs as needed.

---

## 2. Create Vercel projects and env vars

Create two Vercel projects from the same repo:

- **Dealer**: Root Directory = `apps/dealer`. Add all **Dealer** env vars from [env-reference.md](./env-reference.md).
- **Platform**: Root Directory = `apps/platform`. Add all **Platform** env vars from [env-reference.md](./env-reference.md).

Critical:

- `INTERNAL_API_JWT_SECRET`: **same value** in both projects (min 16 chars; e.g. `openssl rand -hex 32`).
- `DEALER_INTERNAL_API_URL` (platform): base URL of the **dealer** app (e.g. `https://app.yourdomain.com`), no trailing slash.
- `NEXT_PUBLIC_APP_URL`: canonical URL of **that** app (dealer or platform).

See [vercel-settings.md](./vercel-settings.md) for Build/Install commands.

---

## 3. Run migrations (both DBs)

From **repo root**, with env vars set (e.g. in `.env.local` and `.env.platform-admin`), run:

```bash
npm run db:setup
```

This runs dealer migrations then platform migrations. See [supabase-setup.md](./supabase-setup.md) for env file setup and optional seeds.

**Or run separately:**

- **Dealer:** `npm run db:migrate` (uses `DATABASE_URL` from `.env.local`)
- **Platform:** `npm run db:migrate:platform` (uses `DATABASE_URL` from `.env.platform-admin`)

Do not mix: dealer migrations apply dealer schema; platform migrations apply platform schema.

---

## 4. Seed / bootstrap

**Dealer:** No mandatory seed for provisioning. The dealer provisioning endpoint creates the dealership and initial data when platform calls it. For local/dev you can run `npm run db:seed` (dealer) to get a demo dealership; production provisioning is done via platform → dealer internal API.

**Platform:** Create at least one platform owner so you can log in:

1. In **Platform** Supabase, create a user (Authentication → Users → Add user), or use sign-up. Copy the user’s **UUID** (id).
2. From repo root (with platform `DATABASE_URL` and `PLATFORM_OWNER_USER_ID` set):

```bash
npm run db:seed:platform
```

Or manually: `cd apps/platform && dotenv -e ../../.env.platform-admin -- npx tsx scripts/seed-owner.ts`

Set in `.env.platform-admin` (or export before running):

- `DATABASE_URL` — platform Postgres URI
- `PLATFORM_OWNER_USER_ID` — the Supabase auth user UUID from step 1
- Optional: `ROLE=PLATFORM_OWNER` (default)

The script is idempotent (upserts); you can run it again to add or update users.

**Dealer — if provisioned users have no dashboard access (e.g. "You don't have access to the dashboard"):** Provisioning now ensures Permission rows exist. For dealerships already provisioned before that fix, run once from repo root. Uses `DIRECT_DATABASE_URL` when set (recommended for Supabase to avoid pooler hang), else `DATABASE_URL` from `.env.local`:

```bash
npm run db:repair-dealer-roles
```

This ensures Permission rows exist and attaches default permissions to any Owner/Admin/Sales/Finance roles that have none.

---

## 5. Deploy on Vercel

Push to the branch connected to your Vercel projects (e.g. `main` or `master`), or trigger deploy from the Vercel dashboard. Ensure both projects build:

- Dealer: Root `apps/dealer`, Build = `npm run build`
- Platform: Root `apps/platform`, Build = `npm run build`

---

## 6. Post-deploy smoke checklist

Optional: run a minimal health check from repo root (set `DEALER_APP_URL` and `PLATFORM_APP_URL` first):

```bash
# From repo root (bash)
DEALER_APP_URL="${DEALER_APP_URL:-http://localhost:3000}"
PLATFORM_APP_URL="${PLATFORM_APP_URL:-http://localhost:3001}"
curl -sS "${DEALER_APP_URL}/api/health" | jq .
curl -sS "${PLATFORM_APP_URL}/api/health" | jq .
```

Manual checklist:

1. **Health**
   - `GET https://<dealer-url>/api/health` → `{ ok: true, app: "dealer", db: "ok", ... }`
   - `GET https://<platform-url>/api/health` → `{ ok: true, app: "platform", db: "ok", ... }`

2. **Platform login**
   - Open platform app → Login with the Supabase user you created and linked to `platform_users` via `seed-owner.ts`.

3. **Provision**
   - In platform, create/use an application, approve, then provision a dealership. Confirm it succeeds and a dealer dealership is created via internal API.

4. **Owner invite**
   - From platform, open the provisioned dealership and send an owner invite to an email. Confirm invite is created.

5. **Accept invite (dealer)**
   - Use the invite link in email (or dealer `/accept-invite?token=...`). Log in or sign up in dealer; accept invite. Confirm the user becomes Owner of the dealership.

6. **Lifecycle**
   - From platform, set dealership to SUSPENDED then CLOSED. In dealer, confirm read-only (or blocked) UX as designed.

7. **Monitoring**
   - Open `https://<platform-url>/platform/monitoring` (while signed in as a platform user). Confirm the status banner shows "All systems operational" when both platform and dealer health are ok. Use "Copy diagnostics" and confirm the clipboard contains platform/dealer health snapshots, user id, role, and timestamp (no env or secrets). If dealer health fails, banner should show "Degraded"; if platform health fails, "Outage". Optional: set `NEXT_PUBLIC_SENTRY_PLATFORM_URL` and `NEXT_PUBLIC_SENTRY_DEALER_URL` to show Sentry links on the Monitoring page.

---

## 7. Local verification before deploying

Run from **repo root**:

```bash
npm run build:dealer
npm run build:platform
npm run test:platform
npm run test:portal-split
```

Then start both apps locally and hit health:

```bash
# Terminal 1
npm run dev:dealer
# Terminal 2
npm run dev:platform
# Then:
# curl http://localhost:3000/api/health
# curl http://localhost:3001/api/health
```

---

## Summary: migration commands

| App     | Command (from repo root)     |
|---------|------------------------------|
| Dealer  | `npm run db:migrate`         |
| Platform| `npm run db:migrate:platform`|

Platform owner bootstrap (from repo root):

```bash
npm run db:seed:platform
```

Requires in env (e.g. `.env.platform-admin`): `DATABASE_URL`, `PLATFORM_OWNER_USER_ID`, optional `ROLE=PLATFORM_OWNER`.

---

## Production hardening (confirmed)

- **Dev-auth cannot run in production:** `/platform/dev-login` returns 404 when `NODE_ENV === "production"`. Platform auth uses Supabase session only in production; `PLATFORM_USE_HEADER_AUTH` is ignored when `NODE_ENV === "production"`.
- **Internal API rate limit:** In production, `DISABLE_INTERNAL_RATE_LIMIT` is ignored; rate limiting is always active. If set in production, a server-side error is logged.
- **Internal API URL:** Platform requires `DEALER_INTERNAL_API_URL` (valid URL) and `INTERNAL_API_JWT_SECRET` (min 16 chars); validated at startup via `/api/health` and when calling the dealer.

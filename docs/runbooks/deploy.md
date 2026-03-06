# Deployment runbook

## Two Vercel projects

- **Dealer portal** — Root directory: `apps/dealer`. Deploy the dealer Next.js app (tenant-scoped UI and API, internal provisioning/status endpoints under `/api/internal/*`).
- **Platform admin portal** — Root directory: `apps/platform`. Deploy the platform Next.js app (platform admin UI and API; no tenant data).

## Vercel configuration

### Dealer project

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/dealer` |
| **Build Command** | `npm run build` (runs in apps/dealer) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (in apps/dealer; ensure `packages/contracts` is resolvable via `file:../../packages/contracts`) |

Required environment variables (set in Vercel → Project → Settings → Environment Variables):

- `DATABASE_URL` — Dealer Postgres connection string (dealer Supabase or your dealer DB).
- `NEXT_PUBLIC_SUPABASE_URL` — Dealer Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Dealer Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY` — Dealer Supabase service role key.
- `NEXT_PUBLIC_APP_URL` — Canonical dealer app URL (e.g. `https://app.yourdomain.com`).
- `COOKIE_ENCRYPTION_KEY` — 32+ byte hex (e.g. `openssl rand -hex 32`).
- `CRON_SECRET` — Secret for cron-protected routes (e.g. `/api/crm/jobs/run`).

Optional: `DEALER_INTERNAL_API_BASE_URL` if the platform calls the dealer internal API from a different origin (see platform env).

### Platform project

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/platform` |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |

Required environment variables:

- `DATABASE_URL` — Platform Postgres connection string (platform Supabase/DB).
- `NEXT_PUBLIC_SUPABASE_URL` — Platform Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Platform Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY` — Platform Supabase service role key.
- `NEXT_PUBLIC_APP_URL` — Canonical platform app URL (e.g. `https://platform.yourdomain.com`).
- `COOKIE_ENCRYPTION_KEY` — Platform cookie encryption key.
- (If platform calls dealer internal API) `DEALER_INTERNAL_API_URL` — Base URL of the dealer app (e.g. `https://app.yourdomain.com`) for provisioning, status, and owner-invite calls. Must match the URL the platform server uses to call the dealer.
- `INTERNAL_API_JWT_SECRET` — Shared secret (platform + dealer) for signing/verifying internal API JWTs. Same value in both apps when platform calls dealer.

**Platform auth (production):** In production, platform uses Supabase session only (cookie-based). Ensure `platform_users` rows exist with `id` = Supabase auth user UUID for each allowed admin. Do not set `PLATFORM_USE_HEADER_AUTH` in production.

**Confirming platform auth is Supabase-only (Vercel):** In production, omit `PLATFORM_USE_HEADER_AUTH` in Vercel environment variables; then only the Supabase session authenticates. To verify: call any `GET` or `POST` to `/api/platform/*` with only the `X-Platform-User-Id` header (no Supabase session cookie). The response must be **401 Unauthorized**. If you got 200, header auth would be enabled—remove `PLATFORM_USE_HEADER_AUTH` from Production env and redeploy.

**Owner invite flow:** Platform user (PLATFORM_OWNER) sends owner invite from dealership detail → platform calls dealer `POST /api/internal/dealerships/{dealerDealershipId}/owner-invite` with JWT and Idempotency-Key → dealer creates invite with Owner role and returns inviteId. Invitee accepts via dealer `/accept-invite?token=...`.

## Migrations

- **Dealer DB**: From repo root, run `npm run db:migrate` (loads `.env.local` and runs `prisma migrate deploy` in `apps/dealer`). Or from `apps/dealer`: set `DATABASE_URL` and run `npm run db:migrate`.
- **Platform DB**: From repo root, run `npm run db:migrate:platform` (loads `.env.platform-admin` and runs `prisma migrate deploy` in `apps/platform`). Or from `apps/platform`: set `DATABASE_URL` in `.env.local` and run `npm run db:migrate`.

Do not mix: dealer migrations apply dealer schema (tenant tables); platform migrations apply platform schema (platform_users, applications, etc.).

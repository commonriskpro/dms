# Environment variable reference

Single source of truth for env vars used by the Dealer and Platform apps. Set these in Vercel (Project → Settings → Environment Variables) and in local `.env` files as needed.

---

## Dealer app (`apps/dealer`)

| Variable | Required | Example | Where set | Notes |
|----------|----------|---------|-----------|--------|
| `DATABASE_URL` | Yes | `postgresql://postgres:***@db.xxx.supabase.co:5432/postgres` | Vercel, Supabase (Connection string) | Dealer Postgres. Use pooled (port 6543) for serverless if preferred. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xxx.supabase.co` | Vercel | Dealer Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJ...` | Vercel | Dealer Supabase anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJ...` | Vercel | Dealer Supabase service role key (server-only). |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://app.yourdomain.com` | Vercel | Canonical dealer app URL (no trailing slash). |
| `COOKIE_ENCRYPTION_KEY` | Yes | 32+ char hex (e.g. `openssl rand -hex 32`) | Vercel | Server-only. Used for cookie signing. |
| `CRON_SECRET` | Yes | Random secret string | Vercel | Protects cron routes (e.g. `/api/crm/jobs/run`). |
| `INTERNAL_API_JWT_SECRET` | When platform calls dealer | Same value as Platform | Vercel | Shared with platform; dealer verifies JWT. Min 16 chars. |

Invite-related: `NEXT_PUBLIC_APP_URL` is used by the dealer internal owner-invite endpoint to build `acceptUrl` in the response (link for platform to give to invitee). Set to the canonical dealer app URL.

Optional (not in health validation):

- `ALLOW_BOOTSTRAP_LINK` — Set to `1` to allow linking first user as owner when dealership already has members (dev/bootstrap only).
- `NHTSA_API_URL` — Override VIN decode API (default: https://vpic.nhtsa.dot.gov/api).
- `SLOW_QUERY_THRESHOLD_MS` — Log slow Prisma queries (default 2000).
- `RATE_LIMIT_SALT` — Optional server-only salt for hashing internal rate-limit source IPs before storage. If unset, dealer falls back to `INTERNAL_API_JWT_SECRET`.
- `DISABLE_INTERNAL_RATE_LIMIT` — **Dev/test only.** Allows disabling dealer internal API rate limiting outside production. Ignored in production.
- `TELEMETRY_RETENTION_DAYS_RATE_LIMIT` — Optional server-only retention window (days) for purging raw `dealer_rate_limit_events`. Default: `14`.
- `TELEMETRY_RETENTION_DAYS_JOB_RUNS` — Optional server-only retention window (days) for purging raw `dealer_job_runs`. Default: `30`.

**Monitoring (optional):**

- `SENTRY_DSN` — Sentry project DSN for error and performance. When unset, Sentry SDK is no-op. Use a separate Sentry project per app (e.g. dms-dealer, dms-platform).
- `SENTRY_TRACES_SAMPLE_RATE` — Not used directly; sampling is set in code (e.g. 0.05 in production). Override via SDK config if needed.
- `SENTRY_AUTH_TOKEN` — Optional; for source map uploads in CI. Set in Vercel (Build env) only; do not expose to client.
- `SENTRY_ORG` / `SENTRY_PROJECT` — Optional; for Sentry CLI/source map upload in build.

---

## Platform app (`apps/platform`)

| Variable | Required | Example | Where set | Notes |
|----------|----------|---------|-----------|--------|
| `DATABASE_URL` | Yes | `postgresql://postgres:***@db.yyy.supabase.co:5432/postgres` | Vercel, Supabase | Platform Postgres (separate from dealer). |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://yyy.supabase.co` | Vercel | Platform Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJ...` | Vercel | Platform Supabase anon key. |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://platform.yourdomain.com` | Vercel | Canonical platform app URL. |
| `DEALER_INTERNAL_API_URL` | Yes | `https://app.yourdomain.com` | Vercel | Base URL of dealer app (no trailing slash). Required for platform→dealer internal API and for **Monitoring** dealer-health proxy (`GET /api/platform/monitoring/dealer-health`). |
| `INTERNAL_API_JWT_SECRET` | Yes | Same value as Dealer | Vercel | Shared with dealer; platform signs JWT. Min 16 chars. |
| `RESEND_API_KEY` | Yes (production) | `re_...` | Vercel | Resend API key for sending owner-invite emails. Server-only; never expose to client. |
| `PLATFORM_EMAIL_FROM` | Yes (production) | `Platform <noreply@yourdomain.com>` | Vercel | From address for platform emails. Must be verified domain in Resend. |
| `SUPABASE_SERVICE_ROLE_KEY` | When using invite | `eyJ...` | Vercel | Platform Supabase service role key. **Server-only**; required for `POST /api/platform/users/invite`. Never expose in client bundles or logs. |

Optional:

- `NEXT_PUBLIC_PLATFORM_ORIGIN` — Override platform origin for API client (default from `NEXT_PUBLIC_APP_URL` / localhost:3001).
- `PLATFORM_USE_HEADER_AUTH` — **Dev only and already implemented for local testing.** Must remain unset in production; production auth must use Supabase session auth only.
- `PLATFORM_BOOTSTRAP_SECRET` — When set, enables one-time owner bootstrap at `/platform/bootstrap`. Authenticated user submits this secret to become PLATFORM_OWNER. Use a long random string; optionally unset after first use.
- `PLATFORM_SUPPORT_EMAIL` — Optional; used in owner-invite email footer (e.g. `support@yourdomain.com`).
- `NEXT_PUBLIC_PLATFORM_URL` — Optional; for links in platform emails (defaults to `NEXT_PUBLIC_APP_URL`).

**Monitoring (optional):**

- `SENTRY_DSN` — Sentry project DSN for platform. When unset, Sentry is no-op.
- `NEXT_PUBLIC_SENTRY_DSN` — Optional; for client-side Sentry (defaults to server DSN when set in server config).
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` — Optional; override environment tag (default from `VERCEL_ENV` or `NODE_ENV`).
- `NEXT_PUBLIC_SENTRY_PLATFORM_URL` — Optional; dashboard URL for platform Sentry project. When set, the Monitoring page shows an "Open in new tab" link to this URL.
- `NEXT_PUBLIC_SENTRY_DEALER_URL` — Optional; dashboard URL for dealer Sentry project. When set, the Monitoring page shows an "Open in new tab" link to this URL.
- `SENTRY_AUTH_TOKEN` — Optional; for source map uploads in CI. Set in Vercel Build env only.
- `SENTRY_ORG` / `SENTRY_PROJECT` — Optional; for Sentry CLI in build.

**Operational maturity (Step 7):**

- `CRON_SECRET` — Optional; server-only. Used by maintenance/monitoring runs (`POST /api/platform/monitoring/check-dealer-health`, dealer cron routes) via `x-cron-secret` or `Authorization: Bearer <secret>` depending on route. Use a random secret; never expose to client.
- `PLATFORM_SLACK_WEBHOOK_URL` — Optional; server-only. Slack webhook for dealer-health failure/recovery alerts. When set, check-dealer-health sends sanitized alerts (no PII/secrets).
- `PLATFORM_SUPPORT_EMAIL` — Optional. When used with `RESEND_API_KEY` and `PLATFORM_EMAIL_FROM`, recovery/failure alerts can be sent by email to this address.
- `PLATFORM_RETENTION_DAYS_MONITORING_EVENTS` — Optional server-only retention window (days) for `platform_monitoring_events` purge. Default: `30`.
- `PLATFORM_RETENTION_DAYS_AUDIT_LOGS` — Optional reporting-only value. Default: `3650`. **Audit logs remain append-only and are not auto-purged.**

Do not set in production:

- `PLATFORM_USE_HEADER_AUTH` — Must be unset in production (Supabase session only).

---

## Where to set in Vercel

1. Open Vercel project (Dealer or Platform).
2. Settings → Environment Variables.
3. Add each variable for the appropriate environments (Production, Preview, Development).
4. For Production, use your production Supabase and URLs; for Preview you may use staging or the same.

---

## Supabase: getting connection strings and keys

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **API → anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **API → service_role** → `SUPABASE_SERVICE_ROLE_KEY` (dealer only; keep secret)
- **Settings → Database → Connection string** (URI) → `DATABASE_URL` (use Transaction or Session mode; for serverless, pooled port 6543 is often used)

Use one Supabase project for dealer (DB + Auth) and a separate Supabase project for platform (DB + Auth).

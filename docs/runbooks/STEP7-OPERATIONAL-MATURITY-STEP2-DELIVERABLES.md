# Step 7 — Operational Maturity: Step 2 (Backend) Deliverables

This document summarizes the **Step 2 Backend** implementation for Operational Maturity (see `docs/runbooks/STEP7-OPERATIONAL-MATURITY.md`). No UI pages were added in this step (that is Step 3).

---

## Files changed

### Contracts (`packages/contracts`)

| File | Change |
|------|--------|
| `src/platform/monitoring.ts` | **Created** — Zod schemas: `platformGetDealerHealthResponseSchema`, `platformRateLimitStatsQuerySchema`, `platformJobRunsQuerySchema`, `platformAlertEventSchema` |
| `src/dealer/monitoring.ts` | **Created** — Zod schemas: `dealerInternalRateLimitSnapshotSchema`, `dealerJobRunEventSchema`, `dealerJobRunsQuerySchema`, `dealerRateLimitsQuerySchema` |
| `src/index.ts` | **Modified** — Export `platform/monitoring` and `dealer/monitoring` |

### Platform app

| Area | Files |
|------|--------|
| **Correlation / logging** | `lib/api/with-api-logging.ts` (created), `lib/api/README.md` (created), `lib/request-id.ts`, `lib/logger.ts`, `lib/redact.ts`; `app/api/platform/bootstrap/route.ts` (wrapped), `app/api/platform/monitoring/dealer-health/route.ts` (X-Request-Id on response); `lib/call-dealer-internal.ts` (X-Request-Id on all outbound calls) |
| **Sentry** | `lib/monitoring/sentry.ts` (created), `sentry.server.config.ts` (uses `initServerSentry`), `lib/api-handler.ts` (`captureApiException`, `SentryApiContext`) |
| **Alerting** | `prisma/schema.prisma` (PlatformMonitoringEventType, PlatformAlertStatus, PlatformMonitoringEvent, PlatformAlertState), `prisma/migrations/20260302100000_add_platform_monitoring_events_and_alert_state/`, `lib/monitoring-db.ts`, `lib/check-dealer-health-service.ts`, `app/api/platform/monitoring/check-dealer-health/route.ts`, `lib/check-dealer-health-service.test.ts`, `app/api/platform/monitoring/check-dealer-health/route.test.ts` |
| **Rate limits proxy** | `app/api/platform/monitoring/rate-limits/route.ts`, `app/api/platform/monitoring/rate-limits/route.rbac.test.ts`; `lib/call-dealer-internal.ts` (`callDealerRateLimits`) |
| **Job runs proxy** | `app/api/platform/monitoring/job-runs/route.ts`, `app/api/platform/monitoring/job-runs/route.rbac.test.ts`, `app/api/platform/monitoring/job-runs/route.mapping.test.ts`; `lib/call-dealer-internal.ts` (`callDealerJobRuns`) |

### Dealer app

| Area | Files |
|------|--------|
| **Correlation / logging** | `lib/api/with-api-logging.ts` (created), `lib/api/README.md` (created), `lib/logger.ts`, `lib/redact.ts`; `app/api/health/route.ts` (wrapped); `modules/crm-pipeline-automation/service/job-worker.ts` (durationMs, skippedReason in logs) |
| **Sentry** | `lib/monitoring/sentry.ts` (created), `sentry.server.config.ts` (uses `initServerSentry`), `lib/api/handler.ts` (`captureApiException`, `SentryApiContext`); `app/api/internal/provision/dealership/route.ts`, `job-worker.ts` (use `captureApiException`) |
| **Rate limit metrics** | `prisma/schema.prisma` (DealerRateLimitEvent), `prisma/migrations/20260302120000_dealer_rate_limit_events/`, `lib/rate-limit-events.ts`, `lib/rate-limit-stats.ts`, `lib/internal-rate-limit.ts` (async, records events; no-op in test), `app/api/internal/monitoring/rate-limits/route.ts`, `lib/rate-limit-stats.test.ts`; internal routes (provision, status, owner-invite) `await checkInternalRateLimit` |
| **Job run telemetry** | `prisma/schema.prisma` (DealerJobRun), `prisma/migrations/20260302180000_add_dealer_job_runs/`, `modules/crm-pipeline-automation/db/dealer-job-run.ts`, `modules/crm-pipeline-automation/service/job-worker.ts` (writes run row), `app/api/internal/monitoring/job-runs/route.ts`, `app/api/internal/monitoring/job-runs/route.test.ts`, `modules/crm-pipeline-automation/tests/dealer-job-run.test.ts`, `modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts` (mock createDealerJobRun) |

### Runbooks

| File | Change |
|------|--------|
| `docs/runbooks/env-reference.md` | Added CRON_SECRET, PLATFORM_SLACK_WEBHOOK_URL, PLATFORM_SUPPORT_EMAIL (alerting); NEXT_PUBLIC_SENTRY_ENVIRONMENT |

---

## Migrations added

- **Platform**: `20260302100000_add_platform_monitoring_events_and_alert_state` — `platform_monitoring_events`, `platform_alert_state` (and enums).
- **Dealer**: `20260302120000_dealer_rate_limit_events` — `dealer_rate_limit_events`; `20260302180000_add_dealer_job_runs` — `dealer_job_runs`.

Apply from repo root or each app directory:

- Platform: `npm run db:migrate:platform` (or from `apps/platform`: `npx prisma migrate deploy` with `DATABASE_URL`).
- Dealer: `npm run db:migrate` (or from `apps/dealer`: `npx prisma migrate deploy` with `DATABASE_URL`).

---

## How to run locally

1. **Contracts**
   ```bash
   cd packages/contracts && npm run build
   ```

2. **Platform**
   ```bash
   cd apps/platform
   npm run test -- --run
   npm run build
   ```
   Ensure `DATABASE_URL` is set for migrations and tests that hit DB.

3. **Dealer**
   ```bash
   cd apps/dealer
   npm run test -- --run
   npm run build
   ```
   Ensure `DATABASE_URL` is set for migrations and tests that hit DB.

---

## Commands run (quality gates)

| Command | Result |
|--------|--------|
| `cd packages/contracts && npm run build` | ✅ |
| `cd apps/platform && npm run test -- --run` | ✅ 24 files, 100 tests |
| `cd apps/platform && npm run build` | ✅ |
| `cd apps/dealer && npm run test -- --run` | ✅ 58 files, 340 tests |
| `cd apps/dealer && npm run build` | ✅ |

---

## Deployed-only verification

1. **X-Request-Id**
   - Call any API (e.g. `GET /api/health` on dealer or platform). Response headers must include `X-Request-Id` (same or generated value).

2. **Structured logs / requestId**
   - Trigger a safe test error (e.g. temporary throw in a preview route or use a test endpoint). Confirm logs (Vercel or drain) contain a JSON line with `requestId` and no PII/tokens.

3. **Monitoring proxies**
   - As platform user with OWNER/COMPLIANCE/SUPPORT:  
     - `GET /api/platform/monitoring/rate-limits?dateFrom=...&dateTo=...` → 200 and paginated items (or empty).  
     - `GET /api/platform/monitoring/job-runs?platformDealershipId=...&dateFrom=...&dateTo=...` → 200 and `data`/total (or 404 if no mapping).

4. **Check-dealer-health**
   - `POST /api/platform/monitoring/check-dealer-health` with header `x-cron-secret: <CRON_SECRET>` → 200 and JSON with `ok`, `upstreamStatus`, etc.
   - If `PLATFORM_SLACK_WEBHOOK_URL` is set and dealer is down (or URL wrong), trigger until threshold → one Slack message (sanitized). After recovery → one recovery message. No spam within cooldown (15 min).

5. **Sentry**
   - In Sentry project, confirm release shows correct version (e.g. `VERCEL_GIT_COMMIT_SHA`) and environment. Trigger a test error and confirm event includes `requestId` and no auth/body.

---

## Notes

- No UI pages were added in Step 2; monitoring UI (rate-limits, jobs) is Step 3.
- Alert config is env-only (Slack webhook, CRON_SECRET, optional Resend); no DB-backed config.
- Dealer internal rate limit records events only when not in test env; in test, `recordRateLimitEvent` is no-op.
- Platform never connects to dealer DB; all dealer data is read via dealer internal APIs with JWT.

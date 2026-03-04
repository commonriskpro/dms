# Step 7 — Operational Maturity: Step 2.5 (Retention + Aggregation)

This runbook captures **Step 2.5 backend hardening** across dealer and platform for telemetry retention, daily aggregation, and maintenance orchestration.

## What was added

### Dealer

- Raw telemetry retention jobs (batched deletes, server-side):
  - `purgeOldRateLimitEvents({ olderThanDays })`
  - `purgeOldJobRuns({ olderThanDays })`
- New daily aggregate tables:
  - `dealer_rate_limit_stats_daily`
  - `dealer_job_runs_daily`
- Daily aggregation jobs (idempotent upsert; UTC day windows):
  - `aggregateRateLimitDaily(day?)`
  - `aggregateJobRunsDaily(day?)`
- New internal JWT-only monitoring endpoints:
  - `GET /api/internal/monitoring/rate-limits/daily`
  - `GET /api/internal/monitoring/job-runs/daily`
  - `POST /api/internal/monitoring/maintenance/run`
- New dealer envs:
  - `TELEMETRY_RETENTION_DAYS_RATE_LIMIT` (default 14)
  - `TELEMETRY_RETENTION_DAYS_JOB_RUNS` (default 30)

### Platform

- Monitoring retention helper:
  - `purgeOldMonitoringEvents({ olderThanDays })`
  - Explicitly **does not touch `platform_audit_logs`** (audit remains append-only).
- New platform maintenance endpoint:
  - `POST /api/platform/monitoring/maintenance/run`
  - Auth: `x-cron-secret == CRON_SECRET` **or** `PLATFORM_OWNER`
  - Purges platform monitoring events and calls dealer maintenance endpoint with propagated `X-Request-Id`.
- New platform proxy endpoints for dealer daily aggregates:
  - `GET /api/platform/monitoring/rate-limits/daily`
  - `GET /api/platform/monitoring/job-runs/daily`
- New platform envs:
  - `PLATFORM_RETENTION_DAYS_MONITORING_EVENTS` (default 30)
  - `PLATFORM_RETENTION_DAYS_AUDIT_LOGS` (default 3650; reporting-only, no auto-purge)

### Security and compliance hardening

- No raw `ipHash` in API responses.
- Upstream failures return sanitized payloads only (`requestId`, `upstreamStatus`, generic message).
- Internal monitoring endpoints remain JWT-only + internal-rate-limited.
- Platform RBAC checks happen before sensitive lookups.
- Production auth hardening remains in place (`PLATFORM_USE_HEADER_AUTH` must stay unset in production).

## Vercel cron suggestions

Use server-only secrets; never expose cron headers to the browser.

- `POST /api/platform/monitoring/check-dealer-health`
  - Schedule: every 5 minutes.
  - Header: `x-cron-secret: $CRON_SECRET`.
- `POST /api/platform/monitoring/maintenance/run`
  - Schedule: daily at `30 3 * * *` (03:30 UTC).
  - Body: `{ "kind": "all" }` (or `"purge"` / `"aggregate"`).
  - Header: `x-cron-secret: $CRON_SECRET`.

## Supabase verification queries (safe: counts/newest rows only)

Run in the respective app database SQL editor.

```sql
-- Dealer raw telemetry volume
select count(*) as total_rows, max(created_at) as newest_row
from dealer_rate_limit_events;

select count(*) as total_rows, max(started_at) as newest_row
from dealer_job_runs;

-- Dealer daily aggregates
select count(*) as total_rows, max(day) as newest_day
from dealer_rate_limit_stats_daily;

select count(*) as total_rows, max(day) as newest_day
from dealer_job_runs_daily;

-- Platform monitoring telemetry
select count(*) as total_rows, max(created_at) as newest_row
from platform_monitoring_events;

select count(*) as total_rows, max(last_change_at) as newest_change
from platform_alert_state;
```

## Rollback notes

- Code rollback: revert Step 2.5 commits for telemetry retention/aggregation routes/libs/tests.
- Runtime rollback:
  - Disable `POST /api/platform/monitoring/maintenance/run` cron first.
  - Keep health check cron enabled if still needed.
- Data rollback:
  - Daily tables are derived data and can be truncated/rebuilt from raw retention window.
  - Do **not** purge `platform_audit_logs` as part of rollback.

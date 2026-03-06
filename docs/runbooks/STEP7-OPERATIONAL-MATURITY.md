# Step 7 — Operational Maturity (Step 1 Spec Only)

**Scope**: Design the operational maturity layer across **both** apps (dealer + platform). This document is **Step 1 — Spec only**. No code changes, no env vars, no migrations.

**References**: `docs/runbooks/monitoring-spec.md`, `docs/runbooks/deploy.md`, existing `/api/platform/monitoring/dealer-health`, dealer internal rate limiter, dealer job worker.

---

## 1) Principles / Constraints

### Operational data vs tenant/business data

- **Operational data**: Health status, request IDs, correlation IDs, error codes, route paths, HTTP method/status, duration, rate-limit counts, job run summaries (processed/failed/deadLetter/skippedReason), alert state (degraded/outage), timestamps. Used only for observability, alerting, and debugging. Stored in logs, optional metrics tables, and Sentry.
- **Tenant/business data**: Dealerships, users, deals, customers, documents, audit log content (beforeState/afterState for business entities). Stored in application DBs and must remain tenant-scoped; never mixed with operational data in a way that breaks isolation.
- **Rule**: Operational tables (e.g. rate limit metrics, job run summaries) may reference `dealershipId` (UUID) for filtering only; they must **not** contain PII, tokens, or business payloads.

### What must NEVER be logged or stored in operational systems

- **Explicitly forbidden**: Tokens (Bearer, invite token, JWT raw value, `acceptUrl`), emails, phone numbers, Supabase keys, DB URLs, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_JWT_SECRET`, `COOKIE_ENCRYPTION_KEY`, request headers that may contain secrets (`Authorization`, full `Cookie`), request/response bodies by default. No VIN, SSN, DOB, income, or customer names in logs or metrics.
- **Redaction**: A centralized `redact()` (or equivalent) must be used for any structured log payload and for audit/state that could be exported; same key list across dealer and platform where applicable (e.g. `token`, `email`, `password`, `accept_url`, `secret`, `authorization`, `cookie`).

### Retention (high level)

- **Operational tables** (e.g. rate limit buckets, job run history): Retain 30–90 days; define exact TTL in implementation. No long-term retention of raw IPs; hashed/rotating only if stored.
- **Logs**: Subject to Vercel log retention (or external drain); no separate retention requirement in this spec.
- **Sentry**: Per Sentry org/project retention settings; no PII in events.

---

## 2) Sentry Spec (Dealer + Platform)

### Required env vars per app

| Variable | App | Where | Required | Notes |
|----------|-----|--------|----------|--------|
| `NEXT_PUBLIC_SENTRY_DSN` | Both | Client (browser) | Optional | When set, client-side Sentry is enabled. When unset, client SDK can no-op. |
| `SENTRY_DSN` | Both | Server / Edge | Optional | When set, server/edge errors are sent. When unset, SDK no-op. |
| `SENTRY_AUTH_TOKEN` | Both | Build (CI) | Optional | Only if using CI release/source map upload. Omit if not uploading source maps. |
| `SENTRY_ORG` | Both | Build | Optional | Sentry org slug for CLI/upload. |
| `SENTRY_PROJECT` | Both | Build | Optional | Sentry project slug for CLI/upload. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Both | Client + Server | Optional | Override for environment tag (e.g. `production`, `preview`, `development`). Default from `VERCEL_ENV` or `NODE_ENV`. |

- **Separate Sentry projects**: One for dealer (e.g. `dms-dealer`), one for platform (e.g. `dms-platform`). Different DSNs per Vercel project.

### Release tagging strategy

- **release**: `VERCEL_GIT_COMMIT_SHA` when available (Vercel); otherwise a generated build id (e.g. `next build` output). Used for source map resolution and release grouping.
- **environment**: `production` | `preview` | `development` (from `VERCEL_ENV` or `NODE_ENV`). Set on Sentry init so every event is tagged.

### What gets captured

- **Unhandled server errors**: All uncaught exceptions in server/API routes (both apps).
- **Route errors**: API handler errors (5xx and mapped 4xx where useful) via error handler or wrapper; map known error codes (e.g. `ApiError`, `PlatformApiError`) to tags; no PII in message or context.
- **Frontend error boundaries**: Platform (and dealer if applicable) React error boundaries; report to Sentry with safe context only. No request body or headers attached.

### Safe context fields allowed

- **Allowed**: `app` ("dealer" | "platform"), `version`/`release`, `requestId`, `correlationId` (if used), `platformUserId` (UUID only, when already in auth context — not from untrusted input), `dealershipId` (UUID only, when already in tenant context). Plus `route`, `method`, `status`, `errorCode` (application code).
- **MUST NOT be attached**: Request bodies by default; auth headers/cookies; emails; tokens; any raw user input that could be PII.

### Scrubbing

- Strip `Authorization`, `Cookie`, and any header that might contain secrets from Sentry payloads. Do not attach request body or query params by default. If ever needed for debugging, allow only non-PII fields (e.g. `platformDealershipId`, `dealerDealershipId`) and redact the rest.

---

## 3) Structured Logging + Correlation IDs

### Shared logging format (JSON lines)

One JSON object per line (stdout/stderr), suitable for Vercel logs and log drains.

**Required fields (every log line)**:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO 8601) | When the log was emitted. |
| `level` | string | `error`, `warn`, `info`, `debug`. |
| `app` | string | `"dealer"` or `"platform"`. |
| `env` | string | `development` | `preview` | `production` (from VERCEL_ENV / NODE_ENV). |
| `requestId` | string \| null | Correlation ID for the request (if any). |
| `correlationId` | string \| null | Same as requestId or parent request ID (e.g. platform call id when dealer is called by platform). |
| `route` | string \| null | API route path (e.g. `/api/platform/dealerships`, `/api/internal/provision/dealership`). |
| `method` | string \| null | HTTP method. |
| `status` | number \| null | HTTP status code (when logging response). |
| `durationMs` | number \| null | Request duration in ms (when available). |
| `actorPlatformUserId` | string \| null | Platform only; UUID. |
| `dealershipId` | string \| null | Dealer only; UUID. |

Additional keys (e.g. `message`, `errorCode`, `jobId`, `queueType`) allowed if they adhere to redaction rules.

### Correlation ID rules

- **Inbound**: Accept `X-Request-Id` (or `x-request-id`) from the request. If present and valid (e.g. alphanumeric + hyphen/underscore, max length 128), use it; otherwise generate a new UUIDv4.
- **Response**: Always include `X-Request-Id` in the response header with the value used for that request (so clients and logs can correlate).
- **Platform → Dealer internal calls**: Platform generates or carries a `requestId` and sends it in `X-Request-Id` on every internal fetch. Optionally send JWT `jti` (if present) for idempotency; dealer logs the incoming `requestId` and returns it in response header. Dealer must not trust or log raw tokens.

### Redaction rules for logs

- **Centralized redact()**: One shared list of keys to redact (e.g. `token`, `email`, `password`, `accept_url`, `acceptUrl`, `secret`, `authorization`, `cookie`, `Authorization`, `Cookie`, and any key that might hold PII or secrets). Apply to any object before logging. Same strategy as platform audit redaction (align key list with `apps/platform/lib/redact.ts` or equivalent).
- **Never log**: Raw headers that may contain secrets; request/response bodies; invite tokens; emails; Supabase keys; DB URLs.

### Where logging is invoked

- **Middleware or API handler wrapper** (recommended): At request start, generate or read `requestId`; at response, log one JSON line with timestamp, level, app, env, requestId, route, method, status, durationMs, and app-specific fields (actorPlatformUserId or dealershipId). Attach requestId to response header.
- **Internal fetch wrapper (platform → dealer)**: When platform calls dealer (e.g. `callDealerInternal`), pass `X-Request-Id` on outbound request; log outbound call with requestId; dealer logs inbound with same requestId.
- **Job worker runs (dealer)**: After each run (or on skip), log a summary line with requestId (or run id), dealershipId, route (e.g. `job-worker`), processed, failed, deadLetter, skippedReason (e.g. tenant_not_active), durationMs. No job payload content.

---

## 4) Alerting Hooks (Slack/email) for Dealer-Health Failure

### Source of truth

- **Endpoint**: Existing platform `GET /api/platform/monitoring/dealer-health`. It proxies to dealer `GET /api/health` and returns sanitized JSON: `ok`, `app`, `version`, `time`, `db`, `upstreamStatus`, and optional `error` (no upstream body, no env values, no tokens).
- **Consumer**: A scheduled job or cron (e.g. Vercel Cron or external pinger) that calls this endpoint at a fixed interval (e.g. every 1–2 minutes). Platform must be authenticated (use a server-side token or session); RBAC already restricts to OWNER/COMPLIANCE/SUPPORT.

### Alert trigger logic

- **Failure threshold**: Consider dealer health "failing" when the proxy returns non-200 or `ok === false`. Trigger alert when:
  - **Option A**: N consecutive failures (e.g. 3), OR
  - **Option B**: At least one failure in each of the last M minutes (e.g. 5 min outage window).
- **Recovery**: When the proxy returns 200 and `ok === true` after a previous alert, send a "recovery" notification (dealer health restored).
- **Cooldown / dedupe**: After sending an "outage" or "degraded" alert, do not send another for the same condition for at least C minutes (e.g. 15–30). Use a simple in-memory or DB-backed "last alert sent at" per alert type; reset on recovery.

### Alert channels

- **Slack**: Webhook URL (e.g. `SLACK_WEBHOOK_URL_MONITORING`) — recommended. POST a JSON payload with safe fields only.
- **Email**: Optional, via Resend (or existing email provider) if already configured; same payload rules.

### Alert payload (safe)

- **Allowed**: `status` (e.g. `degraded` | `outage`), `upstreamStatus` (HTTP code from dealer), `platformUrl` (platform app URL, no secrets), `dealerUrl` (dealer app base URL, no secrets), `requestId`, `timestamp` (ISO).
- **MUST NOT include**: Upstream response body, env values, tokens, DSN, or any PII.

---

## 5) Rate Limit Metrics Dashboard

### What to measure (dealer internal rate limiter)

- **Scope**: Existing dealer `/api/internal/*` rate limiter (e.g. `checkInternalRateLimit`). Per route key (pathname) and per time bucket (e.g. 1-minute buckets):
  - `allowedCount`: requests allowed in the bucket.
  - `blockedCount`: requests that received 429 in the bucket.
- **IP handling**: Do not store raw IP long-term. If storing an "offending" identifier for dashboard (e.g. "top offending"), use a **hashed** value with a **rotating salt** (e.g. HMAC with a key that rotates daily or per deployment). Display only "hashed identifier" or "bucket id" in UI, never raw IP.

### Metrics storage (recommend one approach for MVP)

- **Option A — Platform DB**: Dealer pushes aggregated counts to platform via an internal endpoint (e.g. `POST /api/internal/metrics/rate-limits` with JWT). Platform stores in a table (e.g. `rate_limit_metrics`: routeKey, bucketStart, allowedCount, blockedCount, optional hashedIdentifier). Platform UI reads from its own DB.
  - **Pros**: Single place for all operational views; platform does not call dealer for historical data. **Cons**: Dealer must call platform (reverse of current pattern); need new internal route and auth.
- **Option B — Dealer DB**: Dealer stores metrics in dealer DB (new table or append log). Platform calls dealer internal endpoint (e.g. `GET /api/internal/monitoring/rate-limits?from=...&to=...&route=...`) with JWT. Platform UI fetches and displays.
  - **Pros**: No new platform DB table; dealer owns its data. **Cons**: Platform depends on dealer availability for historical view; need pagination and validation on dealer endpoint.
- **Recommendation for MVP**: **Option B** — dealer stores and exposes read-only metrics endpoint; platform displays. Keeps platform DB free of dealer-specific metrics and reuses existing platform→dealer internal call pattern. If volume or latency becomes an issue, add Option A later.

### Platform UI requirements

- **Route**: `/platform/monitoring/rate-limits`.
- **Filters**: Route (e.g. pathname or "all"), time range (last 1h, 24h, 7d). Validated with Zod; invalid range → 422.
- **Charts**: Simple view — requests allowed vs blocked per bucket (e.g. bar or line). No raw IP; optional "top offending" by hashed id only.
- **RBAC**: Same as other monitoring pages (OWNER/COMPLIANCE/SUPPORT read-only).

---

## 6) Background Job Monitoring UI

### What the dealer job worker emits

- **Per run** (single dealership batch or cron-triggered run): `runId` (UUID), `startedAt`, `finishedAt`, `processed`, `failed`, `deadLetter`, `skippedReason` (e.g. `ACTIVE`/`SUSPENDED`/`CLOSED` or null when not skipped), `durationMs`. **dealershipId** always included (UUID). No job payload content, no PII.
- **Where**: Either (a) append to a dealer-side table and expose via internal API, or (b) push summary to platform internal endpoint. Choose one for MVP.

### How platform reads it

- **Option A — Platform pulls**: Platform calls dealer `GET /api/internal/monitoring/job-runs?dealershipId=...&from=...&to=...&limit=...&offset=...`. Dealer returns list of run summaries from dealer DB. Pagination required.
- **Option B — Dealer pushes**: After each run, dealer POSTs a summary to platform `POST /api/internal/monitoring/job-runs` (or platform-provided URL) with JWT. Platform stores in platform DB; UI reads from platform DB.
- **Recommendation for MVP**: **Option A** — platform calls dealer internal endpoint. Keeps run data in dealer DB; no new platform schema for job runs; consistent with "platform queries dealer for operational view" pattern. Pagination and Zod validation on dealer endpoint.

### Platform UI requirements

- **Route**: `/platform/monitoring/jobs`.
- **Dealership selector**: By platform dealership id; platform must map to dealer dealership id (existing mapping or same id if 1:1) to call dealer with `dealershipId`.
- **Job runs table**: Columns e.g. runId, startedAt, finishedAt, processed, failed, deadLetter, skippedReason, durationMs, dealershipId. Sort by startedAt desc. Pagination (limit/offset or cursor).
- **Detail drawer**: Optional; show same fields for a single run (no payload). RBAC: OWNER/COMPLIANCE/SUPPORT read-only.

---

## 7) RBAC / Permissions

- **Platform Monitoring pages** (e.g. `/platform/monitoring`, `/platform/monitoring/rate-limits`, `/platform/monitoring/jobs`): Read-only access for roles **PLATFORM_OWNER**, **PLATFORM_COMPLIANCE**, **PLATFORM_SUPPORT**. Return 403 for other authenticated users; 401 when unauthenticated.
- **Mutations (e.g. alert config)**: For MVP, alert configuration is **env-only** (e.g. Slack webhook URL, Resend). No UI for editing alert rules; no DB-backed config. If alert config is added later, mutations (create/update/delete) restricted to **PLATFORM_OWNER** only.

---

## 8) Test Plan (Spec Only — for Step 4 Implementation)

Deterministic test cases to implement in a later step:

- **Correlation ID propagation**: Request without `X-Request-Id` receives generated id in response header; request with `X-Request-Id` receives same value in response. Platform→dealer call: dealer logs and response contain the same requestId sent by platform.
- **Alert dedupe**: Simulate 5 consecutive dealer-health failures; assert exactly one alert (or one per cooldown window). After recovery, one recovery notification; then another failure after cooldown triggers one more alert.
- **Redaction tests**: Log an object containing `token`, `email`, `accept_url`; assert log output does not contain raw values (redacted or omitted).
- **Monitoring endpoints RBAC**: GET `/api/platform/monitoring/dealer-health`, rate-limits, job-runs (or equivalent) return 401 without auth, 403 for role without permission, 200 for OWNER/COMPLIANCE/SUPPORT.
- **Metrics endpoints pagination + validation**: GET rate-limits or job-runs with `limit` > max or invalid `from`/`to` returns 422. Valid params return paginated list with `meta.total` or equivalent.
- **Job run telemetry respects tenant status**: When dealership is SUSPENDED or CLOSED, job worker run emits skippedReason (e.g. tenant_not_active); no processed/failed/deadLetter for that run. Assert from dealer internal endpoint or logs.

---

## 9) Deployed-only Manual Checklist (Vercel)

- [ ] **Sentry**: Deploy with `VERCEL_GIT_COMMIT_SHA` available. In Sentry project, verify release shows correct version and environment (`production`/`preview`).
- [ ] **Sentry + requestId**: Trigger a safe test error (e.g. dedicated test route or temporary throw in preview). Confirm Sentry event includes `requestId` (and no PII, no auth headers).
- [ ] **Dealer-health alert**: Simulate dealer outage (e.g. wrong dealer URL or dealer down). Confirm alert fires once (Slack or email) with safe payload; after dealer recovery, confirm recovery notification; no spam within cooldown.
- [ ] **Rate limit page**: After triggering internal rate limit (e.g. burst to dealer internal endpoint), open `/platform/monitoring/rate-limits` with valid time range. Confirm non-empty metrics (allowed vs blocked).
- [ ] **Job monitoring**: Open `/platform/monitoring/jobs`, select a dealership that has run jobs. Confirm last runs appear in table with runId, startedAt, processed, failed, deadLetter, skippedReason; detail drawer if implemented.

---

**Document**: `docs/runbooks/STEP7-OPERATIONAL-MATURITY.md`  
**Step**: 1 — Spec only. No code changes, no env vars, no migrations.

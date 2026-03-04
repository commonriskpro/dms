# Monitoring Spec — Sentry, Structured Logs, RequestId, Alerts (Step 1)

**Scope**: Production-grade monitoring for `apps/platform` and `apps/dealer`. Step 1 is spec only: no code, no env vars, no infra changes.

---

## 1. What we instrument

### Next.js server route handlers (App Router) — both apps

- **API errors**: Unhandled exceptions and 5xx responses. Map known error codes (e.g. `ApiError`, `PlatformApiError`, `InternalApiError`) to tags; do not send PII in message or context.
- **Latency**: Request duration per route (e.g. middleware or wrapper that records start/end). Report as transaction duration and optionally as a metric for dashboards.
- **Scope**: All routes under `/api/*` (dealer) and `/api/platform/*` (platform). Optionally exclude `/api/health` from performance sampling (still report errors if they occur).

### Background job worker (dealer)

- **Failures**: When a job is marked failed or dead-letter, log and optionally send a Sentry event (with low or sampled rate to avoid noise). Include: `dealershipId` (internal id only), `queueType`, `jobId`, `errorCode` (e.g. DEAD_LETTER), **no** payload content that could contain PII.
- **Skipped due to tenant status**: When `runJobWorker` skips because lifecycle is not ACTIVE, log a structured line (e.g. `job.skipped`, `reason: tenant_not_active`, `lifecycleStatus`). Do **not** send to Sentry as an error (informational only).
- **Processed counts**: After each worker run (single-dealership POST or cron GET), log summary: `processed`, `failed`, `deadLetter` per dealership (dealershipId only). Optional: expose as metric for alerting (e.g. failed count > threshold).

### Internal dealer APIs (`/api/internal/*`)

- **Auth failures**: When `verifyInternalApiJwt` throws (missing token, invalid/expired, replayed jti), log and send to Sentry as a security/operational event. Include: route, method, status 401, **no** token or header values. Tag as `internal_api_auth_failure`.
- **Rate limit hits**: When `checkInternalRateLimit` returns 429, log (route, key bucket identifier such as path + hashed IP, no raw IP in Sentry). Optional Sentry event with tag `internal_api_rate_limited`.
- **Status / provision events**: For successful provision or status change, do **not** send to Sentry (success path). For **failures** (e.g. 409, 5xx), log and optionally Sentry with route, status, `platformDealershipId` or `dealerDealershipId` only — **no** PII, no invite tokens, no `acceptUrl` token.

---

## 2. Sentry plan

### Separate projects per app

- **Dealer**: One Sentry project (e.g. `dms-dealer`). All dealer app errors and transactions go here.
- **Platform**: One Sentry project (e.g. `dms-platform`). All platform app errors and transactions go here.
- Rationale: Different teams/ownership, clearer blame, and different sampling/alert rules per app.

### Env vars per Vercel project (spec-level; no implementation in Step 1)

| Variable | App | Required | Notes |
|----------|-----|----------|--------|
| `SENTRY_DSN` | Both | Yes (when enabled) | Sentry project DSN. When unset, Sentry SDK is disabled (no-op). |
| `SENTRY_AUTH_TOKEN` | Both | Optional | For source map uploads (Vercel build). When set, release + source maps can be sent. |
| `SENTRY_ORG` | Both | Optional | Sentry org slug (for CLI/source map upload). |
| `SENTRY_PROJECT` | Both | Optional | Sentry project slug (for CLI/source map upload). |
| `NEXT_PUBLIC_SENTRY_DSN` | Both | Optional | Only if client-side Sentry is enabled later; not required for server-only in this spec. |

### Sampling strategy

- **Errors**: 100% in production (capture every error event).
- **Performance traces**: Low sampling in production (e.g. 10–20% of transactions) to control volume and cost. Optionally 100% in staging for validation.
- **Releases**: Tag events with `release` = Vercel commit SHA or `VERCEL_GIT_COMMIT_SHA` when available for source map resolution.

### PII policy

- **Never send**: Tokens (Bearer, cookies, invite tokens, `acceptUrl` query params), emails, phone numbers, VINs, customer names, SSN/DOB/income, or any field that could identify an end-user or vehicle.
- **Scrubbing**: Strip `Authorization`, `Cookie`, and any header that might contain secrets from Sentry payloads. Do not attach request body or query params by default; if needed for debugging, allow only non-PII fields (e.g. `platformDealershipId`, `dealerDealershipId`) and redact the rest.
- **Allowed in context**: `platformUserId` (UUID), `dealershipId` (UUID), `requestId`, route path, method, status code, `lifecycleStatus` (ACTIVE/SUSPENDED/CLOSED). Prefer hashing or internal IDs only; no email or name.

### Sentry scope (per request)

- **requestId**: Set as tag and/or extra context on every event in the request lifecycle.
- **Route + method + status**: Tag or extra so alerts and issues can filter by route/method/status.
- **Dealer**: Include `dealershipId` (when in tenant context) and `lifecycleStatus` (when available) as tags for tenant-level filtering.

---

## 3. Structured logs plan

### Format

- **Format**: JSON lines (one JSON object per line), suitable for Vercel Log Drain or other log aggregators.
- **Channel**: stdout/stderr; in Vercel, logs appear in project logs. Optional later: forward to external system (e.g. Datadog, Aiven, Logtail) via Vercel integration or drain.

### Required fields (every log line)

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO 8601) | When the log was emitted. |
| `level` | string | `error`, `warn`, `info`, `debug`. |
| `app` | string | `"dealer"` or `"platform"`. |
| `env` | string | `development`, `preview`, `production` (from NODE_ENV / VERCEL_ENV). |
| `requestId` | string \| null | Correlation id for the request (if any). |
| `route` | string \| null | API route path (e.g. `/api/platform/dealerships`). |
| `method` | string \| null | HTTP method. |
| `status` | number \| null | HTTP status code (when logging response). |
| `durationMs` | number \| null | Request duration in milliseconds (when available). |
| `platformUserId` | string \| null | Platform user id (platform only; UUID only). |
| `dealershipId` | string \| null | Dealership id (dealer only; UUID only). |
| `errorCode` | string \| null | Application error code (e.g. FORBIDDEN, VALIDATION_ERROR). |

Additional context (e.g. `message`, `jobId`, `queueType`) may be added as long as it adheres to redaction rules.

### Redaction rules

- **Never log**: `Authorization` header, full `Cookie` header, invite tokens, `acceptUrl` (or any token in query/body), request/response bodies that might contain email, phone, VIN, SSN, DOB, income, or customer names.
- **Allowed**: Internal IDs (UUIDs), route path, method, status codes, error codes, `requestId`, numeric counts, `lifecycleStatus`, queue type names (e.g. `sequence_step`).

### Where logs live

- **Primary**: Vercel project logs (automatic for serverless functions and Node runtime). No change to infra in Step 1.
- **Optional later**: Configure Vercel Log Drain or similar to forward JSON lines to a log backend; parsing can assume the above schema.

---

## 4. RequestId and correlation

### Generation

- **Per request**: If the request does not already carry a request id (e.g. `X-Request-Id` or `x-request-id`), generate one at the start of the request (e.g. `uuid` or `nanoid`). Use a single value for the entire request lifecycle (middleware or route wrapper).

### Propagation

- **Platform → Dealer**: When platform calls dealer internal API via `callDealerInternal` (or equivalent), send the current `requestId` in a header (e.g. `X-Request-Id`). Dealer internal routes should read this header and use it for logging and audit; if missing, dealer may generate its own for that request.
- **platformFetch / call-dealer-internal**: In Step 2, ensure every outbound call from platform to dealer includes `X-Request-Id` when available. Dealer internal routes (provision, status, owner-invite) should accept and store/pass through requestId for audit and logs.
- **Dealer internal routes**: Read `X-Request-Id` from incoming request; use for structured log lines and, when writing dealer audit (if any) for internal calls, include requestId in metadata or a dedicated field if the schema supports it.

### Where requestId must appear

| Location | Requirement |
|----------|-------------|
| Structured logs | Every log line for that request includes `requestId`. |
| Sentry events | Set on scope (tag or extra) so issues can be correlated. |
| Platform audit | Already stores `requestId` on `PlatformAuditLog`; keep as-is. |
| Dealer audit for internal calls | When dealer writes audit for internal API actions (e.g. provision, status), include requestId in the audit record if schema supports it; otherwise in metadata (redacted from PII). |

---

## 5. Alert hooks

### Sentry alerts (destination: Slack / email / webhook)

- **Spike in 5xx on platform routes**: Alert when the number of 5xx responses (or error events with status 5xx) in a short window (e.g. 5 minutes) exceeds a threshold (e.g. 10). Destination: Slack channel and/or email. Message must be generic (e.g. “High 5xx rate on platform”); **no PII**, no request bodies.
- **Dealer internal API auth failures**: Alert when count of events tagged `internal_api_auth_failure` (or equivalent) in a window exceeds a threshold (e.g. 5 in 5 minutes). Indicates possible misconfiguration or abuse. Destination: Slack/email. No tokens or headers in alert.
- **Job worker failure count**: Alert when the number of job failures or dead-letter events (from dealer) in a window exceeds a threshold (e.g. failed + deadLetter > 20 in 10 minutes per deployment). Destination: Slack/email. Message may include `dealershipId` counts or aggregate only; no job payload content.

### Where alerts go

- **Generic**: Slack webhook URL or Sentry “Integration” (Slack, email). Do not include PII in alert title or body.
- **Webhook**: Optional HTTP endpoint (e.g. PagerDuty, Opsgenie) receiving Sentry payload; payload must be scrubbed by Sentry (use server-side scrubbing so no PII is sent).

---

## 6. Health checks

### Existing behavior

- **Dealer**: `GET /api/health` exists. Returns `ok`, `app: "dealer"`, `version` (Vercel commit SHA), `time`, and `db` (ping result). On env validation failure or DB error, returns 503 with `ok: false` and optional `message` / `dbError`.
- **Platform**: `GET /api/health` exists. Same shape with `app: "platform"`.

### What health should include (spec)

- **Include**: `ok` (boolean), `app`, `version` (commit SHA or undefined), `time` (ISO), `db` (`"ok"` | `"error"` | `"skipped"`). Optionally `env` (e.g. production/preview) for debugging.
- **Exclude**: No secrets (no DSN, no API keys, no DB connection string). No PII. No stack traces in response. If env validation fails, list only **variable names** that are missing (e.g. `missingVars: ["DATABASE_URL"]`), not values.

### Readiness expectations

- **DB connectivity**: Health is “ready” when `db === "ok"` (i.e. `SELECT 1` succeeded). If `db === "error"` or env invalid, respond with 503 so load balancers or orchestrators can treat the instance as not ready.
- **No other dependencies in health**: Do not check Sentry, Resend, or external APIs in the health endpoint; keep it fast and DB-only for readiness.

---

## 7. Rollout plan

1. **Dev / staging**  
   - Enable Sentry: set `SENTRY_DSN` for dealer and platform (staging projects or same org).  
   - Verify: Trigger a test error (e.g. throw in a dev-only route or use Sentry “test” button). Confirm event appears with `requestId`, route, and no sensitive headers.  
   - Structured logging: Deploy middleware or wrapper that logs one JSON line per request with required fields; confirm in Vercel logs.

2. **Production**  
   - Enable with **conservative sampling**: Errors 100%; performance traces at low rate (e.g. 10%).  
   - Monitor volume and cost; then **increase** trace sampling if needed (e.g. 20–30%).  
   - Alerts: Configure Sentry alerts (5xx spike, internal auth failures, job failures) to Slack/email; test with controlled triggers.

3. **No change in Step 1**  
   - Do not add env vars or deploy Sentry SDK in this step; the above is the plan for Step 2.

---

## 8. Test plan

### Local

- **Errors captured**: Trigger an unhandled error in an API route; confirm (in Step 2) that Sentry receives the event when DSN is set.
- **No header leak**: Inspect Sentry event payload (or use Sentry “scrub” settings); confirm `Authorization`, `Cookie`, and body are not present or are redacted.
- **RequestId**: Confirm every Sentry event and structured log line for that request has the same `requestId`.

### Deployed-only

- **Controlled error**: Use a dedicated test route (e.g. `GET /api/test-error` that throws when `CRON_SECRET` or a feature flag is set) or temporarily throw in an existing route in a preview deployment. Trigger the request with a known `X-Request-Id`.
- **Confirm**: Sentry event appears with correct `requestId`, route, method, status; no PII in event. Structured log (if implemented) contains same `requestId`.

---

## 9. Implementation checklist (Step 2)

- [ ] **Sentry (both apps)**  
  - [ ] Add `@sentry/nextjs` (or server SDK); init with DSN from env; no-op when DSN unset.  
  - [ ] Separate Sentry projects (dealer, platform); set DSN per Vercel project.  
  - [ ] Scrub PII: strip Authorization, Cookie, body by default; allow only route, method, status, requestId, platformUserId/dealershipId.  
  - [ ] Attach requestId to scope; tag route, method, status; dealer: tag dealershipId, lifecycleStatus when available.  
  - [ ] Errors 100% sampling; performance traces low (e.g. 10%) in production.  
  - [ ] Optional: SENTRY_AUTH_TOKEN + release = VERCEL_GIT_COMMIT_SHA for source maps.

- [ ] **Structured logs (both apps)**  
  - [ ] Middleware or route wrapper: generate/read requestId; log one JSON line per request with required fields (timestamp, level, app, env, requestId, route, method, status, durationMs, platformUserId/dealershipId, errorCode).  
  - [ ] Redaction: never log Authorization, Cookie, tokens, PII; allow only internal IDs and codes.

- [ ] **RequestId propagation**  
  - [ ] Generate requestId per request if `X-Request-Id` missing.  
  - [ ] platformFetch / call-dealer-internal: send `X-Request-Id` on outbound requests.  
  - [ ] Dealer internal routes: read `X-Request-Id`; use in logs and audit (if schema supports).

- [ ] **Dealer job worker**  
  - [ ] Log worker run summary (processed, failed, deadLetter) with requestId/dealershipId; no PII.  
  - [ ] On failure/dead-letter: Sentry event or log with jobId, queueType, errorCode; no payload content.

- [ ] **Internal dealer API**  
  - [ ] Log auth failures (401) and rate limit hits (429); tag in Sentry (e.g. internal_api_auth_failure, internal_api_rate_limited).

- [ ] **Health**  
  - [ ] Confirm /api/health in both apps; response includes only ok, app, version, time, db; no secrets; 503 when db or env invalid.

- [ ] **Alerts**  
  - [ ] Sentry: alert on 5xx spike (platform), internal API auth failures (dealer), job failure count (dealer).  
  - [ ] Destinations: Slack and/or email; no PII in alert content.

- [ ] **Rollout**  
  - [ ] Enable in dev/staging; verify events and logs.  
  - [ ] Production: enable with conservative trace sampling; tune after review.

---

**Document**: `docs/runbooks/monitoring-spec.md`  
**Step**: 1 — Spec only; no code, no env vars, no infra changes.

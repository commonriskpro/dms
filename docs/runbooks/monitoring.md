# Monitoring — Sentry, structured logs, requestId, alerts

Setup and verification for error/performance monitoring and structured logging in **dealer** and **platform** apps.

---

## 1. Setup

### Sentry (separate project per app)

- **Dealer**: Create a Sentry project (e.g. `dms-dealer`). Set `SENTRY_DSN` in the Dealer Vercel project.
- **Platform**: Create a Sentry project (e.g. `dms-platform`). Set `SENTRY_DSN` in the Platform Vercel project.
- When `SENTRY_DSN` is unset, the SDK does not send events (no-op). Builds and tests do not require DSN.

### Env vars per Vercel project

| Variable | Dealer | Platform | Notes |
|----------|--------|----------|--------|
| `SENTRY_DSN` | Optional | Optional | When set, enables error + performance. Use each app’s own project DSN. |
| `SENTRY_AUTH_TOKEN` | Optional | Optional | For source map upload in CI; set in Vercel Build env only. |
| `SENTRY_ORG` | Optional | Optional | Sentry org slug (for CLI). |
| `SENTRY_PROJECT` | Optional | Optional | Sentry project slug (for CLI). |

See `docs/runbooks/env-reference.md` for full list.

### Redaction rules (no PII in Sentry or logs)

- **Never send or log**: `Authorization`, `Cookie`, `x-api-key`, `token`, `email`, `acceptUrl`, `vin`, `ssn`, `dob`, `income`, customer names, invite tokens.
- **Allowed**: Internal IDs (UUIDs): `requestId`, `platformUserId`, `dealershipId`; route path; method; status code; error codes; `lifecycleStatus`; queue type names.
- Sentry `beforeSend` and logger `redact()` strip or mask sensitive keys. Do not add request body or raw headers to logs/Sentry.

---

## 2. RequestId correlation

- **Header**: `x-request-id`. If the client sends it, the server keeps it; otherwise the server generates one (e.g. `crypto.randomUUID()`).
- **Response**: API routes that are instrumented set `x-request-id` on the response (e.g. `/api/health`, internal dealer routes).
- **Propagation**: Platform → dealer internal calls pass `x-request-id` in the request header (e.g. `callDealerProvision`, `callDealerStatus`, `callDealerOwnerInvite` with `options.requestId`).
- **Job worker**: Each run generates a new `requestId` and uses it in logs and Sentry scope (no client request).

---

## 3. Structured logs

- **Format**: JSON lines (one object per line) to stdout/stderr. Compatible with Vercel logs.
- **Fields**: `ts`, `level`, `app` (dealer | platform), `env`, `requestId`, `msg`, and optionally `route`, `method`, `status`, `durationMs`, `dealershipId` / `platformUserId`, `errorCode`, `errorName`.
- **Logger**: `apps/dealer/lib/logger.ts`, `apps/platform/lib/logger.ts`. All context is redacted before output.

---

## 4. Alert hooks (runbook only; no secrets in code)

Configure in **Sentry** (Alerts → Create alert):

| Alert | Condition | Recommended action |
|-------|------------|---------------------|
| **Error spike (platform)** | Count of errors in 5 min > 10 | Notify Slack/email. Message: “High error rate on platform.” No PII. |
| **5xx rate (platform)** | Transaction/error with status 5xx in 5 min > threshold | Same as above. |
| **Internal API auth failures (dealer)** | Events with tag `internal_api_auth_failure` in 5 min > 5 | Notify; possible misconfiguration or abuse. |
| **Job worker failures (dealer)** | Events with tag `job_worker_failure` in 10 min > 20 | Notify; check job queue and tenant status. |

**Destinations**: Use Sentry integrations (Slack, email, PagerDuty, etc.). Do **not** put Slack webhook URLs or API keys in the repo; configure them in Sentry or your CI/CD secrets.

**Naming**: e.g. `platform-5xx-spike`, `dealer-internal-api-auth-failures`, `dealer-job-worker-failures`. Keep thresholds conservative at first and tune after observation.

---

## 5. Deployed-only verification checklist

- [ ] **RequestId in response**: Call `GET /api/health` (dealer and platform). Response headers must include `x-request-id`. Optionally send `x-request-id: my-id` and confirm the same value is returned.
- [ ] **Structured logs**: Trigger any API request and check Vercel project logs (or log drain). Confirm at least one JSON line with `requestId`, `app`, `ts`, `level`, `msg`. Confirm no `Authorization`, `Cookie`, or token values in the log line.
- [ ] **Sentry event (no secrets)**: Trigger a controlled error (e.g. temporary `throw new Error("monitoring-test")` in a non-critical route in preview). In Sentry, open the event and confirm: tags include `app`, `requestId` (and `dealershipId` / `platformUserId` where applicable); request headers do **not** contain `Authorization` or `Cookie`; query string and body do not contain tokens or PII.
- [ ] **Alerts**: Create at least one alert in Sentry (e.g. error count > 5 in 5 min) and set destination to Slack or email. Resolve or mute after testing.

---

## 6. Local verification

- Run `npm run test` in `apps/dealer` and `apps/platform`. Redaction tests and health `x-request-id` tests must pass.
- With `SENTRY_DSN` unset, build and run both apps; no Sentry errors in console. With `SENTRY_DSN` set, trigger an error and confirm the event appears in Sentry with tags and without secrets.

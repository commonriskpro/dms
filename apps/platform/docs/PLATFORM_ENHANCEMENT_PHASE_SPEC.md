# Platform Enhancement Phase — Specification

This spec is grounded in the current DMS monorepo and defines the next enhancement set for the internal platform admin console (apps/platform). It extends the existing platform-admin foundation without replacing it.

---

## 1. Current State Audit

### 1.1 Platform users page

- **Location:** `/platform/users` (apps/platform).
- **API:** `GET /api/platform/users` returns `id`, `role`, `createdAt`, `updatedAt`, `disabledAt`. No email, display name, or last sign-in.
- **Source:** `listPlatformUsers()` in `lib/platform-users-service.ts` reads from `PlatformUser` only. Platform user `id` is the Supabase Auth user id (same as used for invite/login).
- **Display name/email:** Not exposed today. Supabase Auth holds email and `user_metadata` (e.g. `full_name`); platform DB does not duplicate them.
- **Last sign-in:** Not available today. Supabase Auth user object can include `last_sign_in_at` when fetched via Admin API.

### 1.2 Platform auth/session model

- **Auth:** Supabase session (cookies). `requirePlatformAuth()` ensures valid session and loads platform user from `PlatformUser` by `user.id`. Disabled platform users are blocked at auth time.
- **Roles:** `PLATFORM_OWNER`, `PLATFORM_COMPLIANCE`, `PLATFORM_SUPPORT`. Stored in `PlatformUser.role`.
- **No dealer/platform merge:** Platform uses its own DB and Supabase project; dealer app has separate auth and `PlatformAdmin` table for in-dealer platform features.

### 1.3 Supabase Auth Admin

- **Location:** `lib/supabase/admin.ts` — `createSupabaseAdminClient()` (service role).
- **Usage:** `lib/platform-invite-service.ts` uses `admin.auth.admin.listUsers` (paginated) and `inviteUserByEmail`. Supabase Auth Admin provides `getUserById(uid)` returning user with `email`, `user_metadata`, `last_sign_in_at`, etc.
- **Safety:** Server-side only; key never exposed to client.

### 1.4 Audit logging

- **Model:** `PlatformAuditLog` (actorPlatformUserId, action, targetType, targetId, beforeState, afterState, reason, requestId, createdAt).
- **Helper:** `platformAuditLog()` in `lib/audit.ts`. Actions already include `platform_user.*`, `platform.invite.*`, application/dealership lifecycle, etc.
- **API:** `GET /api/platform/audit` with filters (actor, action, targetType, targetId, dateFrom, dateTo) and pagination.

### 1.5 Monitoring

- **Page:** `/platform/monitoring` — health (platform + dealer), daily rate limits, daily job runs (fetch on mount).
- **Data sources:** Platform health, dealer health proxy (`GET /api/platform/monitoring/dealer-health`), rate-limit and job-run APIs if present. No dedicated “recent audit” or “invite/application events” widgets yet.
- **Platform DB:** `PlatformMonitoringEvent`, `PlatformAlertState` for dealer-health alerting.

### 1.6 Billing / plan data model

- **Schema:** `PlatformDealership` has `planKey`, `limits` (JSON). No `billing_status` or `internal_notes` in schema.
- **API:** `GET /api/platform/billing` lists dealerships with planKey, limits, status (display only). No PATCH or update endpoints.
- **No Stripe or external billing** in repo.

### 1.7 Dealership detail

- **Location:** `/platform/dealerships/[id]`. Has Invites section, Plan section (planKey, limits), Activity link to audit filtered by dealership.
- **No “Open as dealer” / impersonation** from platform app today. Dealer app has its own impersonation for users logged into dealer as `PlatformAdmin` (cookie-based, same app).

### 1.8 Impersonation / support-session foundations

- **Dealer app (apps/dealer):** `POST /api/platform/impersonate` (body: `{ dealershipId }`) sets `active-dealership` cookie; requires user logged into dealer app with `PlatformAdmin` row. Used when platform admin is already in the dealer app.
- **Platform app (apps/platform):** No impersonation or support-session flow. Platform staff use a separate app (platform console); they do not have dealer app sessions. To “open as dealer” from platform, we need a **support session** flow: platform issues a short-lived token, dealer app consumes it and establishes a distinct support-session context (no dealer user login).
- **Mapping:** Platform has `DealershipMapping` (platformDealershipId ↔ dealerDealershipId). Platform can resolve dealer dealership id for a given platform dealership.
- **Shared secret:** `INTERNAL_API_JWT_SECRET` is shared between platform and dealer for internal API JWTs (e.g. provisioning). Can be reused to sign/verify support-session tokens.

---

## 2. Scope

This sprint covers **only**:

- **A.** Platform user list enrichment (display name, email, last sign-in when safe).
- **B.** Last sign-in display (when available from Supabase Admin; no faking).
- **C.** Deeper monitoring UX using existing data (audit, invite/application events, etc.).
- **D.** Billing/business tooling beyond scaffold (internal plan/limits management; no new payment provider).
- **E.** Impersonate dealer / support session: platform staff can start an auditable, short-lived support session and use the dealer app in a controlled way with a clear banner.

No unrelated refactors, no merging of dealer and platform roles, no new external billing providers.

---

## 3. Platform User Enrichment Plan

### 3.1 Goal

Enrich `/platform/users` (and API) with:

- Display email (canonical from Supabase).
- Display name (from Supabase `user_metadata`, e.g. `full_name`), optional.
- Last sign-in (from Supabase `last_sign_in_at`) when safely available.

### 3.2 Design

- **Display-only:** Enrichment is for UI only. Platform DB remains source of truth for role/status; no writing of email/name/lastSignIn into platform DB.
- **Source:** For each platform user id, call Supabase Admin `getUserById(id)` (or batch if API supports). Map response to `email`, `user_metadata?.full_name`, `last_sign_in_at`.
- **Fallback:** If Admin lookup fails for a user (e.g. user deleted in Auth, network, or rate limit), return that user with enrichment fields as `null`/omitted; do not fail the whole list. One bad lookup must not break the page.
- **N+1:** Prefer batching if available (e.g. listUsers with filter by ids); otherwise sequential or small parallel batches with a sensible limit (e.g. 10 concurrent) to avoid thundering herd. Document that enrichment is best-effort and may be slower for large lists.
- **RBAC:** No change; existing platform role checks apply. Enriched data is only returned to roles that can already list users.

### 3.3 API shape

- Extend list response items with optional: `email?: string | null`, `displayName?: string | null`, `lastSignInAt?: string | null` (ISO date).
- Keep `id`, `role`, `createdAt`, `updatedAt`, `disabledAt` as today. If enrichment fails for a row, omit or null the extra fields; do not remove the row.

### 3.4 Graceful degradation

- If `createSupabaseAdminClient()` fails (e.g. missing key), skip enrichment and return list with no enrichment fields (or all null). Do not fail the request.
- Do not expose raw Supabase errors or internals to the client; log server-side only.

---

## 4. Monitoring Plan

### 4.1 Goal

Make `/platform/monitoring` more useful for ops using **existing** data sources only. No invented telemetry.

### 4.2 Data sources (existing)

- **PlatformAuditLog:** Recent platform actions (user, invite, application, dealership, etc.).
- **PlatformInviteLog:** Invite send events (recipientHash, sentAt).
- **PlatformEmailLog:** Owner invite emails (platformDealershipId, type, recipientHash, sentAt).
- **Application status changes:** Already audited (e.g. application approved/rejected) and/or in audit log.
- **Platform user changes:** Disabled/enabled, role changes — already in PlatformAuditLog.
- **Rate-limit / job-run data:** Already used on current monitoring page (daily rate limits, daily job runs) if provided by dealer or platform APIs.

### 4.3 Proposed monitoring sections

1. **Recent platform audit events** — Last N audit entries (e.g. 50) with type/actor/date; link to full audit with pre-filled filters.
2. **Invite / email signals** — Recent platform invite sends (from PlatformInviteLog / PlatformEmailLog if queryable); anomalies only if we have a clear definition (e.g. same hash many times in 1h).
3. **Application events** — Recent approvals/rejections (from audit or application table); simple table.
4. **Platform user access changes** — Recent disabled/enabled/role_changed from audit.
5. **Abuse / rate-limit** — Keep or enhance existing rate-limit and job-run widgets if already present; no new telemetry.
6. **Filters** — Optional filters by event type, date range, dealership (target) only if already supported by existing APIs and UI patterns.

Implementation must use only existing tables and APIs; no new event pipelines or schemas for this sprint.

---

## 5. Billing / Business Tooling Plan

### 5.1 Goal

Extend billing from scaffold to **internal** plan and limits management. No Stripe, no customer-facing invoices.

### 5.2 Current state

- `PlatformDealership`: `planKey`, `limits` (JSON), `status`. GET billing lists these.
- No PATCH or update today.

### 5.3 Safe next steps

- **Dealership plan update:** Allow authorized platform roles to update a dealership’s `planKey` and/or `limits` (e.g. seat limit, inventory limit as keys in `limits`). Validate `planKey` against a fixed allowlist (e.g. from env or constant). Validate `limits` shape (e.g. max keys, numeric values only).
- **Internal notes/status:** Only if we add a minimal schema field (e.g. `billingNotes` or `internalStatus` on PlatformDealership). Prefer minimal schema change; if not in scope, skip and keep billing as plan/limits only.
- **APIs:** `PATCH /api/platform/dealerships/[id]` or dedicated `PATCH /api/platform/billing/dealerships/[id]` to update plan/limits for a platform dealership. Idempotent; audit `dealership.plan_updated` or `billing.plan_updated`.
- **RBAC:** PLATFORM_OWNER (and optionally PLATFORM_COMPLIANCE) only for updates.

No fake subscriptions, no external payment provider integration.

---

## 6. Impersonation / Support Session Plan

### 6.1 Goal

Platform staff (in apps/platform) can start a **support session** to view/use the dealer app as a specific dealership, with:

- Explicit dealership selection (platform dealership).
- Short-lived, auditable, revocable session.
- Visible banner in dealer app and clear “End support session” action.
- No permanent account linking; no merge of dealer and platform RBAC.

### 6.2 Architecture choice

**Option chosen: Signed short-lived support-session token exchanged in dealer app.**

- Platform (apps/platform) does **not** log the staff into the dealer app as a user. Platform and dealer use separate auth (platform_users vs dealer Profile/PlatformAdmin).
- Flow:
  1. Platform staff clicks “Open as dealer” / “Start support session” for a platform dealership.
  2. Platform backend: resolve `dealerDealershipId` via `DealershipMapping`; create a signed JWT with `purpose: "support_session"`, `dealershipId: dealerDealershipId`, `platformUserId`, `exp` (e.g. 2 hours), `iat`, `iss: "platform"`. Sign with `INTERNAL_API_JWT_SECRET`. Audit `impersonation.started` (targetDealershipId, platformUserId).
  3. Platform responds with redirect URL: `{DEALER_PUBLIC_URL}/support-session?token=<JWT>` (or return URL in JSON for client to open in new tab). Use `DEALER_INTERNAL_API_URL` or a dedicated `NEXT_PUBLIC_DEALER_APP_URL` if different from internal.
  4. Dealer app: route `GET /support-session?token=...` (or `/api/support-session/consume` then redirect). Verify JWT with `INTERNAL_API_JWT_SECRET`, check `purpose === "support_session"` and `exp`. Optionally verify dealership exists and is not closed. Set a **support-session cookie** (httpOnly, secure, sameSite strict) containing encrypted payload: `{ dealershipId, platformUserId, expiresAt }`. Redirect to dealer app home or dashboard.
  5. Dealer app auth/tenant layer: when resolving context, if support-session cookie is present and valid (not expired), return context with `isSupportSession: true`, `dealershipId`, `platformActorId`. Do **not** require a real user session; support session is a distinct path. Tenant API routes accept this context and allow read (and optionally limited write as per policy).
  6. Dealer layout: if `isSupportSession`, show a prominent banner: “Support session — [Dealership name] — Started by platform. End support session.” with button that calls dealer `POST /api/support-session/end` (clears cookie, redirects to platform or dealer login). Audit on dealer side optional; platform already audited start.
  7. Ending: “End support session” clears the support-session cookie and redirects. Platform can expose `POST /api/platform/impersonation/end` for consistency (e.g. revoke token server-side if we add a revocation list later); for MVP, ending is client-side cookie clear + redirect.

### 6.3 Token payload (JWT)

- `purpose`: `"support_session"`.
- `dealershipId`: dealer’s `Dealership.id` (so dealer does not need to look up by platform id).
- `platformUserId`: platform user id (for audit and banner).
- `exp`: short-lived (e.g. 2 hours).
- `iat`, `iss`: standard claims. `iss`: `"platform"` or platform app URL.

No PII in token; only IDs.

### 6.4 RBAC for starting support session

- **Strict:** Only `PLATFORM_OWNER` (and optionally `PLATFORM_COMPLIANCE` if product agrees). Spec defaults to **PLATFORM_OWNER only** unless repo already has a safer pattern for COMPLIANCE.
- Require platform auth and role check before issuing token. Audit every start (and end on platform if we add server-side end).

### 6.5 Safety requirements

- Session is short-lived (e.g. 2h); expiry enforced on verification.
- No permanent link between platform user and dealer account.
- Dealer app never treats support session as a normal dealer user; context is explicitly `isSupportSession: true`.
- Banner is always visible when support session is active; “End support session” is one-click.
- Expired or invalid token: dealer returns 401/403 and does not set cookie; no fallback to normal auth.
- All start (and optionally end) actions audited on platform with non-PII metadata (targetDealershipId, platformUserId).

### 6.6 Direct URLs

- Once in support session, direct URLs (e.g. `/customers`, `/inventory`) work with the same support-session context (cookie sent with requests). No special handling beyond context resolution and banner.

### 6.7 Failure behavior

- Platform: if mapping missing (no dealer dealership for platform dealership), return 400/404 and do not issue token. If audit write fails, log and still return token (do not block ops).
- Dealer: if token missing/invalid/expired, return 401 and clear any stale support-session cookie. If dealership not found or closed, return 403 and do not set cookie.

---

## 7. Security Plan

- **Platform-only access:** All new/updated platform routes continue to use `requirePlatformAuth()` and role checks. No dealer user can call platform impersonation or billing update APIs.
- **Audit:** Every impersonation start (and end if implemented server-side), billing/plan update, and any sensitive monitoring access use existing `platformAuditLog` with non-PII metadata.
- **Last-owner protection:** Unchanged; platform user disable/demote logic remains.
- **No privilege escalation:** Support session does not grant dealer roles; it only sets dealership context for viewing/support. Impersonation RBAC is platform-side only (PLATFORM_OWNER).
- **Impersonation expiry and revocation:** Token has `exp`; dealer rejects expired tokens. Optional: platform stores issued token ids and supports revoke; MVP can be cookie-clear only on end.
- **No raw secret leakage:** INTERNAL_API_JWT_SECRET never in responses or logs. Tokens in URLs are one-time use (consumed once); consider short-lived one-time tokens if needed.
- **Support session banner:** Always shown when support session is active; clear “End support session” and no confusion with normal dealer auth.
- **Validation and response hygiene:** Zod for all new/updated request bodies and query params. Sanitized error messages; no stack traces or internal details in API responses.

---

## 8. Acceptance Criteria

### A. Platform user enrichment

- [ ] GET /api/platform/users returns optional `email`, `displayName`, `lastSignInAt` per user when Supabase Admin data is available.
- [ ] If Admin lookup fails for one user, that user still appears with enrichment null/omitted; list does not fail.
- [ ] /platform/users UI shows email, name (or placeholder), last sign-in when available, and graceful placeholders when not.

### B. Last sign-in

- [ ] When Supabase provides `last_sign_in_at`, it is exposed as `lastSignInAt` (ISO) in the users API and shown on the users page.
- [ ] When not available, no fake value; fallback is null/omitted and UI shows “—” or “Not available”.

### C. Monitoring

- [ ] /platform/monitoring includes at least: recent platform audit events, and (if data exists) invite/application/platform-user event summaries.
- [ ] Filters (e.g. by event type or date) only if already supported by existing APIs and patterns.
- [ ] No new telemetry pipelines or schemas; only existing data sources.

### D. Billing / business tooling

- [ ] Authorized platform roles can update a dealership’s plan/limits via a defined API (PATCH).
- [ ] Updates are audited and validated (planKey allowlist, limits shape).
- [ ] /platform/billing (and/or dealership detail) allows viewing and updating plan/limits for internal ops use.

### E. Impersonation / support session

- [ ] Platform staff with PLATFORM_OWNER can start a support session for a chosen platform dealership (button/link from dealership detail or list).
- [ ] Starting issues a short-lived JWT and redirects (or returns URL) to dealer app support-session consume route.
- [ ] Dealer app consumes token, sets support-session cookie, and resolves context as support session (no dealer user login).
- [ ] Dealer app shows a prominent banner when support session is active (dealership name, “End support session”).
- [ ] “End support session” clears the session and redirects appropriately.
- [ ] Every start (and end if server-side) is audited on platform; no PII in audit metadata.
- [ ] Expired or invalid token is rejected by dealer; no cookie set.

---

## Summary

| Area              | Approach                                                                 |
|-------------------|--------------------------------------------------------------------------|
| User enrichment   | Supabase Admin getUserById per id; optional email, displayName, lastSignInAt; per-user fallback. |
| Monitoring        | Add sections from PlatformAuditLog, invite/application/user events; no new telemetry. |
| Billing           | PATCH plan/limits for platform dealerships; audit; internal tooling only. |
| Support session   | JWT signed with INTERNAL_API_JWT_SECRET; dealer consume route sets cookie; banner + end action; PLATFORM_OWNER only; full audit. |

Files to create/update will be identified in implementation steps (Backend, Frontend, Security/QA, Performance).

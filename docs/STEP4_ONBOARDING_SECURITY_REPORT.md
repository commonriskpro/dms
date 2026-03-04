# Step 4 — Onboarding Flow Security & QA Report

**Scope:** Cross-app onboarding flow (Platform + Dealer). No new product features; vulnerabilities, abuse cases, leakage, and missing guards addressed.

---

## 1) Token & PII Leakage Audit

### Findings and fixes

| Area | Finding | Fix / Status |
|------|---------|--------------|
| **Invite token** | Token not logged in resolve/accept routes; service layer does not log token. | **OK** — No token in logs. |
| **Contact email** | Platform onboarding-status returns only `contactEmailMasked` and `contactEmailHash`; UI panel receives server-stripped payload (no email to client). | **OK** — Server strips before passing to client. |
| **Auth headers** | No Authorization or Cookie values logged in scoped routes. | **OK** — Handlers use headers only for auth; no logging of header values. |
| **Idempotency keys** | Provision: `app-provision-${applicationId}`. Invite-owner: `app-invite-owner-${applicationId}-${hashEmail(contactEmail)}`. | **OK** — No raw email; hash only. |
| **PlatformAuditLog** | Audit entries use `targetId`, `afterState` (dealershipId, inviteId, requestId, jti). No token or email in state. | **OK** — No PII in audit state. |
| **PlatformEmailLog** | Stores `recipientHash` only (OWNER_INVITE). | **OK** — No raw email. |
| **Dealer audit** | platform.invite.created / accept metadata: inviteId, dealershipId, roleId; no token. | **OK** — No token/email in metadata. |
| **Onboarding-status cache** | Key: `ownerInviteStatus:${dealerDealershipId}:${contactEmailHash}`. Value: status + timestamps only. | **OK** — Cache never stores email or token. |

**Redaction:** Existing masking/hashing used; no new redact utilities added. Logs use booleans and id tails where applicable.

---

## 2) Zod Validation at the Edge

### Implemented / verified

| Endpoint | Params | Query | Body | Status |
|----------|--------|-------|------|--------|
| **GET /api/platform/applications/[id]/onboarding-status** | `id`: UUID (paramsSchema.safeParse) | — | — | **Fixed** — Already had Zod; added rate limit. |
| **POST /api/platform/applications/[id]/provision** | `id`: UUID | — | — | **Fixed** — Added paramsSchema; 422 on invalid. |
| **POST /api/platform/applications/[id]/invite-owner** | `id`: UUID | — | — | **Fixed** — Added paramsSchema; 422 on invalid. |
| **GET /api/invite/resolve** | — | `token`: string 1–256 | — | **Fixed** — resolveInviteQuerySchema; ZodError → 422 via toErrorPayload. |
| **POST /api/invite/accept** | — | — | token (1–256), signup: email, password, etc. | **OK** — acceptInviteBodySchema / acceptInviteSignupBodySchema; Zod → 422. |
| **GET /api/auth/onboarding-status** | — | — | — | **OK** — No params/body. |
| **GET /api/auth/dealerships** | — | — | — | **OK** — No params/body. |
| **PATCH /api/auth/session/switch** | — | — | dealershipId: UUID | **OK** — bodySchema.parse. |
| **POST /api/internal/provision/dealership** | — | — | provisionDealershipRequestSchema (@dms/contracts) | **OK** — Zod + Idempotency-Key. |
| **GET /api/internal/dealerships/[id]/owner-invite-status** | dealerDealershipId: UUID | email: required, max 320 | — | **OK** — paramsSchema + query check. |
| **POST /api/internal/dealerships/[id]/owner-invite** | dealerDealershipId: UUID | — | (internal) | **OK** — Params Zod; body from contracts. |

**Dealer global:** `toErrorPayload` now maps `ZodError` to status **422** and `VALIDATION_ERROR` so all Zod parse failures at the edge return 422 consistently.

---

## 3) Auth & RBAC Order

| Route | Order verified |
|-------|----------------|
| **Platform** | requirePlatformAuth → requirePlatformRole → (rate limit) → params validation → DB/business logic. |
| **Dealer public** | Rate limit (where applied) → requireUser / getCurrentUser → body/query parse → business logic. |
| **Dealer internal** | Rate limit → verifyInternalApiJwt → params/body validation → DB. |

No business logic or DB reads before auth/RBAC.

---

## 4) Invite Token Security

| Check | Status |
|-------|--------|
| Token storage | Stored in DB (DealershipInvite.token); 32-byte random hex. Not logged. |
| Constant-time compare | Lookup by unique token (Prisma findUnique); application code does not compare raw token strings. |
| One-time use | ACCEPTED invite → status update; resolve/accept return 410 INVITE_ALREADY_ACCEPTED. |
| Expiry | ExpiresAt and status EXPIRED/CANCELLED enforced; 410 INVITE_EXPIRED. |
| Rate limit | resolve: invite_resolve (60/min). accept: invite_accept (10/min) + per-token (5/15min, hashed key). |

---

## 5) Session Switch Isolation

| Check | Status |
|-------|--------|
| Membership required | PATCH body dealershipId; membership findFirst(userId, dealershipId, disabledAt: null). No membership → ApiError FORBIDDEN. |
| No cross-tenant | Switch only sets cookie for dealerships where user has membership; no new membership created by switch. |
| Safe errors | 403 "Not a member of this dealership"; no leak of whether dealership exists outside membership. |

Accept-invite creates membership for invite.dealershipId only; membership.dealershipId always matches invite.

---

## 6) Internal API JWT Hygiene

| Check | Status |
|-------|--------|
| Issuer/audience/exp | verifyInternalApiJwt uses INTERNAL_API_ISS, INTERNAL_API_AUD, jose jwtVerify with clockTolerance. |
| Reject missing/invalid | 401 UNAUTHORIZED for missing Bearer, invalid or expired token, missing jti. |
| Replay (JTI) | JTI stored in InternalApiJti; reuse of same jti within TTL → 401 "Replayed token". |

---

## 7) Rate Limiting (Phase C)

| Endpoint | Limit | Implementation |
|----------|--------|----------------|
| **Dealer** | | |
| GET /api/invite/resolve | 60/min per client | checkRateLimit(clientId, "invite_resolve") |
| POST /api/invite/accept | 10/min per client + 5/15min per token (hashed) | checkRateLimit + checkRateLimitInviteAcceptPerToken |
| PATCH /api/auth/session/switch | 30/min per client | checkRateLimit(clientId, "session_switch") |
| **Platform** | | |
| GET onboarding-status | 120/min per client | checkPlatformRateLimit(clientId, "onboarding_status") |
| POST provision | 20/min per client | checkPlatformRateLimit(clientId, "provision") |
| POST invite-owner | 20/min per client | checkPlatformRateLimit(clientId, "invite_owner") |
| **Dealer internal** | Existing | checkInternalRateLimit on provision, owner-invite, owner-invite-status |

---

## 8) Error Envelope Consistency

- **401/403/404/410/422/429:** All return JSON `{ error: { code, message, details? } }`.
- Internal error details not leaked; 500 returns generic "Internal server error".
- requestId: Dealer internal routes use addRequestIdToResponse; public dealer/platform can be extended later.

---

## 9) Files Touched (Security / Rate Limit / Validation)

- **Dealer:** `lib/api/errors.ts` (ZodError → 422), `app/api/platform/schemas.ts` (invite token 1–256, shared schema).
- **Platform:** `lib/rate-limit.ts` (new), `app/api/platform/applications/[id]/onboarding-status/route.ts` (rate limit), `app/api/platform/applications/[id]/provision/route.ts` (Zod params + rate limit), `app/api/platform/applications/[id]/invite-owner/route.ts` (Zod params + rate limit).

No backend business logic or new APIs added; only validation, rate limits, and error mapping.

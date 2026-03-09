# Step 2 — Auth & Identity Expansion V1 Backend Report

**Source of truth:** `apps/dealer/docs/AUTH_IDENTITY_EXPANSION_V1_SPEC.md`  
**Scope:** Backend only (no frontend pages/forms beyond minimal wiring).  
**Date:** Step 2 implementation complete.

---

## 1. Implemented slices

### Slice A — Dealer password reset backend
- **POST /api/auth/forgot-password** — Body `{ email }`. Zod validation. Rate limited per IP (20/min) and per email bucket (5/min, hashed). Calls Supabase `resetPasswordForEmail` with redirect from `getPasswordResetRedirectUrl()`. Always returns generic success message. Audit: `auth.password_reset_requested` (no PII in metadata).
- **POST /api/auth/reset-password** — Body `{ password, confirmPassword }`. Requires valid Supabase session (recovery session from reset link). Uses existing `validatePasswordPolicy` (12 chars, 3/4 categories). Supabase `updateUser({ password })`. Generic error for invalid/expired link. Audit: `auth.password_reset_completed`.
- **Helpers:** `lib/auth-password-reset.ts` — `getPasswordResetRedirectUrl()`, `RESET_PASSWORD_INVALID_CONTEXT_MESSAGE`.
- **Rate limit:** New types `password_reset_request`, plus `getPasswordResetEmailRateLimitKey`, `checkRateLimitPasswordResetByEmail`, `incrementRateLimitPasswordResetByEmail` in `lib/api/rate-limit.ts`.

### Slice B — Dealer email verification backend
- **POST /api/auth/verify-email/resend** — Auth required. Rate limited per IP (10/min) and per user (3/min). Supabase `auth.resend({ type: "signup", email })`. Audit: `auth.email_verification_resent`.
- **GET /api/auth/callback** — Handles `?code=` for email verification / magic link. Exchanges code for session, audits `auth.email_verified` on success, redirects to `next` or `/`. Safe redirect path (no open redirect).
- **Session shape:** No change to GET /api/auth/session response; email verification state can be added in Step 3 from Supabase user if needed.

### Slice C — Dealer sessions list + revoke backend
- **Decision:** Supabase does not expose server-side “list all user sessions”; only the current session is available. Implemented deterministic, safe behavior: list returns a single-item array (current session only) with opaque id (hash of access token), `current: true`, `createdAt`/`lastActiveAt`.
- **GET /api/auth/sessions** — Auth required. Returns `{ sessions: [SessionItem] }` with one element (current session). Id from `sessionIdFromAccessToken(access_token)`.
- **POST /api/auth/sessions/revoke** — Auth required. Body `{ sessionId?: string, revokeAllOthers?: boolean }`. Rate limited (30/min per user). `revokeAllOthers: true` → Supabase `signOut({ scope: "others" })`, audit `auth.sessions_revoked_all_others`. `sessionId` matching current → `signOut()`, audit `auth.session_revoked`. Cannot revoke another session by id (Supabase limitation); returns 403 for non-current sessionId.
- **Helper:** `lib/sessions.ts` — `sessionIdFromAccessToken()`, `SessionItem` type.

### Slice D — Platform parity (password reset / verification / sessions)
- **POST /api/platform/auth/forgot-password** — Same contract as dealer; platform Supabase; audit via `platformAuditLog` with `actorPlatformUserId: SYSTEM_ACTOR_ID` for unauthenticated request.
- **POST /api/platform/auth/reset-password** — Same contract; inline password policy (12 chars, 3 categories); audit `auth.password_reset_completed`.
- **POST /api/platform/auth/verify-email/resend** — Auth required (`requirePlatformAuth`); rate limited; Supabase resend; audit `auth.email_verification_resent`.
- **GET /api/platform/auth/callback** — Extended to audit `auth.email_verified` on successful code exchange (in addition to existing magic-link behavior).
- **GET /api/platform/auth/sessions** — Auth required; returns current session only (same pattern as dealer).
- **POST /api/platform/auth/sessions/revoke** — Same contract as dealer; platform audit.
- **Platform libs:** `lib/auth-password-reset.ts`, `lib/sessions.ts`, `lib/rate-limit.ts` (existing types `invite_owner`, `onboarding_status`, `provision` preserved; new auth types added).

### Slice E — Impersonation hardening
- **POST /api/support-session/end** — Before clearing the cookie, reads and decrypts support-session cookie; if valid and not expired, writes audit `impersonation.ended` with `dealershipId`, `metadata: { platformUserId }` (no PII). Then clears cookie. Idempotent: always 200.

### Slice F — MFA backend
- **Status: Deferred.** Supabase Auth JS (`@supabase/auth-js`) includes MFA types and APIs (e.g. enroll, challenge, factor). No MFA routes were added in this pass. Recommendation: confirm MFA is enabled and usable in both dealer and platform Supabase projects, then implement `/api/auth/mfa/enroll`, `verify`, `challenge`, `disable` (and platform equivalents) in a follow-up with tests and recovery-code handling as per spec.

---

## 2. Notable architecture decisions

- **Password reset redirect URL:** Built from `NEXT_PUBLIC_APP_URL` or `VERCEL_URL`; dealer and platform use their own env (no cross-app coupling).
- **Recovery context for reset:** No explicit “recovery” session type check; any valid Supabase session is accepted for POST /api/auth/reset-password. Security relies on the reset link being the only way users typically obtain that session; alternative would require Supabase to expose session type (e.g. recovery) in the API.
- **Sessions:** No app-level session table. List is current-session only; revoke supports “revoke all others” and “revoke current” only. No fake multi-session list.
- **Audit for unauthenticated actions:** Dealer uses `dealershipId: null`, `actorUserId: null` for forgot-password. Platform uses a sentinel `SYSTEM_ACTOR_ID` UUID for `actorPlatformUserId` so platform audit log schema is satisfied.
- **Platform rate limit:** Existing `lib/rate-limit.ts` was extended with new auth types; existing types `invite_owner`, `onboarding_status`, `provision` were re-added so existing routes keep working.

---

## 3. Session implementation strategy

- **Chosen:** No DB table. GET /api/auth/sessions returns a single-item array for the current session only. Opaque session id is a hash of the access token (no token leakage). Revoke uses Supabase `signOut()` and `signOut({ scope: "others" })`.
- **Reason:** Supabase does not expose a “list all sessions for user” API to the client or used server APIs; building an app-level session table would require tracking every login/refresh and would duplicate Supabase’s session lifecycle. Current-session-only list plus “revoke all others” is safe and deterministic.

---

## 4. MFA implementation status

- **Status:** Not implemented. Blocked on confirmation that MFA (TOTP) is enabled and usable in both Supabase projects. @supabase/auth-js includes MFA types and methods; implementation can follow in a later step with enroll/verify/challenge/disable routes and recovery-code handling per spec.

---

## 5. Route inventory added/updated

### Dealer (apps/dealer)
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/forgot-password | Request password reset email |
| POST | /api/auth/reset-password | Set new password (recovery session) |
| POST | /api/auth/verify-email/resend | Resend verification email |
| GET | /api/auth/callback | Exchange code for session, audit email_verified |
| GET | /api/auth/sessions | List current session only |
| POST | /api/auth/sessions/revoke | Revoke current or all other sessions |
| POST | /api/support-session/end | Clear support-session cookie, audit impersonation.ended |

### Platform (apps/platform)
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/platform/auth/forgot-password | Request password reset email |
| POST | /api/platform/auth/reset-password | Set new password (recovery session) |
| POST | /api/platform/auth/verify-email/resend | Resend verification email |
| GET | /api/platform/auth/callback | Extended: audit email_verified on code exchange |
| GET | /api/platform/auth/sessions | List current session only |
| POST | /api/platform/auth/sessions/revoke | Revoke current or all other sessions |

---

## 6. Tests added

### Dealer
- `app/api/auth/forgot-password/route.test.ts` — Generic success, rate limit (IP and email), validation, audit, no enumeration.
- `app/api/auth/reset-password/route.test.ts` — Valid reset, no session, updateUser error, password policy, confirm mismatch, invalid JSON.
- `app/api/auth/verify-email/resend/route.test.ts` — 200 + audit, 401, 429, resend args.
- `app/api/auth/callback/route.test.ts` — No code → redirect to login, exchange failure, success + audit, next path.
- `app/api/auth/sessions/route.test.ts` — 401 unauthenticated, 200 with single session, 401 when no session.
- `app/api/auth/sessions/revoke/route.test.ts` — 401, revoke all others + audit, revoke current by sessionId, 403 for other sessionId, 429 rate limit, 400 when neither sessionId nor revokeAllOthers.
- `app/api/support-session/end/route.test.ts` — 200 and clear cookie, audit when valid session, no audit when expired.

### Platform
- No new test files added in this pass. Platform auth routes follow the same patterns; recommend adding mirror tests in Step 4 or when touching platform auth.

---

## 7. Known limitations / follow-ups for Step 3 and Step 4

- **Step 3 (frontend):** Forgot-password and reset-password pages (dealer and platform); “Forgot password?” link on login; verify-email resend button and unverified-email banner; session list and “Revoke all others” UI; support-session banner unchanged (already present).
- **Step 4 (hardening):** Platform auth route tests; abuse review for rate limits; optional session table if Supabase adds list API later; MFA backend + frontend when Supabase MFA is confirmed; recovery codes for MFA; audit assertions in E2E.

---

## 8. Files added/updated (concise)

### Dealer
- **Added:** `lib/auth-password-reset.ts`, `lib/sessions.ts`, `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`, `app/api/auth/verify-email/resend/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/sessions/route.ts`, `app/api/auth/sessions/revoke/route.ts`, `app/api/support-session/end/route.test.ts`, and corresponding `*.test.ts` for auth routes.
- **Updated:** `lib/api/rate-limit.ts` (new rate limit types and per-email helpers), `app/api/support-session/end/route.ts` (audit impersonation.ended).

### Platform
- **Added:** `lib/auth-password-reset.ts`, `lib/sessions.ts`, `app/api/platform/auth/forgot-password/route.ts`, `app/api/platform/auth/reset-password/route.ts`, `app/api/platform/auth/verify-email/resend/route.ts`, `app/api/platform/auth/sessions/route.ts`, `app/api/platform/auth/sessions/revoke/route.ts`.
- **Updated:** `lib/rate-limit.ts` (new auth types; kept invite_owner, onboarding_status, provision), `app/api/platform/auth/callback/route.ts` (audit email_verified).

### Docs
- **Added:** `apps/dealer/docs/STEP2_AUTH_IDENTITY_EXPANSION_BACKEND_REPORT.md` (this file).

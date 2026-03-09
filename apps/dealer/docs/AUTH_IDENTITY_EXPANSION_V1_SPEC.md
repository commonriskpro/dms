# Auth & Identity Expansion V1 — Specification

**Step 1: Spec only.** No implementation. This document defines the complete specification for five auth-related features in the DMS monorepo, following server-first, tenant isolation, RBAC, and auditability standards.

**Repo:** DMS monorepo (apps/dealer, apps/platform, shared packages)  
**References:** `agent_spec.md`, `docs/SECURITY.md`, `docs/specs/invite-signup-flow-spec.md`, `docs/runbooks/step-next-platform-operational.md`, `apps/mobile/docs/MOBILE_AUTH_ACCOUNT_FLOWS_SPEC.md`, `.cursorrules` (AppShell, ModalShell, noStore, token styling).

---

## 1. Executive Summary

### Why this expansion matters

- **Security:** Password reset, email verification, MFA, and session management reduce account takeover risk and improve compliance posture. Admin impersonation must remain auditable and bounded.
- **UX:** Users expect self-service password reset, clear “verify your email” flows, optional 2FA, and visibility/control over sessions. Unverified-email and session-revocation UX reduce confusion and support load.
- **Operations:** Session list and revoke allow users and admins to terminate suspicious sessions. Impersonation already exists (support-session + in-dealer platform impersonate); this spec extends clarity and safety rather than introducing net-new high-risk surface.

### Goals

| Goal type | Objectives |
|-----------|------------|
| Security | Rate-limited auth endpoints; generic error messages (no email enumeration); audit for password reset, verification, MFA, impersonation, session revoke; tenant isolation and RBAC unchanged. |
| UX | Dedicated pages for forgot-password, reset-password, verify-email, MFA enroll/challenge, session list; banners for impersonation and unverified email; confirmation dialogs for destructive actions. |
| Operational | Clear rollout order (password reset + email verification + sessions first; impersonation hardening + MFA second); Jest-first coverage for auth and RBAC. |

---

## 2. Current-State Assessment

### 2.1 Auth architecture summary

| App | Identity | Session | Notes |
|-----|----------|---------|--------|
| **Dealer (apps/dealer)** | Supabase Auth (dealer Supabase project). Profile id = Supabase user id. | Cookie (Supabase session) + encrypted `dms_active_dealership` cookie. Bearer token supported for mobile. | `getCurrentUser()` / `getCurrentUserFromRequest()`; `getSessionContextOrNull()` for GET /api/auth/session. Support-session path: cookie-based, no dealer user. |
| **Platform (apps/platform)** | Supabase Auth (platform Supabase project). PlatformUser row by user id. | Cookie only. No shared session with dealer. | `requirePlatformAuth()`; role from PlatformUser (PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT). |

- **Dealer:** Login at `/login` (password + magic link). No auth callback route; magic link completes in-browser. Invite accept at `/accept-invite`; signup path uses Supabase Admin `createUser` with `email_confirm: true` (no email verification step for invitees). No forgot-password or reset-password UI in dealer app today.
- **Platform:** Login at `/platform/login`; magic link redirects to `/api/platform/auth/callback`. No password reset or email verification UI in platform.
- **Mobile:** Has `/forgot-password`, `/reset-password` (Supabase `resetPasswordForEmail`, recovery session, `updateUser({ password })`); deep link `dmsdealer://reset-password`. No session list or MFA in mobile for V1 scope here.

### 2.2 Invite / login / session behavior

- **Invite:** `GET /api/invite/resolve`, `POST /api/invite/accept` (authenticated or signup body). Rate limits: invite_resolve, invite_accept. Token never logged; audit metadata no PII.
- **Session context (dealer):** `getSessionContextOrNull()` checks support-session cookie first; then Supabase user → Profile → platformAdmin → `getSessionDealershipInfo()` (active dealership from cookie or Bearer + membership). Returns permissions, pendingApproval, isSupportSession, supportSessionPlatformUserId.
- **Protected routes:** AuthGuard (client) + server-side `getAuthContext()` / `requireDealershipContext()` for API. AppShell only in `apps/dealer/app/(app)/layout.tsx`.
- **Impersonation:** (1) In-dealer: `POST /api/platform/impersonate` (body `{ dealershipId }`) for users with PlatformAdmin row; sets active-dealership cookie. (2) Platform→dealer support session: `POST /api/platform/impersonation/start` (PLATFORM_OWNER) → JWT → dealer `GET /api/support-session/consume?token=...` → support-session cookie; `POST /api/support-session/end` clears it. SupportSessionBanner in AppShell.

### 2.3 Known constraints

- **Supabase:** Auth is Supabase-managed. Password reset and email verification use Supabase APIs and (where applicable) redirect URLs configured in Supabase Dashboard. MFA (if adopted) will use Supabase MFA APIs and constraints (e.g. TOTP, recovery codes).
- **Server-first:** All auth-sensitive operations (token validation, membership, permissions) must be enforced server-side. Client may call Supabase for sign-in/sign-out and recovery; any dealer/platform API must validate session and context server-side.
- **Two Supabase projects:** Dealer and platform have separate projects; no shared auth. Password reset and email verification are per-app (dealer flows in dealer app; platform flows in platform app).
- **Cookie/Bearer:** Dealer supports both cookie (web) and Bearer (mobile). Session list and revoke must account for both; “sessions” may be inferred from Supabase (e.g. list sessions via Admin or from token metadata) or from app-level tracking (see Data plan).

---

## 3. Scope

For each of the five features, the following subsections define user personas, primary journeys, happy path, edge cases, failure states, and out-of-scope items for V1.

### 3.1 Password reset UI

- **Personas:** Dealer user (forgot password); platform user (forgot password).
- **Primary journey:** User requests reset → receives email → clicks link → lands on reset-password page → sets new password → success → can sign in.
- **Happy path:**
  - Forgot-password page: single field (email). Submit calls Supabase `resetPasswordForEmail(email, { redirectTo })`. Success: “If an account exists, you’ll receive an email with a reset link.” (generic).
  - Reset-password page: reached via redirect from email. URL may contain hash/fragment with Supabase recovery params; app exchanges or uses recovery session. Form: new password, confirm password. Submit: Supabase `updateUser({ password })` in recovery context. Success: “Password updated. You can sign in.” → redirect to login.
- **Edge cases:** Same email submitted multiple times (rate limit; same message). Link used twice (second use fails; show “Link expired or already used”). User not found: same success message (no enumeration).
- **Failure states:** Invalid/expired link → clear message + link to request new reset. Network/server error → generic error; retry possible.
- **Out of scope for V1:** Password strength UI beyond existing policy (min 12 chars, 3/4 categories); SMS reset; custom email templates (use Supabase defaults or dashboard config).

### 3.2 Email verification flow

- **Personas:** New user (signup or invite); existing user with unverified email.
- **Primary journey:** User signs up or is invited → (if Supabase configured to require verification) receives verification email → clicks link → lands on verify-email confirmation or callback → email marked verified → can use app without verification nag.
- **Happy path:**
  - After signup/magic-link: Supabase may send verification email; redirect URL points to dealer (or platform) app. Callback route handles `type=signup` or verification token, confirms with Supabase, then redirects to dashboard or settings with success toast.
  - App checks `user.email_confirmed_at` (or equivalent) from session; if unverified, show persistent but dismissible banner and optionally restrict sensitive actions until verified (product decision; spec assumes banner + optional “Resend verification email”).
- **Edge cases:** Link already used; link expired (show “Link expired”, offer resend). User already verified (idempotent; success).
- **Failure states:** Invalid token → generic error. Resend rate-limited → 429 + message.
- **Out of scope for V1:** Changing email address (email change flow); requiring verification before first login (configurable in Supabase; assume optional for V1).

### 3.3 MFA / 2FA

- **Personas:** Dealer user or platform user who opts in to MFA for extra security.
- **Primary journey:** User enables MFA → enrolls TOTP (authenticator app) or equivalent → on subsequent logins, after password, is challenged for TOTP code → enters code → access granted. User can disable MFA (with password re-check) or use recovery codes if implemented.
- **Happy path:**
  - Enrollment: Settings (or account) → “Enable two-factor” → server/Supabase generates secret → user scans QR or enters key → user enters first code to verify → MFA enabled; show recovery codes once (download/copy).
  - Challenge: Login (password) success → if MFA enabled, redirect to MFA challenge page → user enters code → Supabase (or server) verifies → session established → redirect to app.
  - Disable: Settings → “Disable two-factor” → confirm with password → MFA disabled.
- **Edge cases:** Wrong code (N attempts → lockout or delay; generic message). Lost device: recovery codes or admin-assisted reset (policy assumption: recovery codes; admin reset out of scope or minimal for V1). Multiple devices: same TOTP secret; no “trust this device” required for V1.
- **Failure states:** Invalid/expired code; rate limit on attempts; Supabase MFA API errors → generic message.
- **Out of scope for V1:** SMS/phone 2FA; hardware keys; mandatory MFA (opt-in only); platform-only or dealer-only (spec assumes both apps can support MFA per Supabase project).

### 3.4 Admin impersonation

- **Personas:** Platform admin (PLATFORM_OWNER) starting support session; dealer user with PlatformAdmin row using in-dealer impersonate.
- **Primary journey:** (Support session) Platform staff clicks “Open as dealer” on dealership → confirm dialog → redirect to dealer app with token → dealer consumes token, sets support-session cookie → banner “Support session — viewing as &lt;dealership&gt;” with “End support session”. (In-dealer) Platform admin in dealer app selects dealership → POST impersonate → active-dealership cookie set → same UI as normal switch, with audit.
- **Happy path:** Already implemented for support session (start, consume, end, banner). Spec extends: ensure impersonation banner is always visible when `isSupportSession` or when active session is from in-dealer impersonation (platformAdmin + cookie set for dealership without membership); optional “Impersonating &lt;dealership&gt;” indicator for in-dealer case; audit on end (if not already).
- **Edge cases:** Token expired on consume → 401; dealership CLOSED → 403. Ending session clears cookie; no server-side session list for support session (stateless cookie).
- **Failure states:** Invalid token; mapping missing; dealership closed.
- **Out of scope for V1:** Time-bound auto-end of impersonation (beyond cookie maxAge); full session list for support-session “sessions” (single active support session per browser).

### 3.5 Session management UI

- **Personas:** Dealer user; platform user; optionally dealership admin viewing member sessions (if in scope).
- **Primary journey:** User opens Account/Settings → “Sessions” or “Active sessions” → sees list of current sessions (device/location, last active, optionally IP) → can revoke one or “Revoke all others”.
- **Happy path:**
  - List: GET session list (from Supabase Admin “list user sessions” or app-stored session metadata). Show current session with “Current” badge; others with “Revoke” action.
  - Revoke: POST revoke by session id (or equivalent). Supabase invalidates that refresh token/session; user sees updated list. “Revoke all others” revokes every session except the one used for the request.
- **Edge cases:** No other sessions; one session (only “Current”). Session list may be eventually consistent (Supabase).
- **Failure states:** Revoke fails (e.g. session already gone) → generic error; list fails → show error state.
- **Out of scope for V1:** Per-device naming by user; geo/IP display (if not provided by Supabase); mandatory re-auth after N days (future policy).

---

## 4. Architecture Decisions

### 4.1 Server-first vs client responsibilities

- **Server:** All permission checks, tenant resolution, audit writes, rate limiting, and token/session validation. Password reset “request” can be client Supabase call; “reset confirm” may involve client Supabase recovery session + server-side audit log when password is updated (if we add server-side hook) or audit only on next login (lighter). Session list and revoke: server calls Supabase Admin or uses stored session metadata; never trust client-supplied session list.
- **Client:** Calling Supabase `resetPasswordForEmail`, `updateUser` in recovery context, `signInWithOtp`, MFA challenge submit; rendering forms and redirects. No permission or tenant logic on client.

### 4.2 Server actions vs route handlers vs middleware

- **Route handlers (API routes):** Use for session list, session revoke, password-reset request (if we proxy for rate limit/audit), email verification callback, MFA enroll/verify endpoints that need server-side Supabase Admin or custom logic. All under `/api/...` with Zod validation and standard error shape.
- **Server actions:** Optional for form submissions that only need to call one API route (e.g. “Resend verification email”) to keep mutations in one place; prefer API routes for auth flows so mobile/other clients can reuse.
- **Middleware:** Do not add auth logic that duplicates `getCurrentUser`; use middleware only for redirecting unauthenticated users to login for certain pathnames (if at all). Session resolution stays in API and RSC via existing patterns.

### 4.3 Shared services / helpers

- **Rate limiting:** Extend `lib/api/rate-limit.ts` (or equivalent) with keys for `password_reset_request`, `password_reset_confirm`, `email_verification_resend`, `mfa_challenge`, `session_revoke`. Same in-memory/pluggable pattern.
- **Audit:** Dealer: existing `auditLog` (dealershipId, actorId, action, entity, metadata). Platform: `platformAuditLog`. New actions: e.g. `auth.password_reset_requested`, `auth.password_reset_completed`, `auth.email_verified`, `auth.mfa_enrolled`, `auth.mfa_disabled`, `auth.session_revoked`, `impersonation.ended` (if not already).
- **Supabase:** Dealer app: `createClient()` (server), `createServiceClient()` (admin). Platform: same pattern for platform project. Shared: no shared auth client; each app uses its own Supabase instance.

### 4.4 Supabase integration points

- **Password reset:** `auth.resetPasswordForEmail(email, { redirectTo })`; user lands on redirect URL with recovery params; `auth.updateUser({ password })` after recovery session established. Redirect URLs must be allowlisted in Supabase Dashboard (dealer and platform separately).
- **Email verification:** Supabase sends verification email; redirect to app callback; `auth.verifyOtp` or exchange code for session. Or use `getSessionFromUrl()` after redirect. Confirmation status from `user.email_confirmed_at`.
- **MFA:** Supabase Auth MFA (if available in plan): enroll TOTP, verify, challenge at login. Else: document “MFA via Supabase when enabled” and scope implementation to Supabase MFA APIs.
- **Sessions:** Supabase Admin `listUserSessions` or similar (if available); otherwise “sessions” may be derived from refresh tokens or app-side metadata (see Data plan).

### 4.5 Platform vs dealer responsibilities

| Feature | Dealer app | Platform app |
|--------|------------|--------------|
| Password reset UI | Forgot + reset pages; callback if redirect lands here | Forgot + reset pages; callback if redirect lands here |
| Email verification | Callback route; banner; resend | Callback route; banner; resend |
| MFA | Enroll/challenge UI; API for enroll/verify/disable | Same pattern (separate Supabase project) |
| Impersonation | Consume support-session token; banner; end session; in-dealer impersonate API | Start support session; audit |
| Session management | List/revoke for dealer Supabase user | List/revoke for platform Supabase user |

---

## 5. Security Requirements

### 5.1 Tenant isolation

- Unchanged. All tenant routes continue to derive `dealershipId` from validated session/cookie (and membership or platform-admin impersonation). No new routes may accept `dealershipId` from client for authorization. Support session does not expose dealer user identity; session list and revoke are per authenticated user (no cross-tenant session access).

### 5.2 RBAC per feature

- **Password reset / email verification:** Unauthenticated or recovery context only for reset; callback may be unauthenticated. No RBAC beyond “valid recovery token” or “valid verification token”.
- **MFA:** Enroll/disable require authenticated user (self). Challenge is part of login (no dealership context yet).
- **Impersonation:** Start: PLATFORM_OWNER only. Consume: no auth (token is auth). End: no auth (cookie is auth). In-dealer impersonate: requires PlatformAdmin (existing).
- **Session list/revoke:** Authenticated user can list/revoke only their own sessions. No permission key required beyond “authenticated”; optional future: `admin.sessions.read` for dealership admins to see member sessions (out of scope V1).

### 5.3 Audit requirements per feature

- **Password reset:** Log `auth.password_reset_requested` (actorId if any, or IP; no email in metadata). Log `auth.password_reset_completed` when possible (e.g. after successful update or on next login with “password_reset” tag).
- **Email verification:** Log `auth.email_verified` (actorId, no PII).
- **MFA:** Log `auth.mfa_enrolled`, `auth.mfa_disabled` (actorId; no secrets).
- **Impersonation:** Already have `impersonation.started` (platform). Add `impersonation.ended` when support session is ended (dealer or platform), with platformUserId in metadata (no PII).
- **Session revoke:** Log `auth.session_revoked` (actorId, sessionId or equivalent; no tokens).

### 5.4 Rate limiting and abuse

- **Password reset request:** Per IP and per email (bucket) e.g. 5/min per email, 20/min per IP. Generic success message.
- **Reset confirm (recovery):** Per IP or per token; avoid brute force on link (Supabase may enforce; app can add per-IP limit).
- **Email verification resend:** Per user 3/min; per IP 10/min.
- **MFA challenge:** Per user 5 attempts per 15 min (or Supabase default); lockout message generic.
- **Session revoke:** Per user 30/min (avoid mass-revoke abuse).

### 5.5 Impersonation safety

- Support-session token: short-lived (e.g. 2h), signed with shared secret; single use not required (cookie is set once). End session clears cookie; no server-side “session” to revoke.
- In-dealer impersonate: only with PlatformAdmin row; audit every impersonate set; no escalation of permissions (same RBAC as dealership context).
- Banner must be visible whenever in support session or in-dealer impersonation so user cannot confuse context.

### 5.6 MFA recovery / lost device

- **Assumption:** Recovery codes are shown once at enrollment; user stores them. No “admin resets MFA” in V1 unless required (then: PLATFORM_OWNER only, with audit and optional email to user). Document in UX: “If you lose your device, use a recovery code.”

### 5.7 Response hygiene / generic errors

- No email enumeration: “If an account exists, you’ll receive…” for reset request; same for verification resend.
- Invalid link/token: “This link has expired or was already used.” No distinction between “wrong user” and “expired”.
- MFA wrong code: “Invalid code. Try again or use a recovery code.” No “N attempts left” if it leaks info (or use vague “Too many attempts. Try again later.”).
- All API errors use standard shape `{ error: { code, message, details? } }`; no stack traces or internal IDs to client.

---

## 6. UX Requirements

### 6.1 Pages / screens / components

- **Dealer:** `/login` (existing). New: `/forgot-password`, `/reset-password` (or `/auth/reset-password`). New: `/auth/verify-email` (callback or confirmation page). New: `/settings/security` or under account: MFA enroll/challenge (can be modal or dedicated page). New: `/settings/sessions` or Account → “Active sessions” (list + revoke). SupportSessionBanner (existing); optional in-dealer “Impersonating &lt;dealership&gt;” strip when platformAdmin and cookie set without membership.
- **Platform:** `/platform/login` (existing). New: `/platform/forgot-password`, `/platform/reset-password`, `/platform/auth/verify-email` (callback). New: Security/Sessions under platform user menu or settings.

### 6.2 Banners, warnings, confirmations

- **Impersonation banner:** Always show when `isSupportSession` (existing). Optionally show when `platformAdmin.isAdmin` and active dealership is from impersonation (cookie set, no membership). Text: “Support session — viewing as &lt;name&gt;” or “Impersonating &lt;name&gt;”. “End support session” / “Stop impersonating” button.
- **Unverified email:** Persistent banner (dismissible for session): “Verify your email to secure your account.” Link “Resend verification email.” Do not block app use unless product mandates (recommend allow with nag).
- **Password reset success:** Toast or inline: “Password updated. You can sign in.” Then redirect to login.
- **MFA enrollment:** After enabling: “Two-factor is now enabled. Save your recovery codes in a safe place.” Show codes once; “I’ve saved my codes” to dismiss.
- **Session revoke:** Confirm: “Revoke this session? The device will be signed out.” “Revoke all other sessions?” confirm.

### 6.3 Session list UX

- Table or list: current session marked “Current”; others show last active (time or relative), optional device/UA summary. “Revoke” per row; “Revoke all other sessions” button. Empty state: “You’re only signed in on this device.”

### 6.4 Unverified-email UX

- Banner at top (or in AppShell) when `user && !user.email_confirmed_at`. Link to “Resend verification email” (rate-limited). Optional: restrict “Change password” or sensitive actions until verified (document as product choice).

### 6.5 Password reset success/failure states

- Success: Message + redirect to login. Failure: “This link has expired or was already used.” + link to forgot-password. Request success: “If an account exists, you’ll receive an email…”

### 6.6 MFA enrollment/challenge UX states

- Enrollment: Step 1 show QR + manual key; Step 2 “Enter code from app”; success → show recovery codes; done. Challenge: Single field “Enter 6-digit code”; “Use recovery code” link if we support it; loading; error “Invalid code” or “Too many attempts.”

---

## 7. Data / Contract Plan

### 7.1 DB / schema changes

- **Dealer DB:** Optional: `UserSession` or equivalent to store session metadata (id, userId, deviceInfo?, ip?, lastActiveAt, createdAt) for “session list” if Supabase does not expose list. If Supabase Admin provides session list, no new table. Audit log: existing `AuditLog`; new actions as in §5.3.
- **Platform DB:** Same optional session table for platform users; existing `PlatformAuditLog` for new actions.
- **Profile:** No new columns required for V1. Email verification state comes from Supabase `user.email_confirmed_at` (or equivalent) in session.

### 7.2 Session metadata assumptions

- If we store sessions: create row on login (or on first request after login); update `lastActiveAt` periodically or on each request (throttled). Session id = Supabase session id or our UUID. Revoke = delete row + call Supabase to invalidate refresh token (if API exists).
- If Supabase only: “Sessions” = list from Supabase Admin API (e.g. by user id); revoke = Supabase Admin revoke. No app DB table.

### 7.3 API / service contracts (high level)

- **Dealer**
  - `POST /api/auth/forgot-password` — body `{ email }`. Rate limit; call Supabase `resetPasswordForEmail`; audit; return 200 always (generic message).
  - `GET /api/auth/callback` (or `/auth/callback`) — query/hash: Supabase recovery or verification. Exchange or set session; redirect; audit if verification.
  - `POST /api/auth/reset-password` — body `{ password, confirmPassword }`; require recovery context (session from Supabase recovery). Validate policy; Supabase `updateUser`; audit; return 200.
  - `POST /api/auth/verify-email/resend` — auth required; rate limit; send verification email; audit; 200 or 429.
  - `GET /api/auth/sessions` — auth required; return list of sessions (current + others).
  - `POST /api/auth/sessions/revoke` — body `{ sessionId? }`; if absent, revoke all others; auth required; audit.
  - MFA: `POST /api/auth/mfa/enroll` (start), `POST /api/auth/mfa/verify` (finish enroll), `POST /api/auth/mfa/challenge` (login step), `POST /api/auth/mfa/disable` (with password). Contracts depend on Supabase MFA API.
- **Platform**
  - Same pattern for platform base path (e.g. `/api/platform/auth/forgot-password`, etc.). Callback already at `/api/platform/auth/callback`; extend for verification if needed.

### 7.4 Route inventory (high level)

- Dealer: `/forgot-password`, `/reset-password`, `/auth/verify-email` (or embedded in callback). `/api/auth/forgot-password`, `/api/auth/callback` (if not only client), `/api/auth/reset-password`, `/api/auth/verify-email/resend`, `/api/auth/sessions`, `/api/auth/sessions/revoke`, `/api/auth/mfa/*`. Existing: `/api/support-session/consume`, `/api/support-session/end`.
- Platform: `/platform/forgot-password`, `/platform/reset-password`, `/platform/auth/verify-email`. `/api/platform/auth/forgot-password`, `/api/platform/auth/callback` (existing), `/api/platform/auth/reset-password`, `/api/platform/auth/verify-email/resend`, `/api/platform/auth/sessions`, `/api/platform/auth/sessions/revoke`, `/api/platform/auth/mfa/*`.

---

## 8. File Plan

Concrete files to add or update, repo-aware.

### 8.1 apps/dealer

- **New pages:** `app/(app)/forgot-password/page.tsx`, `app/(app)/reset-password/page.tsx` (or under `app/(auth)/` if we group unauthenticated pages). `app/(app)/auth/verify-email/page.tsx` or similar. `app/(app)/settings/security/page.tsx` (or account subtree). `app/(app)/settings/sessions/page.tsx`.
- **New API routes:** `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`, `app/api/auth/verify-email/resend/route.ts`, `app/api/auth/callback/route.ts` (if server-side callback needed). `app/api/auth/sessions/route.ts` (GET list), `app/api/auth/sessions/revoke/route.ts`. `app/api/auth/mfa/enroll/route.ts`, `app/api/auth/mfa/verify/route.ts`, `app/api/auth/mfa/challenge/route.ts`, `app/api/auth/mfa/disable/route.ts`.
- **Components:** `components/unverified-email-banner.tsx`. Optional: `components/impersonation-strip.tsx` (in-dealer). Update `components/support-session-banner.tsx` if copy or behavior changes. MFA components: e.g. `components/mfa-enroll-form.tsx`, `components/mfa-challenge-form.tsx`.
- **Lib:** `lib/auth.ts` — extend with helpers if needed (e.g. requireRecoverySession). `lib/api/rate-limit.ts` — add keys. Audit calls in new routes. Optional: `lib/sessions.ts` or service for list/revoke.
- **Context:** `contexts/session-context.tsx` — expose `emailVerified` or similar from session if we add it to GET /api/auth/session.
- **Config:** Ensure `NEXT_PUBLIC_APP_URL` (or dealer app URL) is used for reset/verification redirects in Supabase config.

### 8.2 apps/platform

- **New pages:** `app/(platform)/platform/forgot-password/page.tsx`, `app/(platform)/platform/reset-password/page.tsx`, `app/(platform)/platform/auth/verify-email/page.tsx`. `app/(platform)/platform/settings/security/page.tsx`, `app/(platform)/platform/settings/sessions/page.tsx` (or under existing platform layout).
- **New API routes:** `app/api/platform/auth/forgot-password/route.ts`, `app/api/platform/auth/reset-password/route.ts`, `app/api/platform/auth/verify-email/resend/route.ts`; extend `app/api/platform/auth/callback/route.ts` for verification. `app/api/platform/auth/sessions/route.ts`, `app/api/platform/auth/sessions/revoke/route.ts`. `app/api/platform/auth/mfa/*`.
- **Components:** Unverified-email banner; MFA UI for platform.
- **Lib:** Rate limit and audit in new routes; platform auth helpers unchanged.

### 8.3 Shared modules / packages

- **packages/contracts:** Add error codes or constants for auth (e.g. `PASSWORD_RESET_REQUESTED`, `SESSION_REVOKED`) if used across apps. Optional.
- **No shared auth package:** Dealer and platform keep separate Supabase clients and auth logic.

### 8.4 Existing files to touch

- **Dealer:** `app/(app)/layout.tsx` — ensure AppShell wraps new pages; add UnverifiedEmailBanner in shell if global. `app/login/page.tsx` — add “Forgot password?” link to `/forgot-password`. `lib/api/handler.ts` — extend session type with `emailVerified?: boolean` if we add it. `lib/api/rate-limit.ts` — new rate limit types and apply in new routes.
- **Platform:** `app/(platform)/platform/login/page.tsx` — “Forgot password?” link. Layout: add banner or security/sessions links in nav.

---

## 9. Testing Strategy

Jest-first coverage for the following. All auth and RBAC tests must be in place before considering feature complete.

### 9.1 Auth flows

- **Password reset:** Request with valid email → 200 and audit; request rate-limited → 429. Reset with valid recovery session + valid password → 200 and audit. Reset with invalid/expired recovery → 401/400. Reset with weak password → 422.
- **Email verification:** Callback with valid token → redirect and audit. Resend authenticated → 200; resend rate-limited → 429.
- **MFA:** Enroll flow (mock Supabase): start returns secret; verify with valid code → enabled and audit. Challenge with valid code → success; invalid code → 401. Disable with password → disabled and audit.

### 9.2 RBAC

- Session list: unauthenticated → 401. Authenticated → 200 with own sessions only.
- Session revoke: unauthenticated → 401. Revoke other session → 200 and audit; revoke non-existent → 404 or 200 idempotent.
- Impersonation start: non–PLATFORM_OWNER → 403. PLATFORM_OWNER → 200 and audit.

### 9.3 Tenant isolation

- Session list/revoke: user A cannot see or revoke user B’s sessions (no dealership in scope; user-scoped only). Tenant routes unchanged; existing tenant isolation tests still pass.

### 9.4 Impersonation auditability

- Support session start: audit `impersonation.started` with correct targetDealershipId/dealerDealershipId. Support session end: audit `impersonation.ended` with platformUserId (no PII). In-dealer impersonate: existing audit; no regression.

### 9.5 Session revoke flows

- Revoke one: session removed from list; audit. Revoke all others: only current remains; audit for each revoke or single “revoked_all_others”.

### 9.6 MFA enrollment / challenge / disable

- Enroll: success and failure (wrong code). Challenge: success, wrong code, rate limit. Disable: with password success; wrong password 401.

### 9.7 Verification and password reset edge cases

- Verification: already used link; expired link; invalid token. Reset: expired recovery; missing recovery session; duplicate submit (idempotent or 400).

---

## 10. Rollout Plan

### Phase A (lower risk): Password reset, email verification, sessions

- **Order:** (1) Password reset UI (forgot + reset pages + API + rate limit + audit). (2) Email verification (callback + banner + resend). (3) Session list and revoke (API + UI).
- **Why:** Reset and verification are expected by users and reduce support load; no new auth factors. Session management is read/revoke only and improves security without changing login flow. All can be tested in isolation and rolled out behind feature flags if desired.

### Phase B (higher care): Impersonation hardening, MFA

- **Order:** (4) Impersonation: ensure banner and audit for end; optional in-dealer “Impersonating” strip; document and test. (5) MFA: enroll, challenge, disable; recovery codes; tests and Supabase MFA limits.
- **Why:** Impersonation is already in use; hardening is incremental. MFA touches login path and depends on Supabase MFA availability; do after Phase A is stable.

---

## 11. Acceptance Criteria

### 11.1 Password reset

- [ ] User can request password reset from forgot-password page; receives email when account exists; no email enumeration.
- [ ] User can set new password from reset link; success message and redirect to login; invalid/expired link shows clear message.
- [ ] Rate limits and audit entries in place; tests pass.

### 11.2 Email verification

- [ ] Verification link in email lands on app and marks email verified; callback audited.
- [ ] Unverified users see banner with option to resend; resend rate-limited and audited.
- [ ] Tests for callback and resend.

### 11.3 MFA

- [ ] User can enable TOTP from settings; QR and manual key; verification step; recovery codes shown once.
- [ ] After enabling, login requires TOTP challenge; valid code grants access; invalid code handled.
- [ ] User can disable MFA with password confirmation; audit for enable/disable.
- [ ] Tests for enroll, challenge, disable.

### 11.4 Admin impersonation

- [ ] Support session shows banner; “End support session” clears cookie and redirects; audit on end (if not already).
- [ ] In-dealer impersonation clearly indicated when applicable; no permission escalation; audit unchanged.
- [ ] Tests for consume, end, and audit.

### 11.5 Session management

- [ ] User can view list of sessions (current + others); current marked.
- [ ] User can revoke one session or “Revoke all others”; list updates; audit for revokes.
- [ ] Tests for list (auth) and revoke (self only).

---

## 12. Risks / Open Questions

- **Supabase MFA availability:** Confirm Supabase plan includes MFA (TOTP) and API (enroll, verify, challenge). If not, MFA scope may be “design only” or deferred.
- **Session list API:** Supabase Admin may or may not expose “list sessions” per user. If not, we need app-side session storage (table + create/update on request) and revoke via token invalidation (if Supabase supports revoke by token id). Confirm before implementation.
- **Redirect URL config:** Dealer and platform must have reset and verification redirect URLs allowlisted in each Supabase project. Document in DEPLOYMENT.md; no code change for Dashboard.
- **Recovery session in dealer web:** Reset-password page must receive Supabase recovery (hash or query). Supabase typically redirects to `redirectTo` with hash; client must parse and set session (e.g. `getSessionFromUrl()` or equivalent). Confirm Supabase client API for server-side vs client-side recovery handling in Next.js.
- **Platform vs dealer auth callback:** Platform has `/api/platform/auth/callback` for magic link. Dealer has no auth callback today; magic link may complete in client. Add dealer `/api/auth/callback` or `/auth/callback` only if reset/verification redirects land there and need server-side exchange.
- **Jest vs Vitest:** agent_spec says “Vitest for unit/integration”; many repo tests are Jest. Align on Jest for auth tests (as requested in prompt) or Vitest; both are acceptable if pattern is consistent.

---

## 13. Recommended Step 2 Backend Execution Order

Execute in this order for Step 2 (backend implementation):

1. **Password reset (dealer)** — Rate limit keys, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (recovery context), audit actions, Zod schemas. Then dealer forgot-password and reset-password pages and login link.
2. **Email verification (dealer)** — Callback or confirmation route, `POST /api/auth/verify-email/resend`, audit, unverified-email banner and session shape.
3. **Sessions (dealer)** — `GET /api/auth/sessions`, `POST /api/auth/sessions/revoke`, audit; implement with Supabase Admin or app table per §7.2. Then sessions UI.
4. **Password reset + email verification + sessions (platform)** — Mirror dealer flows for platform app and platform Supabase project.
5. **Impersonation hardening** — Audit `impersonation.ended` on support-session end; optional in-dealer impersonation strip and tests.
6. **MFA (dealer then platform)** — Enroll, verify, challenge, disable endpoints and UI; recovery codes; tests. Depends on Supabase MFA API confirmation.

This order minimizes risk (no MFA in critical path first), delivers user-visible value (reset, verification, sessions) early, and keeps impersonation and MFA for when foundation is stable.

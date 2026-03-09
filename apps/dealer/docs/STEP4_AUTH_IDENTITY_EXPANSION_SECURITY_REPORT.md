# Step 4: Auth & Identity Expansion V1 — Security & QA Report

## Security review summary

Step 4 performed a security and QA pass over the completed Auth & Identity Expansion V1 (Steps 2–3). No new features were added. Changes were limited to: (1) additional tests for response hygiene, callback redirect safety, session/emailVerified shape, and rate-limit messaging; (2) platform auth route tests (forgot-password, reset-password, verify-email/resend, sessions, sessions/revoke) and platform callback error normalization; (3) documentation of deployment and redirect requirements.

---

## Route-by-route findings

### Dealer

| Route | Finding | Status |
|-------|---------|--------|
| POST /api/auth/forgot-password | Generic success message; rate limit per IP and per email (hashed); audit with no PII; no code/token in response or logs. | OK |
| POST /api/auth/reset-password | Generic invalid/expired message (RESET_PASSWORD_INVALID_CONTEXT_MESSAGE); requires valid recovery session; audit metadata safe. | OK |
| POST /api/auth/verify-email/resend | Auth required; rate limit (IP + per user); generic success message; audit safe. | OK |
| GET /api/auth/callback | No code in redirect URL; `getSafeRedirectPath` rejects `//` and `\`; error redirect uses `error=invalid_link` only. | OK (tests added for open-redirect) |
| GET /api/auth/sessions | Auth required; returns only current session; session id derived from token hash (opaque). | OK |
| POST /api/auth/sessions/revoke | Auth required; rate limited per user; 429 message generic; audit actions present. | OK |
| GET /api/auth/session | Returns emailVerified from server-derived context only; no client input trusted. | OK |
| POST /api/support-session/end | Audits impersonation.ended with safe metadata (dealershipId, platformUserId). | OK |

### Platform

| Route | Finding | Status |
|-------|---------|--------|
| POST /api/platform/auth/forgot-password | Generic success; rate limited; audit; no enumeration. | OK |
| POST /api/platform/auth/reset-password | Generic invalid/expired message; session required; audit. | OK |
| POST /api/platform/auth/verify-email/resend | Auth required; rate limit; generic message. | OK |
| GET /api/platform/auth/callback | getSafeInternalRedirectPath prevents external/`//`; error redirect normalized to `error=invalid_link`. | OK (test updated) |
| GET /api/platform/auth/sessions | Auth required; current session only. | OK |
| POST /api/platform/auth/sessions/revoke | Auth required; rate limited; safe 429 message. | OK |

---

## Response hygiene findings

- **Forgot-password (dealer & platform):** Success response is generic (“If an account exists…”). No email enumeration. Rate limit returns 429 with “Too many requests. Try again later.” (no email/account wording in 429 body).
- **Reset-password:** Invalid/expired context returns UNAUTHORIZED with RESET_PASSWORD_INVALID_CONTEXT_MESSAGE / PLATFORM_RESET_PASSWORD_INVALID_CONTEXT_MESSAGE (generic “link expired or already used”).
- **Verify-email resend:** Success message generic; 429 message safe.
- **Callback errors:** Dealer and platform both redirect to login with `error=invalid_link` only; provider error messages are not reflected to the user.
- **Session revoke:** 429 and error responses do not expose tokens or session identifiers to the client beyond opaque ids.

---

## Tenant / RBAC findings

- **emailVerified:** Derived only on the server (getCurrentUser / getSessionContextOrNull for dealer; getPlatformUserOrNull for platform). Not taken from client input. Unauthenticated users do not receive privileged session fields (GET /api/auth/session returns 401 when unauthenticated).
- **Support session:** Dealer unverified banner is suppressed when `isSupportSession` is true (context and UI tests confirm). Support-session context is not treated as a regular user for email verification UX.
- **Settings/account access:** Dealer sessions UI lives under Settings → Security, which is inside the authenticated app shell. Platform account page is under authenticated platform layout; unauthenticated users are redirected to login.
- **Platform allowed paths:** `/platform/login`, `/platform/forgot-password`, `/platform/reset-password` are explicitly allowed for unauthenticated access; no bypass or loop observed.
- **Session list/revoke:** All session and revoke routes are user-scoped (requireUserFromRequest / requirePlatformAuth). No dealershipId or other tenant identifier is accepted from the client for authorization; tenant context is resolved server-side from session/cookies.

---

## Rate-limit findings

- **Dealer:** password_reset_request (IP + per-email hashed), email_verification_resend (IP + per user), session_revoke (per user) are applied and tested. Reset-password POST is not rate-limited (gated by valid recovery session).
- **Platform:** password_reset_request, email_verification_resend, session_revoke are implemented and covered by new route tests.
- **429 UX:** All 429 responses use a safe message (“Too many requests. Try again later.” or equivalent); no sensitive detail in body. Frontend shows inline/error state; no special 429 handling beyond generic error display.

---

## Audit findings

- **Events verified in tests or code:** auth.password_reset_requested, auth.password_reset_completed, auth.email_verification_resent, auth.email_verified, auth.session_revoked, auth.sessions_revoked_all_others, impersonation.ended.
- **Metadata hygiene:** Audit calls use dealershipId, actorUserId/actorPlatformUserId, action, entity; no raw email, tokens, codes, or secrets in metadata. Support-session end uses platformUserId in metadata (operational identifier only).

---

## Callback / redirect findings

- **Dealer callback:** `getSafeRedirectPath(next)` allows only relative paths; rejects `//` and `\`; defaults to `/`. Error redirect uses fixed `error=invalid_link`. Base URL from NEXT_PUBLIC_APP_URL or VERCEL_URL or request origin.
- **Platform callback:** `getSafeInternalRedirectPath` allows only internal paths starting with `/`; rejects `//`; defaults to `/platform`. `getValidatedAppBaseUrl` uses request origin or env; logs mismatch. Error redirect uses `error=invalid_link`.
- **Open redirect:** Dealer callback tests added for `next=//evil.com` and `next=/\\evil`; both normalize to `/`.

---

## Platform parity findings

- Platform auth flows (forgot, reset, verify resend, sessions, revoke) mirror dealer behavior and use platform-only endpoints. Callback error handling normalized to invalid_link. Platform route tests added for forgot-password, reset-password, verify-email/resend, sessions, sessions/revoke.

---

## Known residual risks

1. **Sessions API:** Still returns only the current session (Supabase limitation). “Revoke all other sessions” is supported; UI does not pretend multiple sessions exist when only one is returned.
2. **Rate limit store:** In-memory; in multi-instance production a shared store (e.g. Redis) is recommended for accurate limits.
3. **MFA:** Deferred; no real MFA implementation. Security settings show “Coming soon” only.
4. **Redirect allowlist:** Supabase Dashboard must allow the same redirect URLs used by the app (see Deployment section). Misconfiguration can break reset/verification links.

---

## Deployment / redirect allowlist and env

### Dealer app

- **Reset-password redirect URL** (used by `getPasswordResetRedirectUrl()`):  
  `{NEXT_PUBLIC_APP_URL or VERCEL_URL or origin}/reset-password`  
  Example: `https://your-dealer-app.vercel.app/reset-password`
- **Email verification / magic link callback:**  
  `{base}/api/auth/callback`  
  Example: `https://your-dealer-app.vercel.app/api/auth/callback`
- **Required env:**  
  - `NEXT_PUBLIC_APP_URL` — set to the public base URL of the dealer app (e.g. `https://your-dealer-app.vercel.app`) so reset and callback redirects are correct.  
  - If unset, code falls back to `VERCEL_URL` (with `https://`) or request origin. In production, set `NEXT_PUBLIC_APP_URL` explicitly.

**Supabase (dealer project) Dashboard:**  
- In Authentication → URL Configuration, add to **Redirect URLs**:  
  - `https://your-dealer-app.vercel.app/reset-password`  
  - `https://your-dealer-app.vercel.app/api/auth/callback`  
  - (and any other legitimate redirect paths you use with `?next=`)

### Platform app

- **Reset-password redirect URL** (used by `getPlatformPasswordResetRedirectUrl()`):  
  `{NEXT_PUBLIC_APP_URL or VERCEL_URL or origin}/platform/reset-password`  
  Example: `https://your-platform-app.vercel.app/platform/reset-password`
- **Callback URL:**  
  `{base}/api/platform/auth/callback`  
  Example: `https://your-platform-app.vercel.app/api/platform/auth/callback`
- **Required env:**  
  - `NEXT_PUBLIC_APP_URL` — set to the public base URL of the platform app (e.g. `https://your-platform-app.vercel.app`).  
  - Platform uses `getValidatedAppBaseUrl`; mismatch with request origin is logged (auth_redirect_base_mismatch) but does not break redirects.

**Supabase (platform project) Dashboard:**  
- In Authentication → URL Configuration, add to **Redirect URLs**:  
  - `https://your-platform-app.vercel.app/platform/reset-password`  
  - `https://your-platform-app.vercel.app/api/platform/auth/callback`

### Behavior when env is missing

- Dealer: Falls back to `VERCEL_URL` or `http://localhost:3000`; reset/callback still work but may point to wrong host if not set.
- Platform: Falls back to `VERCEL_URL` or `http://localhost:3001`; logs warning on origin mismatch. No runtime crash; redirects use request origin or fallback.

---

## Go/no-go recommendation

**Go** for the current auth/account scope (password reset, email verification UX, sessions list and revoke, unverified banner, support-session and platform parity) with the following conditions:

- Set `NEXT_PUBLIC_APP_URL` (and platform equivalent if separate origin) in production and add the documented redirect URLs to each Supabase project’s allowlist.
- Plan rate-limit backend for production if running multiple instances.
- Treat MFA as a separate phase when backend is ready; no change to the current “Coming soon” placeholder in this step.

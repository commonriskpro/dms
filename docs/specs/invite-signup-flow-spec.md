# Invite Link as Signup Page — Specification

**Scope:** Extend the platform-admin invitation link so the invited person can create an account (email + password) and accept the invite in one flow, without a separate redirect to Supabase sign-up. Spec covers data model, API contracts, flow choice, password policy, UX, and state machine. **No code** — design and contracts only.

**App ownership:** Dealer app owns the routes and pages (`/accept-invite`, `GET/POST /api/invite/resolve`, `POST /api/invite/accept`).

**References:** DMS Non-Negotiables, Coding Standards, `docs/design/platform-admin-spec.md`, `docs/SECURITY.md`, dealer Prisma schema and existing invite resolve/accept implementation.

---

## 1. Data Model and Constraints

### 1.1 DealershipInvite — Schema Changes

- **Current fields:** `id`, `dealershipId`, `email`, `roleId`, `status`, `expiresAt`, `createdBy`, `createdAt`, `updatedAt`, `acceptedAt`, `token`.
- **Add (recommended):**
  - **`acceptedByUserId`** — `String? @db.Uuid`, FK → Profile. Set when invite is marked ACCEPTED; identifies who accepted. Optional for audit/traceability; not required for authorization (dealershipId is always derived from invite server-side).
- **Optional:** **`emailNormalized`** — `String?`. If present, store lowercased invitee email for consistent lookups; all comparisons use lowercased value. If not added, continue comparing with `invite.email.toLowerCase()` and `actorEmail.toLowerCase()`.
- **Token:** Keep token as **plain unique string** at rest (no hash). Constraints:
  - Token is **never** logged (no request/response logs, no audit metadata, no Sentry).
  - One-time use: after status is ACCEPTED, resolve (GET) returns **410 Gone** so the token cannot be used to see invite details again; accept (POST) remains idempotent for the same authenticated user.
  - Expirable: `expiresAt` enforced on both resolve and accept; if past, return 410.

### 1.2 Profile and “Username”

- **Profile:** `id` (Supabase user id), `email` (unique), `fullName`, `avatarUrl`. No separate `username` in DB.
- **Document:** “Username” for display is **email** (Supabase identifier); **fullName** is optional display name. Signup form collects email (required), password, confirm password, and optional full name; fullName is written to Profile at create/update.

### 1.3 Membership

- No schema change. Existing: `dealershipId`, `userId`, `roleId`, `inviteId`, `invitedBy`, `invitedAt`, `joinedAt`. All writes scoped by `invite.dealershipId`; `dealershipId` is **never** taken from client.

### 1.4 Audit

- **DealershipInvite** is critical: create, update (status/acceptedAt), and cancel must be audited. Audit **metadata must not** contain token or PII (no email, no token); allowed: `inviteId`, `dealershipId`, `roleId`, `membershipId`, `acceptedByUserId` (if present). Sensitive read of invite by token is not audited (to avoid logging token); accept action is audited with IDs only.

---

## 2. Desired Flow and Option Choice

### 2.1 Page and Entry

- Recipient opens **`/accept-invite?token=...`** (dealer app).
- Page calls **GET /api/invite/resolve?token=...** (public).
- UI shows: dealership name, role name, expiry, and optionally **masked email** (see §3.1) or a prompt to enter email.
- If **not signed in:** Show “Create account” form: email (required, must match invite), password, confirm password, optional full name. Submit uses **signup path** (see below).
- If **signed in:** Show “Accept” (single button). Submit uses **authenticated path**: POST accept with `{ token }` only; server enforces `actorEmail === invite.email`.

### 2.2 Signup Path — Option B (Server-Side Create)

**Chosen approach:** Single POST that creates the user and accepts the invite server-side.

- **Client** submits **POST /api/invite/accept** (no auth) with body: `{ token, email, password, confirmPassword?, fullName? }`.
- **Server:**
  1. Rate limit (per IP + per token); validate body with Zod.
  2. Resolve invite by token; enforce status PENDING and not expired; **dealershipId** comes only from invite.
  3. Validate `email` matches invite email (case-insensitive).
  4. Validate password (min 12 chars, 3/4 character categories; see §4).
  5. Call **Supabase Admin** `createUser` (or equivalent) with email + password; do **not** store password in our DB.
  6. Create or link **Profile** (getOrCreateProfile) with email and optional fullName.
  7. Create **Membership** for `invite.dealershipId`, `profile.id`, `invite.roleId`, `inviteId`, `invitedBy`, `joinedAt`.
  8. Mark invite **ACCEPTED**, set `acceptedAt` and optionally `acceptedByUserId`.
  9. Return success payload; **no session cookie** from this request.
- **Client** on success: call **Supabase `signInWithPassword(email, password)`**, then redirect into app (e.g. set active dealership and go to dashboard).

**Rationale:** One server round-trip; rate limiting and password validation in one place; no client-side signUp then accept; dealershipId never sent by client.

**Alternative (Option A) not chosen:** Client calls Supabase `signUp(email, password)` first, then POST /api/invite/accept with `{ token }` (auth required). That would require two round-trips and client handling signUp errors separately; Option B keeps accept + signup atomic on the server.

### 2.3 Authenticated Path (Existing, Unchanged)

- User already signed in. **POST /api/invite/accept** with body `{ token }` (auth required).
- Server: resolve invite, require `actorEmail === invite.email`, getOrCreateProfile, create membership if needed, mark invite ACCEPTED. Idempotent: second accept returns same membership (200).

---

## 3. API Contracts

### 3.1 GET /api/invite/resolve (Public)

- **Purpose:** Return non-PII (or minimal masked PII) invite details for the accept page.
- **Rate limit:** `invite_resolve` (existing, e.g. 60/min per client).
- **Query (Zod):** `resolveInviteQuerySchema`: `{ token: z.string().min(1) }`. Token must not be logged.

**Success (200):**

```json
{
  "data": {
    "inviteId": "uuid",
    "dealershipName": "string",
    "roleName": "string",
    "expiresAt": "ISO8601 | undefined",
    "emailMasked": "string | undefined"
  }
}
```

- **emailMasked (optional):** If product wants to show “Invitation sent to j***@example.com”, include a masked value (e.g. first character + `***` + `@` + domain). Omit if no PII should be shown. Mask algorithm: e.g. `firstChar + '***' + '@' + domain`; do not expose full email.

**Errors:**

- **404** — `INVITE_NOT_FOUND`: Invalid or unknown token (or treat as 410 for consistency; see §6).
- **410 Gone** — `INVITE_EXPIRED`: status is EXPIRED or CANCELLED, or `expiresAt` is in the past.
- **410 Gone** — `INVITE_ALREADY_ACCEPTED`: status is ACCEPTED (one-time use; token no longer valid for resolve).
- **429** — `RATE_LIMITED`: Too many requests.

**Response shape (error):** `{ "error": { "code": "...", "message": "..." } }`. No token or PII in response or logs.

**Dealership scoping:** N/A (no dealership in request); server derives invite from token only.

---

### 3.2 POST /api/invite/accept

- **Purpose:** (1) Authenticated: accept invite with existing account. (2) Unauthenticated (signup path): create account via Supabase Admin and accept invite in one flow.
- **Rate limit:** `invite_accept` (existing, e.g. 10/min per client); **additionally** rate limit by token (e.g. per-token cap) to prevent brute force on a single link.
- **Dealership scoping:** `dealershipId` is **never** from client; always from `invite.dealershipId` after resolving by token.

#### 3.2.1 Authenticated Path (Existing)

- **Auth:** Required. `requireUser()` → `userId`, `email`.
- **Body (Zod):** `acceptInviteBodySchema` (current): `{ token: z.string().min(1) }`.
- **Success (200):** `{ "data": { "membershipId": "uuid", "dealershipId": "uuid", "alreadyHadMembership?": true } }`.
- **Errors:** INVITE_NOT_FOUND (404), INVITE_EXPIRED (410), INVITE_ALREADY_ACCEPTED (410), and **INVITE_EMAIL_MISMATCH** when `actorEmail` does not match invite email (403 or 422; recommend 403 with code `INVITE_EMAIL_MISMATCH`). No token in logs.

#### 3.2.2 Unauthenticated Path (Signup)

- **Auth:** None. Request must include `token`, `email`, `password` (and optionally `confirmPassword`, `fullName`).
- **Body (Zod):** New schema, e.g. `acceptInviteSignupBodySchema`:
  - `token`: `z.string().min(1)`
  - `email`: `z.string().email()`
  - `password`: `z.string().min(12)` (server re-validates policy: 3/4 categories; see §4)
  - `confirmPassword`: `z.string().optional()` (if present, must equal `password`; or validate in app logic)
  - `fullName`: `z.string().max(200).optional()`
- **Success (200):** Same as authenticated: `{ "data": { "membershipId": "uuid", "dealershipId": "uuid", "alreadyHadMembership?": false } }`. Client then calls Supabase `signInWithPassword(email, password)` and redirects.
- **Errors:**
  - **400** — `VALIDATION_ERROR`: Zod or password policy failed; body: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "fieldErrors": { "email"?: "string", "password"?: "string", "token"?: "string", "fullName"?: "string" } } } }`.
  - **403** — `INVITE_EMAIL_MISMATCH`: Email does not match invite. Optionally include `fieldErrors: { "email": "..." }`.
  - **404** — `INVITE_NOT_FOUND`
  - **410** — `INVITE_EXPIRED` or `INVITE_ALREADY_ACCEPTED`
  - **409** — If Supabase reports user already exists for that email: e.g. `EMAIL_ALREADY_REGISTERED` — client should show “Already have an account? Sign in” and use authenticated flow.
  - **429** — `RATE_LIMITED`

**Routing:** Server may distinguish signup path by absence of auth session and presence of `email`/`password` in body; or expose a separate path (e.g. `POST /api/invite/accept-with-signup`). Spec leaves exact routing to implementation; contract is one endpoint that accepts either (auth + token) or (token + email + password + fullName?).

**Error shape (standard):** `{ "error": { "code": "string", "message": "string", "details"?: { "fieldErrors"?: Record<string, string> } } }`. No token or password in response or logs.

---

## 4. Password Policy and Rate Limiting

- **Policy:** Minimum **12 characters**; at least **3 of 4** character categories: uppercase, lowercase, digit, symbol. If the project has **zxcvbn**, it may be used in addition (e.g. reject below a certain score); otherwise 3/4 categories are sufficient.
- **Where validated:** **Client** (for UX) and **server** (when server creates user via Supabase Admin). Server must not create user if password fails policy.
- **Rate limiting:**
  - **invite_accept:** Per client identifier (e.g. IP) — existing limit (e.g. 10/min).
  - **Per token:** Cap accept attempts per token (e.g. 5 per token per 15 min) to limit brute force on a single link. Implementation detail: count by token in rate-limit store; token must not be stored in logs.
- Passwords are stored only in **Supabase**; we never store raw or hashed password in our DB.

---

## 5. UX Summary

- **Loading:** Show loading state while GET resolve and on POST accept submit.
- **Expiry:** If resolve returns 410 (expired or already accepted), show message: e.g. “This invite has expired or was cancelled” / “This invite has already been used.” No retry for same token.
- **Already accepted:** Same 410 + message; do not allow form submit.
- **Field errors:** Use `fieldErrors` from 400/403: map `email`, `password`, `token`, `fullName` to inline messages (e.g. “Email does not match invitation”, “Password must be at least 12 characters and include 3 of 4 character types”).
- **Already registered:** On 409 EMAIL_ALREADY_REGISTERED, show “An account with this email already exists. Please sign in and then accept the invite.” Link to sign-in with return URL to `/accept-invite?token=...` so after sign-in user can hit Accept again (authenticated path).
- **Token in URL:** Page reads `token` from query; do not put token in logs or analytics.

---

## 6. State Machine and When to Reject

### 6.1 Invite Status Transitions

- **PENDING** → **ACCEPTED**: User successfully accepts (authenticated or signup path). Set `acceptedAt` (and optionally `acceptedByUserId`).
- **PENDING** → **EXPIRED**: Optional background or on-read: set when `expiresAt` is past; or leave status PENDING and reject at read time when `expiresAt < now`. Product may also explicitly set EXPIRED.
- **PENDING** → **CANCELLED**: Platform admin (or product) revokes the invite.

No other transitions (ACCEPTED/EXPIRED/CANCELLED are terminal).

### 6.2 Resolve (GET) — Status and HTTP Codes

- **No invite for token / invalid token:** Return **404** with `INVITE_NOT_FOUND` (or 410 to avoid leaking “token exists”; recommend **404** for “not found” and **410** for “known but unusable”).
- **Status ACCEPTED:** Return **410** `INVITE_ALREADY_ACCEPTED` — token is one-time use for resolve.
- **Status EXPIRED or CANCELLED:** Return **410** `INVITE_EXPIRED`.
- **expiresAt in past (status still PENDING):** Return **410** `INVITE_EXPIRED`.

### 6.3 Accept (POST) — Status and HTTP Codes

- **Invalid token / no invite:** **404** `INVITE_NOT_FOUND`.
- **Status EXPIRED or CANCELLED or expiresAt in past:** **410** `INVITE_EXPIRED`.
- **Status ACCEPTED:** If same user (authenticated) or same email (signup), **idempotent 200** with existing membership. If different user/email, **410** `INVITE_ALREADY_ACCEPTED` (invite already consumed).
- **Email mismatch (authenticated or signup):** **403** `INVITE_EMAIL_MISMATCH` (optionally with `fieldErrors.email`).

---

## 7. Summary Checklist

| Item | Spec |
|------|------|
| **Schema** | Optional `acceptedByUserId` on DealershipInvite; optional `emailNormalized`; token plain at rest, never logged. |
| **Username** | Email is identifier; fullName optional for display. |
| **Flow** | Option B: POST accept with token + email + password + fullName? (no auth); server creates user via Supabase Admin, Profile, membership, marks invite; client then signInWithPassword. |
| **GET resolve** | Optional `emailMasked` in response; 404/410/429; no PII/token in logs. |
| **POST accept** | Two shapes: (auth + token) or (token + email + password + fullName?); same success shape; fieldErrors for validation/email mismatch; 409 for already registered. |
| **Password** | Min 12 chars, 3/4 categories; validated client + server; rate limit per IP and per token. |
| **Dealership** | Never from client; always from invite.dealershipId. |
| **App** | Dealer app owns `/accept-invite` and `/api/invite/resolve`, `/api/invite/accept`. |

---

## 8. Error Codes Reference

| Code | HTTP | When |
|------|------|------|
| `INVITE_NOT_FOUND` | 404 | Token invalid or invite not found. |
| `INVITE_EXPIRED` | 410 | Invite expired, cancelled, or already accepted (for resolve). |
| `INVITE_ALREADY_ACCEPTED` | 410 | Invite already used (for accept when different user/email). |
| `INVITE_EMAIL_MISMATCH` | 403 | Submitted email does not match invite. |
| `VALIDATION_ERROR` | 400 | Zod or password policy failed; use `details.fieldErrors`. |
| `EMAIL_ALREADY_REGISTERED` | 409 | Signup path: Supabase reports user already exists. |
| `RATE_LIMITED` | 429 | Too many resolve or accept attempts. |

Existing codes `INVITE_MEMBERSHIP_EXISTS` (if used elsewhere) remain; this spec does not change them.

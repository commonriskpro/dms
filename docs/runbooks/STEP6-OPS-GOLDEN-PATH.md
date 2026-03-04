# Step 6 — Production Ops & Golden Path Hardening

**Scope:** Both apps (platform + dealer). Production-ready auth, golden path UX, audit usability, platform user invite by email, dealer invite/suspended/closed hardening.

**Reference rules:** Multi-tenant (dealership_id everywhere in dealer); RBAC on every route; Zod at edge (packages/contracts); pagination on all lists; audit append-only; no secrets in logs; portal isolation (platform and dealer auth/sessions separate; header-auth DEV ONLY).

---

## 1. Platform Auth (Production)

### 1.1 Confirmation

- **Production:** Platform MUST use **Supabase session only** for authentication.
  - `getPlatformUserIdFromRequest()` already branches: when `NODE_ENV === "production"`, it uses `createSupabaseServer().auth.getUser()` and does **not** read `x-platform-user-id` or cookies for auth.
- **Dev-only header/cookie auth:** Header and cookie dev-login flows MUST be gated by:
  - `NODE_ENV !== "production"` **AND**
  - `PLATFORM_USE_HEADER_AUTH === "true"`.
- **Guards to enforce:**
  - Any route or middleware that accepts header/cookie auth (e.g. dev-login, or code paths that read `x-platform-user-id`) must check both conditions. In production builds, these paths must be unreachable (compile-time where possible, runtime 404/refusal otherwise).
  - `/platform/dev-login`: Already returns 404 when `DEV_LOGIN_ENABLED` is false (i.e. production or when `PLATFORM_USE_HEADER_AUTH` is not set). Confirm no other dev-auth entrypoints exist and that production builds never enable header auth.

### 1.2 Bootstrap first owner (no SQL)

- **Existing:** `/platform/bootstrap` UI exists; POST `/api/platform/bootstrap` accepts `{ secret }`, requires an authenticated user (Supabase session in prod), and upserts `platform_users` with role `PLATFORM_OWNER` when secret matches `PLATFORM_BOOTSTRAP_SECRET`. No direct SQL run by operator.
- **Clarifications:**
  - Bootstrap MUST only run when the user is authenticated via the **same** auth path used in production (Supabase). So in production, user signs up/signs in via Supabase first, then visits `/platform/bootstrap` and submits the secret.
  - UI should make it clear: “You must be signed in. Enter the bootstrap secret to become the first platform owner.”
  - If bootstrap is disabled (no `PLATFORM_BOOTSTRAP_SECRET`), the page already shows “Bootstrap disabled” and does not expose a form.
- **Success on Vercel:**
  1. Set `PLATFORM_BOOTSTRAP_SECRET` in Vercel (e.g. a long random string). Do not commit it.
  2. Create a Supabase user (Auth → Users) or use sign-up on the platform app.
  3. Log in to the platform (Supabase session established).
  4. Open `https://<platform-vercel-url>/platform/bootstrap`, enter the secret, submit.
  5. Response: `{ success: true }`; user is now in `platform_users` as `PLATFORM_OWNER`. Subsequent visits to platform show full OWNER UI; no SQL required.

---

## 2. Golden Path UX Requirements

**Golden path:** Create application → Approve → Provision → Owner invite → Accept invite (dealer) → Later: Suspend → Closed.

### 2.1 Provision action

- **Idempotency key:**
  - Either generated client-side (e.g. UUID) and sent in request body, or returned by server on first attempt and reused. Current contract: client sends `idempotencyKey` in body.
  - UI must **show** the idempotency key used for the provision request (so support can correlate and retry safely).
- **RequestId:**
  - Server already generates a `requestId` (e.g. `provision-<id>-<ts>-<rand>`) and stores it in audit. Success and failure responses MUST **include** `requestId` in the JSON body so the UI can show it and the user can reference it.
- **On dealer-call failure:**
  - Show a **safe** error message (no internal details), include `requestId` and optionally `idempotencyKey`.
  - Next steps: “Retry with same idempotency key” (to avoid double provisioning).
  - Add a **“Retry Provision”** button that re-sends the same `idempotencyKey` (and shows the same key + requestId after retry).

### 2.2 Status changes (ACTIVE / SUSPENDED / CLOSED)

- **RequestId:**
  - Status change API should return `requestId` in the response (success and failure). Platform already generates and audits it; include it in the JSON so the UI can show it in a toast or status section.
- **Last failure state:**
  - When the dealer status call fails, platform already writes audit with `afterState: { status: <unchanged>, dealerCallFailed: true }`. UI should be able to show a “dealer call failed” indicator (e.g. from last audit entry or from a dedicated field) **without** exposing PII or internal errors.
  - Show only: e.g. “Last status change could not be applied at the dealer; platform status unchanged. RequestId: …”

---

## 3. Audit Log Usability

- **Filters (list):**
  - Add or confirm filters: **action**, **targetType**, **targetId**, **date range (start/end)**.
  - Existing API already supports `actor`, `action`, `targetType`, `targetId`, `dateFrom`, `dateTo`. Align UI and contracts with these (e.g. `dateFrom`/`dateTo` or `startDate`/`endDate` in contracts; keep pagination).
- **Detail view (single entry):**
  - Audit detail (GET `/api/platform/audit/[id]`) already returns `beforeState`, `afterState`, `requestId`, `idempotencyKey`, etc.
  - **Readable diff:** Show a readable diff of `beforeState` vs `afterState`:
    - Collapsible JSON sections (e.g. “Before” / “After”).
    - Highlight **changed keys** (minimal diff: which keys were added/removed/changed).
  - Must remain **paginated** for the list; detail is a single-record view.

---

## 4. Platform User Management — “Invite by email”

- **OWNER-only action:** Add the ability to invite a platform user **by email** using Supabase Admin invite (no manual UUID copy).
- **Flow:**
  - New endpoint: **POST /api/platform/users/invite**
  - Body: `{ email: string, role?: PlatformRole }` (Zod-validated via contracts). Default role e.g. `PLATFORM_SUPPORT` if omitted.
  - **Server-only:** Uses Supabase Admin API (service role key) to send an invite to the email. Never expose the service role key to the client.
  - After invite (or if user already exists): ensure a row in `platform_users` with the correct role (upsert by Supabase user id once known). If inviting: Supabase returns or we get the user id after they accept; implementation may create/update `platform_users` when the user first signs in, or when invite is sent if Supabase provides the invited user id.
- **Dedupe / safety:**
  - If the user already exists in `platform_users`: allow **role update** only; do not send another invite (do not spam). Return a clear message (e.g. “User already exists; role updated”).
  - If invite was already sent and pending: same email may be handled with “Invite already sent” or role update as appropriate.
- **Audit:**
  - Log an audit entry e.g. `platform.user_invited` with **recipientHash** only (e.g. hash of email for correlation), **no plaintext email** in audit. Store targetType/targetId as appropriate (e.g. targetType `platform_user`, targetId the user id when available).
- **Security:** All Supabase Admin calls and service role usage must be server-side only; no client-side exposure.

---

## 5. Dealer Portal Hardening

### 5.1 Accept-invite page

- **Expired token:**
  - When resolve or accept returns an error indicating **expired** (e.g. `GONE` or dedicated code): show a clear message, e.g. “This invite has expired.” and a CTA: “Request a new invite from your platform administrator.”
- **Already accepted:**
  - When the invite was already used: show message, e.g. “This invite has already been used.” and CTA: “Sign in to access your dealership.”
- **User already has membership:**
  - When the user already has an active membership for that dealership: show message, e.g. “You already have access to this dealership.” and CTA: “Go to dashboard” (or “Sign in” if not authenticated).
- **Structured error codes:** Backend should return **structured error codes** (e.g. `INVITE_EXPIRED`, `INVITE_ALREADY_ACCEPTED`, `INVITE_MEMBERSHIP_EXISTS` or equivalent) so the UI can branch and show the right message and CTA. Current implementation uses `GONE` / `NOT_FOUND`; extend or map to distinct codes for the three cases above where feasible.
- **Paste UX:** Accept URL or token paste flow remains supported (e.g. user pastes full `accept-invite?token=…` or raw token).

### 5.2 Suspended coverage

- **Mutation entrypoints:** Ensure **all** high-impact mutation paths are covered:
  - Uploads (e.g. document/file upload), deletes, bulk actions, inline edits.
- **Guard:** Use a central guard (e.g. `MutationButton` / `WriteGuard` or equivalent) so that when the tenant is **SUSPENDED**, writes are disabled and the user sees a consistent state (e.g. disabled buttons with tooltip “Dealership is suspended”).
- **Backend returns TENANT_SUSPENDED:** If a write is attempted and the backend returns 403 with code `TENANT_SUSPENDED`:
  - Show a **single** toast (dedupe so the same user does not get spammed); message e.g. “This dealership is suspended; changes are not allowed.”
  - Disable or keep disabled the relevant UI so the user cannot repeatedly trigger the same error.

### 5.3 Closed dealership UX

- **Reason:** When the dealership is **CLOSED**, show a reason if available (e.g. “Closed by platform: &lt;reason&gt;”) **without** leaking platform-only or internal data. Use a field already exposed to the dealer (e.g. `lastStatusReason` or equivalent in session/API) if present.
- **CTAs:**
  - “Switch dealership” (if the user has other dealerships).
  - “Contact support” (link or text).
- **Optional:** “Request export” as a placeholder (no implementation required in this step; just a clear CTA or disabled button with “Request data export” for future use).

---

## 6. Test Plan (high level)

- **Platform**
  - Auth: In production build, dev-login and header-auth paths are 404 or disabled; bootstrap requires Supabase-authenticated user.
  - Provision: Retry with same idempotency key returns consistent result; success and failure responses include `requestId` (and idempotency key where applicable).
  - Audit: List supports filters (action, targetType, targetId, date range); detail returns full entry for diff; pagination intact.
  - Invite: POST `/api/platform/users/invite` — 403 for non-OWNER before any Supabase call; 200 with dedupe/role-update behavior; audit has no plaintext email.
- **Dealer**
  - Invite accept: Resolve/accept return distinct error codes for expired / already accepted / membership exists; accept page shows correct message and CTA for each.
  - Suspended: A write attempt (e.g. submit form, delete) returns 403 TENANT_SUSPENDED; UI shows one toast and disables or guards the action.
  - Closed: Session or API exposes reason when closed; UI shows reason and CTAs (switch dealership, contact support).
- **Deterministic:** Prefer stable ids and mocked time/network in tests so they are deterministic.

---

## 7. Deployed-only checklist

Use this after deploying to Vercel to verify the golden path and ops flow.

1. **Bootstrap owner**
   - [ ] Set `PLATFORM_BOOTSTRAP_SECRET` in platform Vercel env.
   - [ ] Sign up / sign in to platform via Supabase.
   - [ ] Open `/platform/bootstrap`, submit secret; confirm success and that user is OWNER.

2. **Create → Provision → Status**
   - [ ] Create an application, approve it.
   - [ ] Provision: confirm idempotency key and requestId are shown; on failure, confirm safe message and “Retry Provision” with same key.
   - [ ] Change status (e.g. to SUSPENDED, then CLOSED); confirm requestId in response and, if dealer call failed, “dealer call failed” indicator without PII.

3. **Owner invite + accept**
   - [ ] From platform, send owner invite to an email.
   - [ ] In dealer, open accept-invite link (or paste token); accept with matching email; confirm membership and redirect.
   - [ ] Test expired / already accepted / already has membership: confirm clear messages and CTAs.

4. **Audit**
   - [ ] Use filters: action, targetType, targetId, date range; confirm results and pagination.
   - [ ] Open an audit detail; confirm collapsible before/after and highlighted changed keys.

5. **Invite platform user by email**
   - [ ] As OWNER, use “Invite platform user” with email + role; confirm invite sent (or “already exists” / role updated).
   - [ ] Confirm new user can sign in and has the assigned role; confirm audit does not contain plaintext email.

6. **Dealer suspended/closed**
   - [ ] With a suspended dealership, attempt a write (e.g. edit, delete); confirm single toast and disabled/guarded UI.
   - [ ] With a closed dealership, confirm reason (if any) and CTAs (switch dealership, contact support).

---

**End of Step 6 spec.** Implement in Steps 2–4 (backend, frontend, security/QA) per the main instructions.

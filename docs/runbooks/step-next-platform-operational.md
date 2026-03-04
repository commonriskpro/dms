# Step Next: Platform Operational (Vercel + Supabase Only)

## Goal

Make both apps production-operational from Vercel + Supabase only—no local-only setup. Platform and Dealer remain isolated (separate Supabase projects/keys, separate Prisma clients). Platform never connects to dealer DB. All contracts via `@dms/contracts`, RBAC before lookup, audit append-only for platform mutations; dealer audits internal API calls. Tenant lifecycle: dealer blocks writes on SUSPENDED; blocks read+write on CLOSED; job worker skips non-ACTIVE.

---

## 1. Platform auth design (Supabase login for platform users)

- **Identity**: Platform users sign in via **Supabase Auth** (platform app’s own Supabase project). No shared auth with dealer.
- **Authorization**: After sign-in, platform checks **platform_users** (platform DB): user must have a row with role `PLATFORM_OWNER` | `PLATFORM_COMPLIANCE` | `PLATFORM_SUPPORT`. If Supabase user exists but not in `platform_users` → "Not authorized" (403) and sign-out option.
- **Resolving user in requests**:
  - **Production**: `getPlatformUserIdFromRequest()` uses **Supabase session only** (no header auth). Session from cookies (Supabase client).
  - **Development**: When `PLATFORM_USE_HEADER_AUTH=true`, allow `X-Platform-User-Id` header or dev cookie for local testing without Supabase.
- **Login UI**: `/platform/login` — email/password and magic link (existing). Redirect to `/platform` after success.
- **Protected routes**: All `/platform/*` except `/platform/login` and `/platform/auth/callback` require authenticated session + row in `platform_users`. Unauthenticated → redirect to `/platform/login`.
- **Sign out**: Call Supabase `signOut` and redirect to `/platform/login`; use `/api/platform/auth/logout` for server-side session clear if needed.

---

## 2. Platform owner bootstrap (Vercel-only)

- **Option A (recommended): One-time bootstrap route**
  - **Route**: `GET /platform/bootstrap?secret=<PLATFORM_BOOTSTRAP_SECRET>` (or POST with secret in body/header to avoid logging).
  - **Guard**: Only enabled when env `PLATFORM_BOOTSTRAP_SECRET` is set and request secret matches. Allowed in production (`NODE_ENV=production`) but strictly guarded by secret.
  - **Behavior**: User must be **authenticated via Supabase** (session exists). Route creates or updates a row in `platform_users` for the **current Supabase user ID** with role `PLATFORM_OWNER`. Idempotent (upsert by id).
  - **Audit**: Write platform audit `platform.owner_bootstrap` with `actorPlatformUserId` = that user id, `targetType` = `platform_user`, `targetId` = user id.
  - **Response**: Success message; redirect to `/platform` or show "You are now platform owner".
  - **Security**: Remove or disable bootstrap after first use (e.g. only allow if no PLATFORM_OWNER exists yet), or keep for recovery with strong secret and short-lived use.

- **Option B (scriptless)**: Documented flow: (1) Deploy platform; (2) Create a user in Supabase Auth (sign up or invite); (3) Run one-time SQL on platform DB: `INSERT INTO platform_users (id, role) VALUES ('<supabase-user-uuid>', 'PLATFORM_OWNER');`. No bootstrap route.

- **Spec choice**: Implement **Option A** with bootstrap route; document that after first owner is created, optionally unset `PLATFORM_BOOTSTRAP_SECRET` to disable further bootstrap.

---

## 3. Dealer owner invite flow

- **Trigger**: Platform user (PLATFORM_OWNER) from **Dealership detail** clicks "Send Owner Invite", enters email, submits.
- **Platform**:
  - `POST /api/platform/dealerships/[id]/owner-invite` (Owner only).
  - Validates body with Zod (`platformOwnerInviteRequestSchema`: `email`).
  - Requires mapping exists (dealership provisioned → `dealerDealershipId`).
  - Calls **dealer internal** `POST /api/internal/dealerships/{dealerDealershipId}/owner-invite` with JWT, `Idempotency-Key`, body: `{ email, platformDealershipId, platformActorId }`.
  - Writes platform audit `dealership.owner_invite.sent` with requestId/idempotencyKey.
- **Dealer internal**:
  - `POST /api/internal/dealerships/{dealerDealershipId}/owner-invite`: JWT service-to-service auth (same as provision/status), rate-limited.
  - Request body (Zod): `email`, `platformDealershipId`, `platformActorId`.
  - Side effects (dealer DB only): create invite row for that email and dealership with **Owner** role (idempotent by Idempotency-Key); no PII in audit (redact email or hash in metadata).
  - **Response**: `{ inviteId, invitedEmail, createdAt, acceptUrl }` where `acceptUrl` = `${DEALER_APP_PUBLIC_URL}/accept-invite?token=<invite_token>`. So dealer returns the one-time link for platform to show "Copy link to send to invitee" (no email sending required yet).
  - Audit: dealer writes `platform.owner_invite.created` (metadata: inviteId, platformDealershipId, platformActorId, idempotencyKey — no email).

- **Accept flow (dealer)**: Invitee opens `acceptUrl` → `/accept-invite?token=...` → resolve token → sign in or sign up → accept invite → membership created with Owner role → redirect to dashboard. Existing flow; ensure token in URL is the only required input when link is used.

---

## 4. Exact UI buttons to add

- **Dealership detail** (`/platform/dealerships/[id]`):
  - **"Send Owner Invite"** (Owner only). Opens modal: email input. Submit → `POST /api/platform/dealerships/[id]/owner-invite`. On success: show `acceptUrl` for copy (and optionally inviteId). Toast "Owner invite sent".
  - (Already present from previous work; ensure it shows acceptUrl when returned.)

- **Dealerships list** (`/platform/dealerships`):
  - **"New Dealership"** (Owner only). Opens modal form: legalName, displayName, planKey (default e.g. "starter"), optional limits. Submit → `POST /api/platform/dealerships` → toast "Dealership created" + refresh list. New row appears; user can then open it → Provision → Send Owner Invite.

- **Platform Ops UX (Subagent B)**:
  - **Audit Logs**: Add quick filter by targetId (e.g. platformDealershipId); add "jump to dealership" link on each row when targetType = dealership (link to `/platform/dealerships/[targetId]`).
  - **Empty states**: Dealerships list empty state: "No dealerships yet. Create one to get started." with primary action "New Dealership". Applications list empty state: similar friendly message.

---

## 5. API routes to add/verify + payloads + audits

| Route | Method | Who | Payload / Notes | Audit |
|-------|--------|-----|------------------|-------|
| `/platform/bootstrap` | GET (or POST) | Authenticated + secret | Query/body: `secret` = PLATFORM_BOOTSTRAP_SECRET | `platform.owner_bootstrap` |
| `/api/platform/dealerships` | POST | PLATFORM_OWNER | Body: legalName, displayName, planKey, limits? (Zod). Creates PlatformDealership with status APPROVED. | `dealership.created` |
| `/api/platform/dealerships` | GET | Owner, Compliance, Support | Existing list (paginated). | — |
| `/api/platform/dealerships/[id]` | GET | Owner, Compliance, Support | Existing. | — |
| `/api/platform/dealerships/[id]/provision` | POST | PLATFORM_OWNER | Existing (idempotencyKey). | Existing |
| `/api/platform/dealerships/[id]/status` | POST | PLATFORM_OWNER | Existing. | Existing |
| `/api/platform/dealerships/[id]/owner-invite` | POST | PLATFORM_OWNER | Body: { email }. Existing; ensure platform shows acceptUrl from dealer response. | `dealership.owner_invite.sent` |
| Dealer: `/api/internal/dealerships/[dealerDealershipId]/owner-invite` | POST | JWT | Body: email, platformDealershipId, platformActorId. Idempotency-Key header. Response: inviteId, invitedEmail, createdAt, **acceptUrl**. | `platform.owner_invite.created` (no PII) |

- **Contracts**: Add `acceptUrl` to dealer owner-invite response schema in `@dms/contracts`. Platform owner-invite response may include `acceptUrl` when returned from dealer.

---

## 6. Test plan (platform + dealer) and deployed-only manual checklist

### Automated tests

- **Platform**: RBAC tests for POST `/api/platform/dealerships` (403 for non-Owner before DB); RBAC for owner-invite (403 before lookup). Bootstrap: 401 without auth; 403 with wrong secret; 200 with valid auth + secret and upserts owner.
- **Dealer**: Internal owner-invite: 401 without JWT; 422 without Idempotency-Key; 201 creates invite and audit row; response includes acceptUrl.
- **UI (minimal)**: Platform login page renders; platform dealership detail shows "Send Owner Invite" and "New Dealership" (list) for Owner role only when mocked.

### Deployed-only manual runbook

1. **Login platform**: Open platform URL → redirect to `/platform/login` → sign in with Supabase (email/password or magic link) → land on `/platform`.
2. **Bootstrap owner (once)**: Visit `/platform/bootstrap?secret=<PLATFORM_BOOTSTRAP_SECRET>` while signed in → success → you are PLATFORM_OWNER. Optionally unset secret afterward.
3. **Create dealership**: Dealerships → "New Dealership" → fill legalName, displayName, planKey → Create → toast + new row.
4. **Provision**: Open new dealership → Provision (idempotencyKey) → success; dealerDealershipId shown.
5. **Send owner invite**: Same dealership → "Send Owner Invite" → email → Send → copy acceptUrl shown; platform audit "dealership.owner_invite.sent", dealer audit "platform.owner_invite.created".
6. **Accept invite (dealer)**: Open acceptUrl in new browser/incognito → resolve → sign in or sign up → Accept → redirect to dealer dashboard; verify lifecycle UI (dealership name + badge).
7. **Suspend from platform**: Platform → dealership → Suspend (reason) → in dealer app verify read-only (banner, writes disabled).
8. **Close from platform**: Platform → dealership → Close (reason) → in dealer app verify redirect to `/closed` and "Switch dealership" / "Contact support".

---

## 10. Deployed-only manual runbook (quick copy)

1. **Login platform**: Open platform URL → redirect to `/platform/login` → sign in (Supabase).
2. **Bootstrap owner (once)**: Set `PLATFORM_BOOTSTRAP_SECRET` in Vercel. Visit `/platform/bootstrap` while signed in → enter secret → submit → you are PLATFORM_OWNER. Optionally unset secret after.
3. **Create dealership**: Dealerships → "New Dealership" → legal name, display name, plan (e.g. starter) → Create.
4. **Provision**: Open that dealership → Provision (idempotency key sent) → success.
5. **Send owner invite**: Same dealership → "Send Owner Invite" → email → Send → copy acceptUrl and send to invitee.
6. **Accept invite (dealer)**: Open acceptUrl (or dealer `/accept-invite` and paste link/token) → resolve → sign in/sign up → Accept → dealer dashboard; verify lifecycle badge.
7. **Suspend**: Platform → dealership → Suspend (reason) → in dealer verify read-only banner and disabled writes.
8. **Close**: Platform → dealership → Close (reason) → in dealer verify `/closed` and "Switch dealership" / "Contact support".

---

## 7. Env vars (to document)

- **Platform**: `PLATFORM_BOOTSTRAP_SECRET` (optional; when set, enables `/platform/bootstrap` when secret matches). `PLATFORM_USE_HEADER_AUTH` (dev only). Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or session keys per Supabase docs. `DEALER_INTERNAL_API_URL`, `INTERNAL_API_JWT_SECRET` for calling dealer.
- **Dealer**: `INTERNAL_API_JWT_SECRET`, `DEALER_INTERNAL_API_URL` (if used). For acceptUrl: `NEXT_PUBLIC_APP_URL` or equivalent public dealer app URL.
- **Invite**: No extra env for invite flow; acceptUrl uses dealer’s public URL.

---

## 8. Dealer UX (accept-invite, SUSPENDED reason, WriteGuard)

- **Accept-invite**: Ensure `/accept-invite` works end-to-end: paste token/link → resolve → accept → login → select dealership. If token is only in URL (from acceptUrl), no paste needed; else add simple "Paste invite link or token" input when no `?token=` in URL.
- **SUSPENDED reason**: If dealer stores `lastStatusReason` (or equivalent) when status is set to SUSPENDED, show it in the suspended banner or "Learn more" dialog. Otherwise show generic "Read-only mode" message.
- **WriteGuard / MutationButton**: Ensure write controls use WriteGuard or MutationButton in top-level modules: customers, deals, inventory, documents, crm. Audit existing usage; add where create/edit/delete/upload buttons exist.

---

## 9. Audit requirements summary

- **Platform**: All mutations write to platform_audit_log: `platform.owner_bootstrap`, `dealership.created`, `dealership.owner_invite.sent`, existing provision/status/application actions. Append-only; include actorPlatformUserId, action, targetType, targetId, beforeState/afterState, reason/requestId/idempotencyKey where relevant.
- **Dealer**: Internal API calls (provision, status, owner-invite) already audited; dealer audit for owner-invite has no PII in metadata.

# Portal Split — Next Missing Work: Final Summary

## Tracks completed

### Track A — Platform real auth (production)

- **A1** `PLATFORM_USE_HEADER_AUTH` is only honored when `NODE_ENV !== "production"`. In production, `requirePlatformAuth()` uses Supabase session only (cookie-based).
- **A2** `/platform/login` page (password + magic link), `GET /api/platform/auth/logout`, `GET /api/platform/auth/callback` (magic link exchange). Layout redirects unauthenticated users to `/platform/login` via `PlatformAuthRedirect`.
- **A3** `platform_users` remains the RBAC source. If the authed Supabase user is not in `platform_users`, layout shows a 403 “Not authorized” page with sign-out link.
- **A4** Vitest: `lib/platform-auth.test.ts` — 401 when no user, 403 when user not in platform_users, 200 when in platform_users.
- **A5** `cd apps/platform && npm run test && npm run build` — pass.

**Files changed:** `apps/platform/lib/platform-auth.ts`, `apps/platform/lib/supabase/server.ts` (new), `apps/platform/lib/supabase/browser.ts` (new), `apps/platform/app/(platform)/layout.tsx`, `apps/platform/app/(platform)/platform/login/page.tsx` (new), `apps/platform/app/(platform)/platform-shell.tsx`, `apps/platform/app/api/platform/auth/callback/route.ts` (new), `apps/platform/app/api/platform/auth/logout/route.ts` (new), `apps/platform/components/platform-auth-redirect.tsx` (new), `apps/platform/app/(platform)/platform/dev-login/route.ts`, `apps/platform/lib/platform-auth.test.ts` (new), `apps/platform/package.json` (@supabase/ssr).

---

### Track B — Owner bootstrap (platform → dealer owner invite)

- **B1** Contracts: `packages/contracts/src/internal/owner-invite.ts` (dealer request/response), `packages/contracts/src/platform/dealerships.ts` (platform owner-invite request/response).
- **B2** Dealer: `POST /api/internal/dealerships/[dealerDealershipId]/owner-invite` — JWT + rate limit, Zod validation, Idempotency-Key, creates/finds invite with Owner role, writes dealer audit `platform.owner_invite.created`, returns inviteId/invitedEmail/createdAt. New table `OwnerInviteIdempotency`; new `getRoleByName` in role db.
- **B3** Platform: `POST /api/platform/dealerships/[id]/owner-invite` — PLATFORM_OWNER only, mapping lookup, calls dealer internal API, writes platform audit `dealership.owner_invite.sent`.
- **B4** Platform UI: “Send Owner Invite” on dealership detail (when provisioned), modal with email, success toast with inviteId.
- **B5** Tests: dealer `tests/portal-split/owner-invite-internal.test.ts` (401 without JWT, 422 without Idempotency-Key); platform `app/api/platform/dealerships/[id]/owner-invite/route.rbac.test.ts` (403 for non-owner, 201 + audit for owner).

**Files changed:** `packages/contracts` (owner-invite + platform schemas), `apps/dealer/prisma/schema.prisma` + migration `20260302000001_owner_invite_idempotency`, `apps/dealer/modules/core-platform/db/role.ts`, `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts` (new), `apps/platform/lib/call-dealer-internal.ts`, `apps/platform/app/api/platform/dealerships/[id]/owner-invite/route.ts` (new), `apps/platform/app/(platform)/platform/dealerships/[id]/page.tsx`.

---

### Track C — Platform audit logs (API + UI)

- **C1** `GET /api/platform/audit` — limit/offset, filters: actor, action (contains), targetId, dateFrom, dateTo. Zod in `packages/contracts/src/platform/audit.ts`. RBAC: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT. Response: `{ data, meta: { limit, offset, total } }`.
- **C2** `/platform/audit` page — filter bar, table (createdAt, actor, action, targetType, targetId), row click opens detail dialog (beforeState/afterState/reason/requestId/idempotencyKey).
- **C3** Tests: `app/api/platform/audit/route.test.ts` — 401 unauthed, 403 wrong role, 200 with data and meta.

**Files changed:** `packages/contracts/src/platform/audit.ts` (new), `packages/contracts/src/index.ts`, `apps/platform/app/api/platform/audit/route.ts` (new), `apps/platform/app/(platform)/platform/audit/page.tsx`, `apps/platform/app/api/platform/audit/route.test.ts` (new).

---

### Track D — Dealer first-run invite accept UX

- **D1** Accept-invite flow unchanged: `/accept-invite?token=...`, resolve → accept → session switch → redirect to `/dashboard`. Handles 410 (expired/cancelled/already accepted) and 404.
- **D2** Welcome card on dashboard when `activeDealership` is set: dealership name, lifecycle status, “Invite teammates” link to `/admin/users` (if `admin.memberships.read`).
- **D3** Existing tests in `platform-admin-create-account.test.ts` cover accept → membership with invite roleId and 410 for already-accepted token.

**Files changed:** `apps/dealer/app/dashboard/page.tsx`.

---

## Verification commands

- **Dealer:**  
  `npm run test:dealer`  
  `npm run build:dealer`  
  `npm run test:portal-split` (includes owner-invite internal tests)
- **Platform:**  
  `cd apps/platform && npm run test`  
  `cd apps/platform && npm run build`
- **Contracts:**  
  `cd packages/contracts && npm run build`

## Docs updated

- `docs/runbooks/deploy.md` — Platform auth (production Supabase only), `DEALER_INTERNAL_API_URL`, `INTERNAL_API_JWT_SECRET`, owner invite flow.
- `docs/runbooks/local-dev.md` — Platform dev login (header auth), seeding a PLATFORM_OWNER.

## TODOs / follow-ups

- **Dealer migration:** Run `npm run db:migrate` (or from `apps/dealer` with `DATABASE_URL`) to apply `20260302000001_owner_invite_idempotency` on dealer DB.
- **Platform audit test:** The audit route test mocks `@dms/contracts` `platformAuditQuerySchema` so the test doesn’t depend on built contracts in the runner; production build uses the real schema.
- **Manual smoke:** After deploy: platform login (prod auth), send owner invite from dealership detail, accept invite in dealer portal, confirm audit log entries for provision/status/owner_invite.

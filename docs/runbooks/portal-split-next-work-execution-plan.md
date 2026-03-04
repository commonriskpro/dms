# Portal Split — Next Missing Work: Execution Plan

## Parallel tracks (minimal file overlap)

| Track | Scope | Key files | Conflicts |
|-------|--------|-----------|-----------|
| **A** | Platform real auth | `lib/platform-auth.ts`, `app/(platform)/layout.tsx`, login page, logout API, platform-shell (sign out link) | Layout only with C (audit link exists). |
| **B** | Owner bootstrap | `packages/contracts`, dealer `api/internal/dealerships/[id]/owner-invite`, platform `api/platform/dealerships/[id]/owner-invite`, dealership detail page | None. |
| **C** | Platform audit API + UI | `packages/contracts` (audit query), `api/platform/audit/route.ts`, `platform/audit/page.tsx` | None. |
| **D** | Dealer invite accept UX | `app/accept-invite/page.tsx`, dashboard/welcome card, tests | None. |

## Track A — Platform real auth

- **A1** Restrict header auth: In `platform-auth.ts`, honor `PLATFORM_USE_HEADER_AUTH` only when `NODE_ENV !== "production"`. In production, resolve user from Supabase session only.
- **A2** Add `/platform/login` (Supabase magic link or password), `POST /api/platform/auth/logout`, redirect unauthenticated to `/platform/login` in layout/shell.
- **A3** Keep `platform_users` as RBAC source; on login/lookup, if Supabase user not in `platform_users` → 403 "Not authorized".
- **A4** Vitest: requirePlatformAuth 401/403/200.
- **A5** Verify: `cd apps/platform && npm run test && npm run build`.

## Track B — Owner bootstrap

- **B1** Contracts: owner-invite request/response schemas (dealer internal + platform).
- **B2** Dealer: `POST /api/internal/dealerships/[dealerDealershipId]/owner-invite` (JWT, rate limit, Zod, idempotency, audit).
- **B3** Platform: `POST /api/platform/dealerships/[id]/owner-invite` (PLATFORM_OWNER, mapping lookup, call dealer, platform audit).
- **B4** Platform UI: "Send Owner Invite" on dealership detail, modal with email.
- **B5** Tests: dealer JWT/idempotency; platform 403 + audit.
- **B6** Verify: dealer portal-split tests, platform tests.

## Track C — Platform audit logs

- **C1** `GET /api/platform/audit` with limit/offset and filters (actor, action, targetId, dateFrom, dateTo); Zod in contracts; RBAC OWNER/COMPLIANCE/SUPPORT.
- **C2** Replace audit placeholder: filter bar, table, detail drawer (beforeState/afterState/reason/requestId/idempotencyKey).
- **C3** Tests: RBAC 401/403/200, pagination.
- **C4** Verify: platform test + build.

## Track D — Dealer invite accept UX

- **D1** Confirm accept-invite route and post-accept flow (membership, redirect to dashboard/selection).
- **D2** Welcome/Setup card after first login (dealership name, lifecycle, link to invite teammates).
- **D3** Tests: accept creates membership with invite roleId; token reuse → 410.
- **D4** Verify: test:dealer, build:dealer.

## Shared file strategy

- **packages/contracts**: B adds owner-invite schemas; C adds audit query schema. Separate files → no conflict.
- **apps/platform layout**: A adds redirect to login when unauthenticated. C doesn’t change layout.
- **docs/runbooks**: Updated once at end (deploy.md, local-dev.md).

## Verification order

1. Implement A, B, C, D (parallelizable by file set).
2. `npm run build:dealer` and `npm run build:platform`.
3. `npm run test:portal-split` and `npm run test:platform`.
4. Manual smoke: platform login, owner invite, dealer accept, audit list.

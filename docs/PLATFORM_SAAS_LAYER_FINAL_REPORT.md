# Platform SaaS Layer — Final Report

## 1. Repo inspection summary

- **apps/platform**: Next.js App Router app with its own Prisma schema and DB. Already had `PlatformUser`, `Application`, `PlatformDealership`, `DealershipMapping`, `PlatformAuditLog`. Auth via `requirePlatformAuth()` and `requirePlatformRole()` (e.g. PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT). Existing routes: GET/POST dealerships, GET/PATCH dealerships/[id], POST dealerships/[id]/status, dashboard, applications, users, monitoring, audit.
- **apps/dealer**: Dealer app; tenant model uses `dealershipId` from session. No changes to dealer app for this sprint; tenant isolation unchanged.
- **packages/contracts**: Shared types; no new platform-specific contracts added for this sprint.
- **modules/auth / modules/admin**: Dealer-side; not used by platform. Platform uses `lib/platform-auth.ts` and platform DB.

Current tenant model: dealer app scopes all business data by `dealershipId` (session); platform app manages dealerships and platform-only data; no dealer tenant data stored in platform DB.

---

## 2. STEP 1 — Spec

- **Document**: `docs/PLATFORM_SAAS_LAYER_SPEC.md`
- **Contents**: Architecture overview, platform data model (PlatformAccount, extended PlatformDealership, Subscription), API endpoints, service layer plan, UI plan, RBAC matrix, audit events, acceptance criteria.

---

## 3. STEP 2 — Backend

### Migration

- **File**: `apps/platform/prisma/migrations/20260308120000_platform_saas_layer/migration.sql`
- **Changes**:
  - New table `platform_accounts` (id, name, email, status, createdAt, updatedAt).
  - New table `platform_subscriptions` (id, dealership_id, plan, billing_status, billing_provider, billing_customer_id, billing_subscription_id, current_period_end, createdAt, updatedAt) with unique(dealership_id), indexes on dealership_id and billing_status.
  - `platform_dealerships`: added `platform_account_id` (nullable FK), `slug` (nullable unique).

### DB layer

- **lib/db/accounts.ts**: `createPlatformAccount`, `listAccounts`, `getAccountById`.
- **lib/db/dealerships.ts**: (existing) extended for slug/platformAccountId where needed; `getDealershipBySlug`, `listDealerships` used by services.
- **lib/db/subscriptions.ts**: `createSubscription`, `listSubscriptions`, `getSubscriptionById`, `getSubscriptionByDealershipId`, `updateSubscription`.

### Services

- **lib/service/accounts.ts**: `createPlatformAccount` (audit `platform.account_created`), `listAccounts`.
- **lib/service/dealerships.ts**: `activateDealership`, `suspendDealership` (audit `platform.dealership_suspended` etc.), `listDealerships`, `getDealershipBySlug`.
- **lib/service/subscriptions.ts**: `createSubscription` (audit `platform.subscription_created`), `updateSubscriptionStatus` (audit `platform.subscription_changed`), `changeSubscriptionPlan`, `getPlatformStats` (totalDealerships, activeDealerships, totalSubscriptions, activeSubscriptions, trialSubscriptions, monthlyRevenueEstimate).

### API routes

- **POST/GET** `/api/platform/accounts` — create platform account (PLATFORM_OWNER), list with limit/offset/status.
- **POST/GET** `/api/platform/subscriptions` — create subscription (PLATFORM_OWNER), list with limit/offset/billingStatus.
- **PATCH** `/api/platform/subscriptions/[id]` — update plan, billingStatus, billing ids, currentPeriodEnd (PLATFORM_OWNER).
- **GET** `/api/platform/dashboard` — extended to include `activeSubscriptions`, `trialSubscriptions`, `monthlyRevenueEstimate` from `getPlatformStats()`.

Dealership create/list/status continue to use existing routes under `/api/platform/dealerships`.

### RBAC

- Platform routes use `requirePlatformAuth()` and `requirePlatformRole()` (PLATFORM_OWNER for POST/PATCH on accounts and subscriptions; PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT for GET and dashboard).
- Dealer app unchanged; continues to use dealershipId tenant isolation.

### Audit events

- `platform.account_created`
- `platform.dealership_suspended` (and activation where implemented)
- `platform.subscription_created`
- `platform.subscription_changed`

---

## 4. STEP 3 — Frontend

### Platform admin UI (apps/platform)

- **Nav**: Added "Accounts" and "Subscriptions" to `platform-shell.tsx` nav.
- **/platform/accounts** (`app/(platform)/platform/accounts/page.tsx`): List platform accounts with status filter and pagination (limit 25). "Create account" dialog (name, email, status). Loading, empty, and error states. PLATFORM_OWNER sees create button.
- **/platform/subscriptions** (`app/(platform)/platform/subscriptions/page.tsx`): List subscriptions with billing status filter and pagination. Columns: dealership (link to detail), plan, billing status, period end, created. "Create subscription" (dealership select, plan, billing status). "Change plan" dialog (plan + billing status) calling PATCH subscriptions/[id]. Loading, empty, error states.
- **Platform dashboard** (`app/(platform)/platform/page.tsx`): New KPI cards when data present: Active subscriptions, Trial accounts, Monthly revenue (est.). Existing KPIs unchanged.

UI uses shadcn-style components (Card, Table, Button, Dialog, Select, Skeleton) and CSS variables. Server data fetched client-side via `platformFetch` with `platformUserId` for auth.

---

## 5. STEP 4 — Security & QA

### Tenant isolation

- **Dealer app**: No code changes. All dealer APIs continue to scope by `dealershipId` from auth context; no platform DB access from dealer.
- **Platform app**: All platform APIs use platform auth only; no dealershipId from client used for authorization. Subscription and account lists are platform-wide (no per-dealership scoping by design).

### RBAC verification

- Platform routes require platform session and appropriate role. Jest RBAC tests added (see below) confirm 403 when auth fails or role is insufficient, and that service/DB calls are not invoked when guard fails.

### Tests added (Jest)

- **app/api/platform/accounts/route.rbac.test.ts**: GET 403 when auth throws; GET 200 with allowed role; POST 403 when not PLATFORM_OWNER; POST 201 when PLATFORM_OWNER and valid body.
- **app/api/platform/subscriptions/route.rbac.test.ts**: GET 403 when auth throws; GET 200 with allowed role; POST 403 when not PLATFORM_OWNER; POST 201 when PLATFORM_OWNER and dealership has no subscription.
- **app/api/platform/subscriptions/[id]/route.rbac.test.ts**: PATCH 403 when not PLATFORM_OWNER; PATCH 200 when PLATFORM_OWNER and subscription exists.
- **app/api/platform/dashboard/route.test.ts**: Mocked `getPlatformStats`; assertion extended for `activeSubscriptions`, `trialSubscriptions`, `monthlyRevenueEstimate`.

### Commands run

- `npx prisma generate` (apps/platform) — success.
- `npm run test:platform` — all new RBAC and dashboard tests pass. (One pre-existing failure: OnboardingStatusPanel.test.tsx due to missing `@testing-library/dom`; unrelated to this sprint.)

---

## 6. Performance

- **Pagination**: Accounts and subscriptions list APIs use `limit` (default 25, max 100) and `offset`.
- **Indexes**: Migration adds indexes on `platform_subscriptions.dealership_id`, `platform_subscriptions.billing_status`; `platform_dealerships.slug` unique; `platform_accounts` status as needed.
- **Dashboard**: Single GET; KPIs and stats fetched in parallel via `Promise.all` including `getPlatformStats()`. No N+1.

---

## 7. Known risks and follow-up improvements

### Known risks

- **PlatformAccount ↔ PlatformDealership**: Optional `platformAccountId` on dealerships; no mandatory link yet. Linking existing dealerships to accounts and enforcing “dealership belongs to one account” can be a follow-up.
- **Billing provider integration**: Fields (billingProvider, billingCustomerId, billingSubscriptionId) are stored but no Stripe (or other) integration; revenue estimate is plan-based only.
- **Dealer “plan” vs Subscription**: Dealership has `planKey`; Subscription has `plan` enum. Change-plan flow updates Subscription; optional sync to dealership planKey/limits can be added later.

### Follow-up improvements

- Enforce or encourage linking new dealerships to a PlatformAccount; UI to attach existing dealership to account.
- Add GET `/api/platform/accounts/[id]` and account detail page; list dealerships by account.
- Integrate billing provider (e.g. Stripe): webhooks, sync billing status and currentPeriodEnd.
- Optional: tenant isolation test in dealer app (assert no cross-tenant data in dealer APIs) as a regression suite.
- Run migration in target env: `npx prisma migrate deploy` (or `migrate dev`) in apps/platform when platform DB is available.

---

## Files created/updated (summary)

| Area        | Files |
|------------|-------|
| Spec       | docs/PLATFORM_SAAS_LAYER_SPEC.md |
| Migration  | apps/platform/prisma/migrations/20260308120000_platform_saas_layer/migration.sql |
| Schema     | apps/platform/prisma/schema.prisma (PlatformAccount, PlatformSubscription, Dealership fields) |
| DB         | apps/platform/lib/db/accounts.ts, dealerships.ts, subscriptions.ts |
| Service    | apps/platform/lib/service/accounts.ts, dealerships.ts, subscriptions.ts |
| API        | apps/platform/app/api/platform/accounts/route.ts, subscriptions/route.ts, subscriptions/[id]/route.ts, dashboard/route.ts |
| UI         | apps/platform/app/(platform)/platform-shell.tsx, platform/page.tsx, platform/accounts/page.tsx, platform/subscriptions/page.tsx |
| API client | apps/platform/lib/api-client.ts (AccountsListRes, SubscriptionsListRes, types) |
| Tests      | apps/platform/app/api/platform/accounts/route.rbac.test.ts, subscriptions/route.rbac.test.ts, subscriptions/[id]/route.rbac.test.ts, dashboard/route.test.ts (updated) |
| Report     | docs/PLATFORM_SAAS_LAYER_FINAL_REPORT.md (this file) |

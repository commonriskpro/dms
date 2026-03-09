# Platform SaaS Layer — Spec

## 1. Architecture overview

The DMS is multi-tenant with **dealershipId** as the tenant key in the dealer app. The **platform** app (apps/platform) manages dealerships, applications, and platform users via its own Prisma schema and DB.

This spec adds the **SaaS platform layer**: platform accounts (top-level customer/organization), subscription and billing tracking, and clear separation so the platform can onboard dealers, manage plans, and track billing.

- **Platform DB** (apps/platform/prisma): PlatformUser, Application, PlatformDealership, DealershipMapping, PlatformAuditLog. **New:** PlatformAccount, Subscription. **Extended:** PlatformDealership with optional platformAccountId and slug.
- **Dealer DB** (apps/dealer/prisma): Dealership (tenant) with platformDealershipId linking to platform. Tenant isolation remains; all dealer queries scoped by dealershipId from session. No platform data in dealer DB.
- **Platform routes**: require platform auth and role (PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT). Platform admin = PLATFORM_OWNER (and PLATFORM_COMPLIANCE for sensitive ops).
- **Dealer routes**: unchanged; continue to use dealershipId from context; no cross-tenant access.

---

## 2. Platform data model

### PlatformAccount (new)

Top-level account (company) that can own one or more dealerships.

| Field     | Type     | Notes |
|-----------|----------|-------|
| id        | UUID     | PK |
| name      | String   | Account/company name |
| email     | String   | Primary contact email |
| status    | String   | ACTIVE \| SUSPENDED (enum) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Indexes: status.

### PlatformDealership (existing, extended)

| Field              | Type     | Notes |
|--------------------|----------|-------|
| id                 | UUID     | PK |
| platformAccountId  | UUID?    | FK PlatformAccount (optional for backward compat) |
| legalName          | String   | existing |
| displayName        | String   | existing |
| slug               | String?  | unique, URL-safe identifier |
| planKey            | String   | existing (maps to plan) |
| limits             | Json?    | existing |
| status             | Enum     | existing (APPROVED, PROVISIONING, PROVISIONED, ACTIVE, SUSPENDED, CLOSED) |
| createdAt          | DateTime | |
| updatedAt          | DateTime | |

Existing enum PlatformDealershipStatus retained. slug and platformAccountId added.

### Subscription (new)

One per dealership (1:1 with PlatformDealership for billing).

| Field                   | Type     | Notes |
|-------------------------|----------|-------|
| id                      | UUID     | PK |
| dealershipId            | UUID     | FK PlatformDealership, unique |
| plan                    | Enum     | STARTER \| PRO \| ENTERPRISE |
| billingStatus           | Enum     | ACTIVE \| TRIAL \| PAST_DUE \| CANCELLED |
| billingProvider         | String?  | e.g. stripe |
| billingCustomerId       | String?  | provider customer id |
| billingSubscriptionId   | String?  | provider subscription id |
| currentPeriodEnd        | DateTime?| |
| createdAt               | DateTime | |
| updatedAt               | DateTime | |

Enums: SubscriptionPlan (STARTER, PRO, ENTERPRISE), BillingStatus (ACTIVE, TRIAL, PAST_DUE, CANCELLED). Indexes: dealershipId, billingStatus.

---

## 3. API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST   | /api/platform/accounts           | platform.admin | Create platform account |
| GET    | /api/platform/accounts           | platform.admin | List accounts (paginated) |
| POST   | /api/platform/dealerships        | platform.admin | Create dealership (existing) |
| GET    | /api/platform/dealerships        | platform.admin | List dealerships (existing) |
| PATCH  | /api/platform/dealerships/[id]  | platform.admin | Update dealership (existing; extend for status/plan) |
| POST   | /api/platform/subscriptions      | platform.admin | Create subscription for dealership |
| PATCH  | /api/platform/subscriptions/[id]| platform.admin | Update subscription (plan, billingStatus, period) |
| GET    | /api/platform/dashboard          | platform.admin | KPIs including trials, revenue estimate (extend existing) |

All platform routes require platform auth and appropriate role (PLATFORM_OWNER = platform.admin). Queries scoped to platform DB only; no dealer tenant data in platform.

---

## 4. Service layer plan

### modules/platform (or lib) — accounts

- **createPlatformAccount(name, email, status)** — Create PlatformAccount; audit platform.account_created.
- **listAccounts(limit, offset)** — Paginated list.

### dealerships

- **registerDealership** — Alias for existing create flow (create PlatformDealership APPROVED).
- **activateDealership(id)** — Set status ACTIVE; audit platform.dealership_activated.
- **suspendDealership(id)** — Set status SUSPENDED; audit platform.dealership_suspended.
- **changeSubscriptionPlan(dealershipId, plan)** — Update Subscription.plan (or create Subscription); audit platform.subscription_changed.

### subscriptions

- **createSubscription(dealershipId, plan, billingStatus, …)** — Create Subscription; audit platform.subscription_created.
- **updateSubscriptionStatus(id, billingStatus, currentPeriodEnd?, …)** — Update; audit platform.subscription_changed.
- **getPlatformStats()** — total dealerships, active subscriptions, trial count, revenue estimate (from plans × active count or subscription table).

---

## 5. UI plan

### Platform admin (apps/platform)

- **/platform/accounts** — List platform accounts; create account. Columns: name, email, status, created. Actions: view (future detail).
- **/platform/dealerships** — Existing; ensure actions: activate, suspend, change plan (wire to new subscription/status).
- **/platform/subscriptions** — List subscriptions. Columns: dealership name, plan, billing status, current period end. Actions: change plan, update status.
- **Platform dashboard** — Extend existing: total dealerships, active subscriptions, trial accounts, monthly revenue estimate (from getPlatformStats).

Server-first where possible; shadcn/ui; loading / empty / error states.

---

## 6. RBAC matrix

| Action              | Role / Permission   |
|---------------------|---------------------|
| Accounts CRUD        | PLATFORM_OWNER      |
| Dealerships CRUD    | PLATFORM_OWNER      |
| Subscriptions CRUD  | PLATFORM_OWNER      |
| Dashboard / list    | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT |
| Dealer app tenant   | Unchanged; dealershipId from session; platform.admin can impersonate |

---

## 7. Audit events

| Event                        | When |
|-----------------------------|------|
| platform.account_created    | Create PlatformAccount |
| platform.dealership_created  | Create PlatformDealership (existing) |
| platform.dealership_activated| activateDealership |
| platform.dealership_suspended| suspendDealership |
| platform.subscription_created| Create Subscription |
| platform.subscription_changed| Update subscription plan/status |

---

## 8. Acceptance criteria

- [ ] PlatformAccount can be created and listed (paginated).
- [ ] PlatformDealership can link to PlatformAccount (platformAccountId); slug optional.
- [ ] Subscription can be created per dealership; plan and billingStatus stored; currentPeriodEnd optional.
- [ ] activateDealership / suspendDealership update status and are audited.
- [ ] changeSubscriptionPlan updates (or creates) Subscription and is audited.
- [ ] Dashboard shows total dealerships, active subscriptions, trial accounts, revenue estimate.
- [ ] All platform routes require platform auth and role; dealer app tenant isolation unchanged.
- [ ] Pagination and indexes on dealershipId, platformAccountId, billingStatus.

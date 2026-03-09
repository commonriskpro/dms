# DMS Application Summary

> Superseded: canonical repository and feature documentation now lives in [`docs/canonical/INDEX.md`](./canonical/INDEX.md) and [`docs/canonical/FEATURE_MAP_CANONICAL.md`](./canonical/FEATURE_MAP_CANONICAL.md). This file is retained for historical reference and may drift from current code.

A single document summarizing **functions**, **QA approach**, **capabilities**, and **expected use flows** for the Dealer Management System (DMS) SaaS.

---

## 1. What the app is

- **Multi-tenant SaaS** for dealerships: each tenant is a **Dealership** with locations, users, and roles.
- **Modular monolith**: Core platform + modules (Customers, Inventory, Deals, Finance, Documents, Reports, CRM, Lender Integration, Platform Admin).
- **Auth**: Supabase Auth (email/password, magic link). Session includes active dealership and permissions (RBAC).
- **Non-negotiables**: Every business table has `dealership_id`; every route enforces permissions; all list endpoints paginate; audit log for critical actions; no raw card/SSN/DOB storage; OWASP-style protections.

---

## 2. Functions by module

| Module | Main functions |
|--------|-----------------|
| **Core platform** | Auth/session, active dealership switch, dealership settings, locations, members (invite/edit/disable), roles & permissions, audit log, file upload/signed URLs. |
| **Customers** | Customer CRUD, lead source/status/assignment, phones/emails (searchable), notes, tasks, activity timeline; lead action strip (call, email, SMS, schedule appointment, add task, disposition). |
| **Inventory** | Vehicle CRUD, VIN decode (NHTSA), vehicle photos (Supabase Storage), pricing/costs, status (AVAILABLE, HOLD, SOLD, etc.), locations, aging report. |
| **Deals** | Deal CRUD; link customer + vehicle; sale price, tax, doc fee, down payment; custom fees; one trade-in; status workflow (DRAFT → STRUCTURED → APPROVED → CONTRACTED \| CANCELED); totals and front gross; locked when CONTRACTED. |
| **Finance shell** | One finance record per deal: cash vs finance; term/APR/payment; backend products (GAP, VSC, etc.); amount financed, payment summary; status (DRAFT → STRUCTURED → … → CONTRACTED); locked when deal is CONTRACTED. |
| **Documents** | Deal jacket (and Customer/Vehicle): upload (PDF/images), list by entity, doc type/title/tags, signed URL for download, edit metadata, soft delete. |
| **Lender integration** | Lender directory (CRUD, soft-disable); per-deal finance application (applicants/co-applicants, no SSN/DOB in app); submissions with finance snapshot; status/decision/stipulations (with document linking), funding; FUNDED only when deal CONTRACTED. |
| **Reports** | Sales summary, sales by user, inventory aging, finance penetration, cash vs finance mix, pipeline/trend; date range; CSV export (sales, inventory); all tenant-scoped. |
| **CRM** | Pipelines & stages; opportunities (linked to customers); pipeline board; opportunity list/detail; automations (rules + triggers); sequences (templates + steps); job queue (run worker); journey bar on customer/opportunity. |
| **Platform admin** | Dealerships list/create/disable/enable/impersonate; pending users approve/reject; invites (create/resend/revoke); accept-invite flow (public resolve + auth accept). Platform routes require PlatformAdmin (DB-backed); no tenant scope for authorization. |

---

## 3. Capabilities (high level)

- **Multi-tenancy**: All data scoped by `dealership_id` from session; cross-tenant IDs return 404 (no existence leak).
- **RBAC**: Permissions per role (e.g. `customers.read`, `deals.write`, `finance.read`, `reports.export`). No undocumented admin bypass; 403 when permission missing.
- **Audit**: Append-only log for create/update/delete on critical entities and sensitive reads (e.g. document access); metadata sanitized (no PII/tokens).
- **Money**: BIGINT cents in DB; API string cents; BigInt-only math for finance; HALF_UP rounding; no float for persisted money.
- **Immutability**: Deal and finance locked when status = CONTRACTED; only status → CANCELED allowed for structure changes.
- **Security**: No SSN/DOB/income unless approved; no raw card data; signed URLs for files; rate limiting on auth and sensitive endpoints; validation (Zod) at API edge.
- **Global search**: Topbar search (customers, deals, inventory) when user has at least one of the relevant read permissions; tenant-isolated and permission-gated.

---

## 4. QA approach and capabilities

- **Manual smoke test**: `docs/MANUAL-SMOKE-TEST-CHECKLIST.md` — post-deploy and after major changes; covers auth, bootstrap, admin, files, tenant isolation, RBAC, and full UI smoke for each module (reports, dashboard, customers, inventory, deals, finance, documents, lenders, CRM, platform admin, global search).
- **Integration tests**: Run with `TEST_DATABASE_URL` set; `SKIP_INTEGRATION_TESTS=1` to skip DB-backed tests. Modules have tests for tenant isolation, RBAC, audit, validation, and key business rules (e.g. deals one-active-per-vehicle, finance CONTRACTED lock, CRM job claim/idempotency).
- **QA hardening skill** (`.cursor/skills/qa-hardening/`): Workflow for tenant isolation & RBAC, regression tests for key flows, PII in logs/responses, pagination on list endpoints, file upload validation and signed URLs, rate limiting; produces a QA checklist and “what was fixed” list.
- **Security**: `docs/SECURITY.md` documents tenant scoping, RBAC, platform admin, audit, file access, and module-specific guarantees (inventory, customers, deals, finance, CRM, lender, reports).

---

## 5. Expected use flows

### 5.1 First-time / onboarding

1. **Sign up** (or receive invite link).
2. **Invite-only**: Open `/accept-invite?token=...` → resolve (see dealership/role) → sign in/sign up → Accept → membership created → redirect to app with that dealership active.
3. **Self-serve**: Sign up → Pending approval → platform admin approves (dealership + role) or rejects → after approval, user can set active dealership and use app.
4. **Bootstrap (demo)**: With `ALLOW_BOOTSTRAP_LINK=1`, user with no dealership can “Link me as Owner” on Get Started → linked to demo dealership → redirect to admin/dealership.

### 5.2 Daily dealer use (by role)

- **Sales**
  - **Dashboard** (`/dashboard`): My tasks, new prospects, pipeline funnel, stale leads (when permissions allow).
  - **Customers** (`/customers`): List/create/edit customers; notes, tasks, activity; lead actions (call, email, SMS, appointment, disposition).
  - **CRM** (`/crm`, `/crm/opportunities`): Pipeline board; create/move opportunities; automations and sequences; jobs.
  - **Deals** (`/deals`): Create deal (customer + vehicle); structure (price, fees, trade); status workflow; when permitted, **Finance** tab (structure, products); **Documents** tab (upload/view); **Lenders** tab (application, submissions, stipulations, funding).
  - **Inventory** (`/inventory`): List/add/edit vehicles; VIN decode; photos; aging.
  - **Global search**: Find customer, deal, or vehicle from topbar.

- **Finance**
  - **Deals** → Deal detail → **Finance** tab: Set cash/finance, term/APR, products; payment summary; status.
  - **Deals** → **Lenders** tab: Application, create submission, track status/decision/stips, link documents, record funding (when deal CONTRACTED).
  - **Lenders** (`/lenders`): Manage lender directory.

- **Managers / admins**
  - **Reports** (`/reports`): Date range; sales summary, by user, aging, penetration, mix, pipeline; export CSV when permitted.
  - **Admin**: **Dealership** (locations), **Users** (invite, role, disable), **Roles** (create/edit, permissions), **Audit** (filter by entity/action/date).
  - **Files** (if permitted): Upload, get signed URL.

- **Platform admin**
  - **Platform Admin** (sidebar): **Dealerships** (create, disable/enable, impersonate), **Pending users** (approve/reject), **Invites** (create/resend/revoke).
  - **Accept-invite** and **Pending** flows as above.

### 5.3 Typical “road to sale” flow

1. Create or find **Customer** (and optionally opportunity in CRM).
2. Add **Vehicle** to inventory (or use existing).
3. Create **Deal** (customer + vehicle); set structure (price, fees, trade); advance status (e.g. DRAFT → STRUCTURED).
4. Open **Finance** tab: set finance structure and products; advance finance status.
5. Open **Lenders** tab: create application → create submission(s) → track status/decision/stipulations → link documents → when deal CONTRACTED, record funding.
6. **Documents** tab: upload deal jacket documents (contract, title, etc.).
7. When ready: set deal status to CONTRACTED (locks deal and finance); complete funding on submissions.

---

## 6. Key routes (sidebar)

- **Dealer app**: Dashboard, Inventory, Customers, Deals, CRM Board, Opportunities, Automations, Sequences, Jobs, Lenders, Reports, Dealership, Users, Roles, Access/Audit log, (Platform Admin when platform admin).
- **Platform app** (separate): Applications, Dealerships, Users, Audit Logs, Monitoring (and login/logout).
- **Public**: Login, Get Started, Accept Invite (by token), Pending (pending approval message).

---

## 7. References

- **Module specs**: `docs/modules/*.md` (core-platform, customers, deals, inventory, documents, finance-shell, reports, lender-integration, crm-pipeline-automation, platform-admin).
- **Manual smoke**: `docs/MANUAL-SMOKE-TEST-CHECKLIST.md`.
- **Security**: `docs/SECURITY.md`.
- **Deployment / local**: `docs/DEPLOYMENT.md`, `docs/LOCALHOST.md`.
- **Non-negotiables & coding standards**: `.cursor/rules/DMS-Non-Negotiables.mdc`, `.cursor/rules/Coding-Standards.mdc`.

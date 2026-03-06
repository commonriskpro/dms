# Step 4 — Security & QA (Portal Split) — Deliverables

## 1) File-by-file change list

### Created
- `packages/contracts/src/platform/dealerships.ts` — Added `platformProvisionDealershipRequestSchema`, `platformProvisionDealershipResponseSchema`, `platformSetDealershipStatusRequestSchema`.
- `apps/platform/lib/call-dealer-internal.ts` — Server-only: sign JWT, call dealer `POST /api/internal/provision/dealership` and `POST /api/internal/dealerships/[id]/status`.
- `apps/platform/app/api/platform/dealerships/[id]/provision/route.ts` — POST provision (PLATFORM_OWNER, idempotency, audit, mapping).
- `apps/platform/app/api/platform/dealerships/[id]/status/route.ts` — POST status (PLATFORM_OWNER, reason required for SUSPENDED/CLOSED, audit).
- `apps/platform/app/(platform)/platform/dev-login/route.ts` — GET dev-login (cookie + redirect), dev-only.
- `apps/platform/app/api/platform/dealerships/[id]/provision/route.rbac.test.ts` — RBAC: non-owner 403 before lookup.
- `apps/platform/app/api/platform/dealerships/[id]/status/route.rbac.test.ts` — RBAC: non-owner 403 before lookup.
- `lib/tenant-status.ts` — Centralized guards: `requireTenantStatus`, `requireTenantActiveForRead`, `requireTenantActiveForWrite`, `getDealershipLifecycleStatus`.
- `lib/tenant-status.test.ts` — Unit tests for SUSPENDED/CLOSED/ACTIVE behavior.
- `lib/internal-rate-limit.ts` — Lightweight rate limit for `/api/internal/*` (IP, disable in test).
- `modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts` — Job worker skips when tenant not ACTIVE.

### Modified
- `packages/contracts/src/platform/dealerships.ts` — New schemas (see above).
- `apps/platform/package.json` — Added `jose` dependency.
- `apps/platform/lib/platform-auth.ts` — `getPlatformUserIdFromRequest()`: accept cookie `platform_user_id` when not production.
- `apps/platform/app/(platform)/platform/dealerships/[id]/page.tsx` — Wired Provision, Activate, Suspend, Close to real APIs; reason modal for Suspend/Close.
- `apps/platform/README.md` — Documented dev-login cookie flow.
- `lib/tenant.ts` — `getActiveDealershipId`: check `lifecycleStatus === "CLOSED"` and clear cookie / return null.
- `lib/api/errors.ts` — Map `TENANT_SUSPENDED` and `TENANT_CLOSED` to 403.
- `modules/crm-pipeline-automation/service/job-worker.ts` — At start of `runJobWorker`: if `getDealershipLifecycleStatus !== "ACTIVE"`, skip and audit `job.skipped`.
- `app/api/internal/provision/dealership/route.ts` — Call `checkInternalRateLimit(request)` before JWT.
- `app/api/internal/dealerships/[dealerDealershipId]/status/route.ts` — Call `checkInternalRateLimit(request)` before JWT.
- **Dealer service guards (requireTenantActiveForRead / requireTenantActiveForWrite):**
  - `modules/customers/service/customer.ts`
  - `modules/customers/service/task.ts`
  - `modules/customers/service/note.ts`
  - `modules/customers/service/activity.ts`
  - `modules/deals/service/deal.ts`
  - `modules/inventory/service/vehicle.ts`
  - `modules/documents/service/documents.ts`

---

## 2) Checklist: Step 4 requirements → implemented

| Requirement | Implemented |
|-------------|-------------|
| **A) Platform lifecycle endpoints** | |
| POST `/api/platform/dealerships/[id]/provision` (PLATFORM_OWNER, Idempotency-Key, JWT to dealer, mapping, audit) | Yes |
| POST `/api/platform/dealerships/[id]/status` (PLATFORM_OWNER, status + reason for SUSPENDED/CLOSED, dealer call, audit) | Yes |
| Contracts: platform provision/status request schemas (Zod) | Yes |
| Wire Step 3 UI: Provision, Activate, Suspend, Close to real endpoints | Yes |
| **B) Platform dev auth** | |
| GET `/platform/dev-login?userId=<uuid>` (cookie, redirect), only when header auth + non-production | Yes |
| `getPlatformUserOrNull()` accepts header or cookie | Yes |
| **C) Dealer centralized status enforcement** | |
| ACTIVE: normal; SUSPENDED: block writes (TENANT_SUSPENDED), allow reads; CLOSED: block login + all (TENANT_CLOSED) | Yes |
| Single guard: `requireTenantStatus(mode)` / `requireTenantActiveForRead` / `requireTenantActiveForWrite` | Yes |
| Tenant context: `getActiveDealershipId` / CLOSED → no context | Yes |
| Guards applied in services: customers, deals, inventory, documents, task, note, activity | Yes |
| **D) Dealer internal API** | |
| JWT verification (signature, exp, aud, iss, jti replay) | Already present |
| Rate limiting `/api/internal/*` (IP, disable in test) | Yes |
| **E) Tests & quality** | |
| Platform RBAC: non-owner 403 on provision/status before lookup | Yes |
| Dealer: SUSPENDED → write blocked / read allowed; CLOSED → both blocked | Yes (lib/tenant-status.test.ts) |
| Job worker skips when tenant not ACTIVE | Yes (job-worker-tenant.test.ts) |
| Internal API JWT: missing/invalid rejected | Yes (portal-split internal-api.test.ts — 2 JWT tests pass) |
| TypeScript build passes (apps/platform) | Yes |
| Lint (platform) | Yes (build runs lint) |

---

## 3) Commands to run

- **Platform dev:**  
  `cd apps/platform && npm run dev`

- **Platform tests:**  
  `cd apps/platform && npm run test`

- **Dealer / portal-split–related tests:**  
  - Tenant status + job worker guard:  
    `npm run test -- --run lib/tenant-status.test.ts modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts`  
  - Portal-split (includes internal API JWT):  
    `npm run test:portal-split`  
  - Full dealer unit tests:  
    `npm run test:unit`

- **Full suite (optional):**  
  - Build contracts: `cd packages/contracts && npm run build`  
  - Platform: `cd apps/platform && npm run build && npm run test`  
  - Dealer: `npm run test` (or `test:unit` / `test:integration` as needed)

---

**Note:** Portal-split integration tests in `tests/portal-split/internal-api.test.ts` that hit the real DB (provision idempotency, status + audit) require a migrated test database; the two JWT-rejection tests run without DB and pass.

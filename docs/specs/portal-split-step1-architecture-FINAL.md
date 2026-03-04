# DMS Portal Split — Step 1 Architecture Specification (Final)

**Architecture only. No code. No Prisma schema changes. No migrations. No implementation.**

---

## 1. Overview

- **Two-portal split**
  - **Dealer Portal** at `app.<domain>`: operational DMS for dealerships (customers, deals, inventory, CRM, documents, tenant RBAC).
  - **Platform Admin Portal** at `platform.<domain>`: lifecycle, provisioning, support, compliance, billing.

- **Isolation principles**
  - Separate auth, databases, and storage per portal.
  - No shared cookies or sessions between portals.
  - Platform never connects directly to the dealer DB.
  - The only bridge between systems is a server-to-server **Dealer Provisioning API** (internal, JWT-authenticated).

- **Data boundary**
  - Dealer DB holds all tenant/operational data.
  - Platform DB holds only platform ops data, dealership registry, lifecycle state, and the mapping to dealer tenants.
  - No tenant PII, deal data, or document content in the platform DB.

- **Service-to-service bridge**
  - Platform calls the Dealer Provisioning API to create tenants and to set status (ACTIVE | SUSPENDED | CLOSED).
  - All calls use short-lived signed JWT; no tenant data is returned.
  - Idempotency and audit rules apply as defined below.

---

## 2. Monorepo Structure

- **Root**: Single repo with workspaces.
- **Apps**
  - `apps/dealer` — Next.js App Router; dealer UI and API; tenant-scoped; hosts internal provisioning/status endpoints under `/api/internal/*`.
  - `apps/platform` — Next.js App Router; platform admin UI and API; no tenant data.
- **Packages**
  - `packages/contracts` — Zod schemas, TypeScript types, and shared constants only (see Contracts Package Rules). Used by both apps for API contracts and validation. No DB clients, no secrets.
  - Optional: `packages/eslint-config`, `packages/tsconfig` for shared tooling.
- **Env**
  - `apps/dealer/.env.local`: `DEALER_*` only (e.g. `DEALER_SUPABASE_URL`, `DEALER_SUPABASE_SERVICE_KEY`, `DEALER_DATABASE_URL`). No platform secrets.
  - `apps/platform/.env.local`: `PLATFORM_*` only (e.g. `PLATFORM_SUPABASE_URL`, `PLATFORM_SUPABASE_SERVICE_KEY`, `PLATFORM_DATABASE_URL`, internal API signing secret). No dealer secrets.
  - No shared env variables except harmless build metadata; no DB URLs or keys shared.
- **Supabase**
  - Two separate Supabase projects: one for dealer (auth + optional DB), one for platform (auth + DB). Keys never cross; dealer app never sees platform keys; platform app never sees dealer keys.
- **Prisma**
  - `apps/dealer/prisma/schema.prisma` and generated client used only by the dealer app.
  - `apps/platform/prisma/schema.prisma` and generated client used only by the platform app.
  - No cross-import of Prisma clients; no shared schema file.

---

## 3. Data Ownership Split

**Dealer DB (tenant/operational)**

- All operational and tenant data: customers, leads, deals, finance, inventory, document paths and metadata, CRM (pipelines, opportunities, sequences, tasks), tenant RBAC (memberships, roles, permissions), tenant users and invites, dealer audit logs for tenant actions, dealer-specific config and feature flags scoped by `dealership_id`.
- Every business table includes `dealership_id`; every query is scoped by tenant.
- Lifecycle status copy (ACTIVE | SUSPENDED | CLOSED) stored and enforced in dealer when using the push model.

**Platform DB (platform ops only)**

- Platform users and platform RBAC (PLATFORM_OWNER, PLATFORM_SUPPORT, PLATFORM_COMPLIANCE).
- Dealership registry: legal name, display name, plan, limits, lifecycle status, timestamps, mapping `platform_dealership_id` ↔ `dealer_dealership_id`, provisioned-at.
- Onboarding: applications (states APPLIED → UNDER_REVIEW → APPROVED / REJECTED), review notes, rejection reasons.
- Plan, subscription, limits, feature flags (platform-side).
- Platform audit log (append-only; schema expectations in section 12).
- Support metadata (tickets, session requests; references by platform dealership ID only); no dealer PII or document content.
- Optional: aggregated counts (e.g. active user count) for ops; no VINs, no customer PII, no deal details.

**Explicitly NOT in platform DB**

- Customer PII (names, contact, SSN/DOB, etc.).
- Deal or finance details (amounts, terms, lender data).
- Dealer document contents or direct links to dealer storage (default no; only “support session issued” type metadata if needed).
- Inventory VINs or vehicle details (optional: aggregated counts only).
- Dealer user passwords or session tokens; only references such as “owner invite created” if platform triggers an invite via internal API.

---

## 4. Single Source of Truth

- **Dealership lifecycle state** (APPLIED → … → ACTIVE | SUSPENDED | CLOSED): Platform DB is the source of truth. Under the recommended push model, the dealer stores a copy of status when the platform calls the status endpoint and enforces it; the platform does not read back from the dealer for lifecycle.
- **Dealership identity**: Platform creates and owns `platform_dealership_id`; the dealer creates and owns `dealer_dealership_id` at provisioning time. The mapping between them lives in the platform DB only.
- **Tenant operational data**: Dealer DB only; platform never stores or reads this data.
- **Platform users and roles**: Platform DB and platform Supabase Auth only; the dealer app has no notion of platform user identity.
- **Application and onboarding state**: Platform DB only; rejections, review notes, and approval state are never stored in the dealer system.
- **Dealer RBAC and memberships**: Dealer DB only; platform does not store dealer user roles or permissions.

---

## 5. Auth Model

**Dealer portal**

- **Provider**: Dealer Supabase project (Auth).
- **Users**: Created via invite/membership flow; no open sign-up without invite (or explicit bootstrap for first owner).
- **Multi-dealership**: If a user has multiple memberships, they choose active dealership in session/context; RBAC is per membership.
- **RBAC**: Dealer roles (e.g. Admin, Manager, Sales, Viewer) and permissions enforced on every route; `dealership_id` from membership; no blanket admin bypass unless explicitly required.
- **Sessions**: Cookies scoped to dealer app origin (`app.<domain>`). Not valid on `platform.<domain>`.
- **Routing**: UI under `/app/*` (or dealer app root); API under `/api/*` (dealer-scoped). Every business API requires valid dealer session and membership; tenant scoping on all queries.

**Platform portal**

- **Provider**: Platform Supabase project (Auth + DB).
- **Users**: Platform users only (separate from dealer users); created and managed by platform admins.
- **RBAC**: Platform roles (PLATFORM_OWNER, PLATFORM_SUPPORT, PLATFORM_COMPLIANCE); every platform route enforces platform auth and role checks before any DB read that could reveal existence of entities.
- **Sessions**: Cookies scoped to platform origin (`platform.<domain>`). Not valid on `app.<domain>`.
- **Routing**: UI under `/platform/*`, API under `/api/platform/*`. No tenant data; resources scoped by platform user/role only.

**Session isolation**

- No shared sessions: platform cookies are not accepted by the dealer app; dealer cookies are not accepted by the platform app.
- No cross-login: “Open dealer” is a link to `https://app.<domain>/...` only; no session transfer; the user must log in to the dealer portal separately.

---

## 6. Platform RBAC Matrix (Roles → Allowed Actions)

- **PLATFORM_OWNER**
  - Applications: list, view detail, request more info, approve, reject (with reason).
  - Dealerships registry: list, view detail, trigger provisioning, suspend, activate, close (with reason); view provisioning history and errors.
  - Platform audit logs: read (search, view detail).
  - Support: create support session request.
  - Owner bootstrap: may trigger dealer internal “create owner invite” (or equivalent), if implemented.
- **PLATFORM_COMPLIANCE**
  - Applications: list, view detail, request more info, approve, reject (with reason).
  - Dealerships registry: list, view detail; view provisioning history and errors. No suspend/activate/close, no provisioning trigger.
  - Platform audit logs: read (search, view detail).
  - Support: read-only (no create). Owner bootstrap: no.
- **PLATFORM_SUPPORT**
  - Applications: list, view detail (read-only). No approve, reject, or request more info.
  - Dealerships registry: list, view detail (read-only); view provisioning history and errors. No state changes.
  - Platform audit logs: read (search, view detail).
  - Support: create support session request. Owner bootstrap: no.

All platform routes enforce the above before any DB read that could reveal existence of entities. **Unlisted actions are denied.**

---

## 7. Dealership Lifecycle & Provisioning Workflow

**Application states (platform-side)**

- APPLIED — Application submitted.
- UNDER_REVIEW — Platform is reviewing; may request more info.
- APPROVED — Ready for provisioning (platform moves to provisioning flow).
- REJECTED — Rejected with mandatory reason (stored in platform DB; audit logged).

Transitions are performed by platform roles only (e.g. PLATFORM_OWNER, PLATFORM_COMPLIANCE). All transitions and reject/request-more-info actions are audit-logged. Rejections require a reason (stored and shown in application detail).

**Provisioning states (platform-side)**

- APPROVED — Application approved, not yet provisioned.
- PROVISIONING — Platform has called or is calling the Dealer Provisioning API.
- PROVISIONED — Dealer has created tenant and returned `dealerDealershipId`; platform has stored mapping.
- ACTIVE — Dealership is live; dealer allows normal operations (per push model).
- SUSPENDED — Platform has suspended; dealer enforces suspension (see Status Enforcement Rules).
- CLOSED — Dealership closed; dealer enforces closure (see Status Enforcement Rules).

**Who can transition**

- APPROVED → PROVISIONING: platform (e.g. PLATFORM_OWNER) triggers provisioning.
- PROVISIONING → PROVISIONED: after successful response from Dealer Provisioning API (platform stores mapping).
- PROVISIONED → ACTIVE: platform sets ACTIVE and calls dealer status endpoint (push model).
- ACTIVE ↔ SUSPENDED: platform only; audit + call dealer status endpoint.
- SUSPENDED/ACTIVE → CLOSED: platform only; audit + call dealer status endpoint.

All state changes are audited (actor, from/to state, reason if any, timestamp).

**High-level provisioning flow**

1. Applicant submits application (platform UI; data in platform DB).
2. Platform admin reviews; may request more info or reject with reason.
3. On approve, platform sets state to PROVISIONING and calls the Dealer Provisioning API (server-to-server) with legal name, display name, plan, limits, initial config, etc., and Idempotency-Key.
4. Dealer app creates tenant (dealership row, provisioning seed per section 10), returns `dealerDealershipId` and `provisionedAt`.
5. Platform stores mapping `platform_dealership_id` ↔ `dealer_dealership_id`, sets state to PROVISIONED.
6. Platform sets status to ACTIVE and calls dealer `POST /api/internal/dealerships/{dealerDealershipId}/status` with status ACTIVE (push model).
7. Dealer never reads from platform DB; platform never reads from dealer DB; only the internal provisioning and status APIs are used.

**Recommendation**: Use the **push model**: platform calls the dealer status endpoint for ACTIVE | SUSPENDED | CLOSED; dealer stores and enforces status locally. No dealer polling of platform for status.

---

## 8. Dealer Provisioning API (Contract Only)

**Scope**: Internal only. Called by platform backend with service-to-service auth. Not exposed to browser. No tenant data read or returned. Only provisioning and status/keys.

**Base path**: e.g. `https://app.<domain>/api/internal/...` (or dedicated internal host per Internal API Hosting Recommendation).

**Endpoints**

- **POST /api/internal/provision/dealership**
  - Request: `platformDealershipId` (UUID), `legalName`, `displayName`, `primaryOwnerEmail?`, `planKey`, `limits` (e.g. seats, storage), `initialConfig` (optional key/value).
  - Response (success): `dealerDealershipId` (UUID), `provisionedAt` (ISO timestamp).
  - Idempotency: `Idempotency-Key` header required (opaque string). Dealer stores completed provision requests keyed by this value; on duplicate key returns same `dealerDealershipId` and `provisionedAt` without creating a second tenant.
  - Errors: 401/403 invalid or missing auth; 409 duplicate mapping (same `platformDealershipId` with different or missing Idempotency-Key); 422 invalid payload (validation).

- **POST /api/internal/dealerships/{dealerDealershipId}/status**
  - Request: `status` (ACTIVE | SUSPENDED | CLOSED), `reason?`, `platformActorId` (who requested).
  - Response: 200 OK with minimal ack (e.g. `{ ok: true }`).
  - Side effect: Dealer updates stored status for that tenant and enforces it per Status Enforcement Rules.
  - Errors: 401/403 invalid auth; 404 unknown dealerDealershipId; 422 invalid status or payload.

- **POST /api/internal/dealerships/{dealerDealershipId}/rotate-keys** (optional)
  - Request: `platformActorId` (optional, for audit).
  - Response: 200 with e.g. `{ ok: true, rotatedAt: ISO }`.
  - Errors: 401/403 invalid auth; 404 unknown dealerDealershipId.

**Validation rules**

- All request/response shapes defined in `packages/contracts` (Zod + TS types). Validation at edge (Zod); no unvalidated body or path params.
- No pagination; not list endpoints. No tenant data returned; only IDs and timestamps for provisioning/status.
- Path parameter `dealerDealershipId` is the dealer’s tenant ID; platform sends it in the path; dealer never accepts platform-supplied IDs for tenant data reads outside these internal endpoints.

**Service-to-service auth (JWT)**

- Short-lived JWT (60–120 s).
- Claims: `aud` = "dealer-internal" (or agreed value), `iss` = "platform" (or platform service id), `jti` (unique per request), `exp`.
- Dealer validates signature and rejects invalid or expired tokens; rejects reused `jti` within TTL (replay protection).
- Signing key/secret in server env only (platform holds signing key; dealer holds verification key or shared secret). No client or contracts package access.

---

## 9. Status Enforcement Rules (Dealer Side — Push Model)

The dealer stores lifecycle status (ACTIVE | SUSPENDED | CLOSED) for each tenant and enforces it in a **centralized, non-bypassable** way. All tenant-facing and background behavior must respect this status.

**ACTIVE**

- Login allowed. All tenant reads and writes allowed (subject to normal RBAC). Background job workers run for that tenant.

**SUSPENDED**

- **Login**: Allowed (so users can see a “suspended” message or contact support); alternatively, login can be blocked per product choice—spec must be implemented consistently.
- **Writes**: Blocked for all tenant mutation endpoints (create/update/delete on customers, deals, inventory, documents, CRM, etc.). Read-only operations may be allowed so users can view data but not change it.
- **Reads**: Allowed (or allowed for a defined subset) so that users can view state; no tenant data leaves the dealer system.
- **Job workers**: Stopped or skipped for that tenant (no automated sequences, no scheduled tasks, no outbound actions). Workers must check tenant status before processing.

**CLOSED**

- **Login**: Blocked for that tenant; session invalidated or rejected when dealership context is closed.
- **All tenant endpoints**: Disabled for that tenant (reads and writes); return a consistent error (e.g. 403 or 410) so that no tenant operations are possible.
- **Background jobs**: Stopped for that tenant; no processing, no new job creation for that tenant.

Enforcement must be centralized (e.g. single middleware or service that resolves tenant status and blocks or allows requests and job execution). No route or worker may bypass the status check.

---

## 10. Provisioning Seed Checklist

When the dealer app provisions a new tenant (in response to POST /api/internal/provision/dealership), it performs a **deterministic, idempotent** seed. High-level steps (no implementation detail):

- Create tenant (dealership) row with `dealer_dealership_id`, optional `platform_dealership_id` reference, legal name, display name, and stored status (e.g. ACTIVE once platform has set it).
- Create default roles and attach permissions (e.g. Owner, Admin, Sales, Finance) according to the dealer RBAC model; roles are tenant-scoped.
- Create default CRM pipeline and stages for the tenant (e.g. one pipeline with initial stages) so the tenant is usable.
- Create default system settings or feature flags for the tenant (if any).
- Write an audit baseline record (e.g. tenant created, provisioned at, no PII).
- Idempotency: if the same Idempotency-Key (or same `platformDealershipId` with same key) is used again, do not create a second tenant; return the existing `dealerDealershipId` and `provisionedAt`.

The first dealer owner is not created by the seed; owner bootstrap (invite or one-time link) is a separate, post-provision step (platform may call a dealer internal endpoint to create an owner invite, or the dealer may provide a bootstrap flow; the platform never creates dealer user credentials).

---

## 11. Mapping & Uniqueness Constraints

- **platform_dealership_id**
  - In platform DB: primary or unique identifier for the dealership registry row. One row per platform dealership.
  - In dealer DB: if stored at all, stored as an optional reference with uniqueness so that one dealer tenant maps to at most one platform dealership.

- **dealer_dealership_id**
  - In dealer DB: primary key for the tenant (dealership) row. Created at provisioning time; unique.
  - In platform DB: stored in the registry after provisioning; unique in the mapping so that each dealer tenant is linked to at most one platform dealership.

- **1:1 mapping**
  - Each `platform_dealership_id` maps to at most one `dealer_dealership_id`.
  - Each `dealer_dealership_id` maps to at most one `platform_dealership_id` (in platform DB).

- **Idempotency for provisioning**
  - Idempotency-Key header is required for POST /api/internal/provision/dealership.
  - Dealer stores completed provision requests keyed by Idempotency-Key (or composite including it).
  - Same Idempotency-Key on retry: return the same `dealerDealershipId` and `provisionedAt`; do not create a second tenant.
  - Same `platformDealershipId` with same Idempotency-Key: idempotent success (return existing).
  - Same `platformDealershipId` with different or missing Idempotency-Key: **409 Conflict** (duplicate mapping).

---

## 12. Platform Audit Schema Expectations

Platform audit log is **append-only**. Each record must support at least the following (conceptual fields; no schema DDL in this doc):

- **actorPlatformUserId** — Platform user who performed the action.
- **action** — Action identifier (e.g. application.approved, dealership.suspended, dealership.provisioned).
- **targetType** — Entity type (e.g. application, dealership).
- **targetId** — Entity id (e.g. platform_dealership_id or application id).
- **beforeState** — State or payload before the action (optional but recommended for state transitions).
- **afterState** — State or payload after the action (optional but recommended for state transitions).
- **reason** — Required for reject, suspend, close (and similar destructive or sensitive actions); optional for others.
- **requestId / idempotencyKey** — When the action is triggered by an internal API call, store the idempotency key or request id for traceability.
- **createdAt** — Timestamp of the audit record.

Audit log must be append-only (no updates or deletes). All platform lifecycle transitions and all calls that trigger dealer provisioning or status changes must produce an audit record.

---

## 13. Contracts Package Rules

The `packages/contracts` package must adhere to the following:

- **Allowed**: Zod schemas, TypeScript types, string enums, and shared constants only. Used for API request/response validation and shared type definitions.
- **No Prisma**: No Prisma client, no schema, no database types from Prisma.
- **No Supabase**: No Supabase client or auth types from Supabase.
- **No env**: No environment variables or runtime config; no secrets.
- **No runtime side effects**: No I/O, no network, no DB; pure types and validation.
- **Independently publishable**: The package must be buildable and consumable by both apps without pulling in app-only or env-dependent code. It may be published to a private registry or consumed via workspace reference.

---

## 14. Internal API Hosting Recommendation

- **Option A (recommended for MVP)**: Internal provisioning and status endpoints are hosted on the **same app and domain** as the dealer portal (e.g. `https://app.<domain>/api/internal/...`). Access is restricted by service-to-service JWT auth only; no browser or dealer-user session can call these routes. Single deployment and ops surface; route-level checks ensure only valid platform service calls succeed.
- **Option B**: Dedicated internal host or service (e.g. `internal.<domain>` or a separate backend) that only the platform backend calls; the dealer customer-facing app does not expose internal routes. Use if policy or scaling requires strict network or process separation.
- **Recommendation**: **Option A** for MVP. Revisit Option B if security, compliance, or scaling requirements justify a dedicated internal surface.

---

## 15. Test Plan (High-Level)

- **Platform auth isolation**: Unauthenticated or non-platform requests to `/platform/*` and `/api/platform/*` are rejected; no access without platform auth and appropriate role.
- **Dealer auth isolation**: Unauthenticated or non-member requests to dealer UI and dealer API are rejected; no access without dealer auth and membership (and permission where applicable).
- **JWT validation and replay protection**: Dealer internal API rejects requests without valid JWT (401/403); invalid or expired token rejected; replayed `jti` rejected within TTL.
- **Provisioning idempotency**: Two identical requests with the same Idempotency-Key yield the same `dealerDealershipId` and no duplicate tenant creation.
- **Suspension enforcement**: When platform sets SUSPENDED and calls dealer status endpoint, dealer enforces: writes blocked (and reads/job behavior as specified); tests verify behavior without tenant data leakage.
- **Closure enforcement**: When platform sets CLOSED and calls dealer status endpoint, dealer enforces: login blocked, all tenant endpoints disabled, background jobs stopped for that tenant.
- **Dual audit logging**: All platform lifecycle transitions produce platform audit records; all dealer internal API calls (provision, status) produce dealer-side audit records (e.g. platform.provision.*, platform.status.*) with no tenant PII. Tests verify presence and non-tampering of logs at a high level.

---

## 16. Open Decisions

- **Subdomains vs path-based**: **Recommendation** — Subdomains: `app.<domain>` (dealer), `platform.<domain>` (platform). Clear separation of origin, cookies, and future scaling. Path-based (e.g. `/dealer`, `/platform`) shares origin and requires strict path and cookie handling.
- **Push vs pull status**: **Recommendation** — Push for MVP: platform calls dealer `POST .../status`; dealer stores and enforces. Clear audit trail on dealer side; no polling or read dependency on platform from dealer.
- **Support session**: **Deferred** — MVP = “create support request” only. “Support session issued” (one-time link, restricted session, or view-only) to be designed and implemented later.
- **Compliance docs**: **Default** — Platform does not store tenant documents or links to dealer document storage. If compliance requires proof, options later: dealer-generated export or dealer upload to platform in a controlled flow; no automatic sync in MVP.
- **Billing (Stripe)**: **Platform-only** — Stripe account and webhooks live in platform app; dealer app has no Stripe keys; subscription/plan/limits stored in platform DB; no payment data in dealer DB.

---

*End of Step 1 Architecture Specification. Implementation in Step 2.*

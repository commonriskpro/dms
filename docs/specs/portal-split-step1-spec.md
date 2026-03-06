# Portal Split Spec — Step 1 (Architecture Only)

---

## Overview

Split the DMS into two fully isolated portals:

1. **Dealer Portal** — tenant app at `app.<domain>`: operational DMS for dealerships (customers, deals, inventory, CRM, documents, tenant RBAC).
2. **Platform Admin Portal** — platform ops at `platform.<domain>`: lifecycle, provisioning, support, compliance, billing.

**Principles:**

- **Isolation**: Separate auth, DBs, storage, cookies/sessions. No shared sessions; platform never talks to dealer DB except via a server-to-server **Dealer Provisioning API**.
- **Data boundary**: Dealer DB holds all tenant/operational data; Platform DB holds only platform ops, dealership registry, lifecycle, and mapping to dealer tenants.
- **Security**: Service-to-service calls use signed JWT (or HMAC); no cross-use of Supabase keys or Prisma clients.

---

## Monorepo structure

- **Root**: Single repo with workspaces.
- **Apps**
  - `apps/dealer` — Next.js app for dealership users (tenant UI + API).
  - `apps/platform` — Next.js app for platform staff (admin UI + API).
- **Packages**
  - `packages/contracts` — **Only** Zod schemas and shared TypeScript types (no DB clients, no secrets). Used by both apps for API contracts and validation.
  - Optional: `packages/eslint-config`, `packages/tsconfig` for shared tooling.
- **Env**
  - `apps/dealer/.env.local`: `DEALER_*` (e.g. `DEALER_SUPABASE_URL`, `DEALER_SUPABASE_SERVICE_KEY`, `DEALER_DATABASE_URL`). No platform secrets.
  - `apps/platform/.env.local`: `PLATFORM_*` (e.g. `PLATFORM_SUPABASE_URL`, `PLATFORM_SUPABASE_SERVICE_KEY`, `PLATFORM_DATABASE_URL`, internal API signing secret). No dealer secrets.
  - Shared env only for harmless build metadata (e.g. Node version, build IDs) if needed; no DB URLs or keys shared.
- **Supabase**
  - Two Supabase projects: one for dealer auth/DB, one for platform auth/DB. Keys never cross; dealer app never sees platform keys; platform app never sees dealer keys.
- **Prisma**
  - `apps/dealer/prisma/schema.prisma` + generated client used only by dealer app.
  - `apps/platform/prisma/schema.prisma` + generated client used only by platform app.
  - No cross-import of Prisma clients; no shared schema file.
- **Shared code**
  - Only `packages/contracts` (types + Zod). No DB access, no env secrets, no Supabase client in contracts.

---

## Data ownership split

**Dealer DB (tenant/operational):**

- All operational and tenant data: customers, deals/finance, inventory, document paths and metadata, CRM (pipelines, opportunities, sequences, etc.), tenant RBAC (memberships, roles, permissions), tenant users (invites, sessions), audit logs for tenant actions, any dealer-specific config and feature flags scoped by `dealership_id`.
- Every business table includes `dealership_id`; all queries scoped by tenant.

**Platform DB (platform ops only):**

- Platform users and platform RBAC (e.g. PLATFORM_OWNER, PLATFORM_SUPPORT, PLATFORM_COMPLIANCE).
- Dealership registry: legal name, display name, plan, limits, status, timestamps, **mapping** `platform_dealership_id` ↔ `dealer_dealership_id` (and provisioned-at, etc.).
- Onboarding: applications (APPLIED → UNDER_REVIEW → APPROVED / REJECTED), review notes, rejection reasons.
- Plan/subscription/limits/feature flags (platform-side); no deal/finance or customer data.
- Platform audit log (who did what, when, on which entity).
- Support metadata (tickets, sessions, references to dealership by platform ID only); no dealer PII or document content.
- Optional: aggregated counts (e.g. "number of active users") if needed for ops; no VINs, no customer PII, no deal details.

**Explicitly NOT in platform DB:**

- Customer PII (names, contact, SSN/DOB, etc.).
- Deal/finance details (amounts, terms, lender data).
- Dealer document contents or direct links to dealer storage (default: no; only "support session issued" type metadata if needed).
- Inventory VINs or vehicle details (optional: aggregated counts only, no PII/VIN).
- Dealer user passwords or session tokens; only references like "owner invite created" if platform triggers an invite via internal API.

---

## Single source of truth

- **Dealership lifecycle state** (APPLIED → … → ACTIVE | SUSPENDED | CLOSED): Platform DB is the source of truth. Under the recommended push model, the dealer stores only a copy of status when the platform calls the status endpoint; the platform never reads back from the dealer for lifecycle.
- **Dealership identity**: Platform creates and owns `platform_dealership_id`; the dealer creates and owns `dealer_dealership_id` at provisioning time. The **mapping** between them lives in the platform DB only.
- **Tenant operational data** (customers, deals, inventory, documents, CRM, tenant RBAC): Dealer DB only; platform never stores or reads this data.
- **Platform users and roles**: Platform DB and platform Supabase Auth only; dealer app has no notion of platform user identity.
- **Application and onboarding state**: Platform DB only; rejections, review notes, and approval state are never stored in the dealer system.

---

## Auth model

**Dealer portal**

- **Provider**: Dealer Supabase project (Auth + optional DB).
- **Users**: Created via invite/membership flow; no sign-up without invite (or explicit bootstrap for first owner).
- **Multi-dealership**: If a user can belong to multiple dealerships, they choose active dealership (session/context); RBAC is per membership.
- **RBAC**: Dealer roles (e.g. Admin, Manager, Sales, Viewer) and permissions enforced on every route; `dealership_id` from membership; no "admin bypass" unless explicitly required.
- **Sessions**: Cookies/localStorage scoped to dealer app origin (`app.<domain>`). Not valid on `platform.<domain>`.

**Platform portal**

- **Provider**: Platform Supabase project (Auth + DB).
- **Users**: Platform users only (separate from dealer users); created/managed by platform admins.
- **RBAC**: Platform roles (e.g. PLATFORM_OWNER, PLATFORM_SUPPORT, PLATFORM_COMPLIANCE); every platform route enforces `requirePlatformAdmin` (or role-specific checks) before any DB access that could reveal existence of data.
- **Sessions**: Cookies scoped to platform origin (`platform.<domain>`). Not valid on `app.<domain>`.

**Isolation**

- No shared sessions: platform cookies are not accepted by dealer app; dealer cookies are not accepted by platform app.
- "Open dealer" = link to `https://app.<domain>/...` only; no session transfer; user must log in to dealer separately if they have a dealer account.

---

## Platform RBAC matrix (roles → allowed actions)

- **PLATFORM_OWNER**
  - Applications: list, view detail, request more info, approve, reject (with reason).
  - Dealerships registry: list, view detail, trigger provisioning, suspend, activate, close (with reason); view provisioning history and errors.
  - Audit logs: read (search, view detail).
  - Support: create support session request.
  - Owner bootstrap: may trigger dealer internal “create owner invite” or equivalent, if that capability is implemented.
- **PLATFORM_COMPLIANCE**
  - Applications: list, view detail, request more info, approve, reject (with reason).
  - Dealerships registry: list, view detail; view provisioning history and errors. No suspend/activate/close, no provisioning trigger.
  - Audit logs: read (search, view detail).
  - Support: no create (or read-only). Owner bootstrap: no.
- **PLATFORM_SUPPORT**
  - Applications: list, view detail (read-only). No approve, reject, or request more info.
  - Dealerships registry: list, view detail (read-only); view provisioning history and errors. No state changes.
  - Audit logs: read (search, view detail).
  - Support: create support session request.
  - Owner bootstrap: no.

All platform routes enforce the above before any DB read that could reveal existence of entities. Unlisted actions are denied.

---

## Dealership lifecycle + provisioning workflow

**Application states (platform-side)**

- `APPLIED` — Application submitted.
- `UNDER_REVIEW` — Platform is reviewing; may request more info.
- `APPROVED` — Ready for provisioning (platform moves to provisioning flow).
- `REJECTED` — Rejected with mandatory reason (stored in platform DB; audit logged).

Transitions: platform roles only (e.g. PLATFORM_OWNER, PLATFORM_COMPLIANCE). All transitions and "request more info" / "reject" actions are audit-logged. Rejections require a reason (stored and shown in application detail).

**Provisioning states (platform-side)**

- `APPROVED` — Application approved, not yet provisioned.
- `PROVISIONING` — Platform has called (or is calling) Dealer Provisioning API.
- `PROVISIONED` — Dealer has created tenant and returned `dealerDealershipId`; platform has stored mapping.
- `ACTIVE` — Dealership is live; dealer allows normal operations (per chosen enforcement model).
- `SUSPENDED` — Platform has suspended; dealer must block or limit operations (per chosen model).
- `CLOSED` — Dealership closed; dealer must block operations and may archive/retain per policy.

**Transitions and who can do them**

- APPROVED → PROVISIONING: platform (e.g. PLATFORM_OWNER) triggers provisioning.
- PROVISIONING → PROVISIONED: after successful response from Dealer Provisioning API (platform stores mapping).
- PROVISIONED → ACTIVE: platform sets ACTIVE (and notifies dealer per chosen model).
- ACTIVE ↔ SUSPENDED: platform only; audit + optional dealer status API call.
- SUSPENDED/ACTIVE → CLOSED: platform only; audit + dealer status API if applicable.

All state changes are audited (actor, from/to state, reason if any, timestamp).

**Provisioning flow (high level)**

1. Applicant submits application (platform UI; data in platform DB).
2. Platform admin reviews; may request more info or reject with reason.
3. On approve, platform sets provisioning state and calls **Dealer Provisioning API** (server-to-server): create tenant with legal name, display name, plan, limits, initial config, etc.
4. Dealer app creates tenant (e.g. dealership row, seed data, default roles), returns `dealerDealershipId` and `provisionedAt`.
5. Platform stores mapping `platform_dealership_id` ↔ `dealer_dealership_id`, sets state to PROVISIONED.
6. Platform sets status to ACTIVE (and, per chosen model, either calls dealer set-status endpoint or dealer checks platform status).
7. Dealer never reads from platform DB; platform never reads from dealer DB; only the internal provisioning/status APIs are used.

**Open choice (documented in Open decisions)**

- **(A) Platform pushes status to dealer**: Platform calls dealer `POST .../status` with ACTIVE | SUSPENDED | CLOSED; dealer stores and enforces locally.
- **(B) Dealer checks platform**: Dealer, on each request or periodically, checks platform "active" status (e.g. via a read-only internal endpoint or webhook); dealer never stores lifecycle state, only trusts platform.

Recommendation will be stated in Open decisions with pros/cons.

---

## Dealer Provisioning API contracts

**Scope**: Internal only; called by platform backend with service-to-service auth (JWT or HMAC). Not exposed to browser; no tenant data read; only provisioning and status/keys.

**Base path (conceptual)**: e.g. `https://app.<domain>/api/internal/...` or dedicated internal host; same app as dealer, route protected by service auth only.

**Endpoints (contract only)**

1. **POST /api/internal/provision/dealership**
   - **Request**: `platformDealershipId` (UUID), `legalName`, `displayName`, `primaryOwnerEmail?`, `planKey`, `limits` (e.g. seats, storage), `initialConfig` (optional key/value).
   - **Response (success)**: `dealerDealershipId` (UUID), `provisionedAt` (ISO timestamp).
   - **Idempotency**: `Idempotency-Key` header (opaque string). Dealer stores `provision_requests` keyed by this value; on duplicate key returns same `dealerDealershipId` and `provisionedAt` (no second tenant creation).
   - **Errors**: 401/403 invalid or missing auth; 409 if duplicate mapping and not idempotent retry; 422 invalid payload (validation).

2. **POST /api/internal/dealerships/{dealerDealershipId}/status**
   - **Request**: `status` (ACTIVE | SUSPENDED | CLOSED), `reason?`, `platformActorId` (who requested).
   - **Response**: 200 OK with e.g. `{ ok: true }` or minimal ack.
   - **Side effect**: Dealer updates internal status for that tenant and enforces it (e.g. block login or operations when SUSPENDED/CLOSED).
   - **Errors**: 401/403 invalid auth; 404 unknown dealerDealershipId; 422 invalid status or payload.

3. **POST /api/internal/dealerships/{dealerDealershipId}/rotate-keys** (optional)
   - **Request**: `platformActorId` (optional, for audit).
   - **Response**: 200 with e.g. `{ ok: true, rotatedAt: ISO }`.
   - **Errors**: 401/403 invalid auth; 404 unknown dealerDealershipId.

**General**

- All request/response shapes defined in `packages/contracts` (Zod + TS types). Validation at edge (Zod); no unvalidated body/params.
- No pagination (not list endpoints). No returning tenant data; only IDs and timestamps for provisioning/status.
- `dealership_id` in dealer DB is the `dealerDealershipId`; platform always sends it in path or body as specified; dealer never accepts `dealership_id` from platform for *tenant data* reads—only for these internal endpoints.

---

## Mapping and uniqueness constraints

- **Platform DB**
  - Dealership registry row per dealership; `platform_dealership_id` is the primary (or unique) identifier.
  - After provisioning, the registry stores `dealer_dealership_id`; the mapping is one-to-one: each `platform_dealership_id` maps to at most one `dealer_dealership_id`, and each `dealer_dealership_id` is stored for at most one platform dealership.
- **Dealer DB**
  - Dealership (tenant) row identified by `dealer_dealership_id` (primary key).
  - Optionally store `platform_dealership_id` for reference or audit; if stored, uniqueness constraint so that one dealer tenant corresponds to at most one platform dealership.
- **Provisioning idempotency**
  - **Idempotency-Key** header is required for `POST /api/internal/provision/dealership`. The dealer stores completed provision requests keyed by this value (or by a composite that includes it).
  - Same Idempotency-Key on retry: return the same `dealerDealershipId` and `provisionedAt` without creating a second tenant.
  - **platformDealershipId uniqueness**: The dealer must enforce at most one tenant per `platformDealershipId`. A second request with the same `platformDealershipId` and the same Idempotency-Key is treated as idempotent (return existing). A second request with the same `platformDealershipId` but a different or missing Idempotency-Key must fail with 409 (duplicate mapping).

---

## Internal API hosting (MVP recommendation)

- **Option A (recommended for MVP)**: Internal provisioning and status endpoints are hosted on the **same app and domain** as the dealer portal (e.g. `https://app.<domain>/api/internal/...`). Access is restricted by service-to-service auth (JWT) only; no browser or dealer-user session can call these routes. Single deployment and ops surface; route-level checks ensure only valid platform service calls succeed.
- **Option B**: Dedicated internal host or service (e.g. `internal.<domain>` or a separate backend) that only the platform backend calls; the dealer customer-facing app does not expose internal routes. Use if policy or scaling requires strict network or process separation.
- **Recommendation**: **Option A** for MVP. Revisit Option B if security, compliance, or scaling requirements justify a dedicated internal surface.

---

## Security requirements

**Service-to-service auth**

- **Choice**: **Signed JWT** (recommended) for flexibility, standard tooling, and clear aud/iss. Alternative: HMAC with timestamp+nonce for simpler key management.
- **JWT**:
  - Short-lived: 60–120 s.
  - `aud = "dealer-internal"` (or similar), `iss = "platform"` (or platform service id).
  - `jti` (unique per request) + `exp`; dealer rejects reused `jti` within TTL (replay protection).
  - Signing key/secret in server env only (platform holds signing key; dealer holds verification key or shared secret).
- **Secrets**: Stored only in server env (platform and dealer); never in client or contracts package. Rotate regularly; document rotation and key versioning if needed.
- **Rate limiting**: Applied on dealer internal API routes; consider IP allowlist for platform callers if feasible.
- **Audit**: Dealer logs all calls to `api/internal/*` as e.g. `platform.provision.*` or `platform.status.*` (no tenant PII in logs). Platform logs dealership lifecycle and provisioning calls as e.g. `dealership.provision`, `dealership.status`.

**General**

- OWASP: secure headers (CSP where feasible), no PII in logs, no raw card data (billing stays platform-side with Stripe).
- Idempotency-Key for mutating internal calls (provision, possibly status) where duplicate submission must be safe.

---

## Platform portal modules

**A) Applications**

- List: applications with filters (e.g. state: APPLIED, UNDER_REVIEW, APPROVED, REJECTED); paginated (limit/offset or cursor).
- Detail: single application with review notes, history, and rejection reason if any.
- Actions: "Request more info," "Approve," "Reject" (reason required). All gated by platform RBAC; all audit-logged.

**B) Dealerships registry**

- List: dealerships with columns such as status, plan, createdAt; filters and pagination.
- Detail: platform metadata + mapping (`platform_dealership_id`, `dealer_dealership_id`), provisioning history, last errors (from provisioning or status calls).
- Actions: Suspend, Activate, Close (with reason where appropriate); each action audit-logged and, per chosen model, may call dealer `POST .../status`.

**C) Invites / owner bootstrap (optional)**

- If platform can trigger creation of dealer owner: platform calls dealer internal endpoint (e.g. "create owner invite" or "bootstrap owner") with agreed payload (e.g. email, dealership id); platform never creates dealer users directly or stores dealer passwords. Flow and endpoint are to be defined in a later step; MVP can defer.

**D) Platform audit logs**

- Searchable by actor, action, target, date range; paginated list and detail view. Read-only; platform RBAC required.

**E) Support tooling (MVP-lite)**

- Create "support session request" or ticket (metadata only; no direct dealer login). Option to defer "support session issued" (e.g. one-time link or session token) to a later phase; spec only describes "create request" for MVP.

---

## Owner bootstrap (first dealer owner)

- After a tenant is provisioned, the dealership has no users until a first owner is created or linked. The dealer system owns all dealer user accounts; the platform never creates dealer user credentials or stores dealer passwords.
- **High-level options**: (1) Platform calls a dealer internal endpoint to create an owner invite (e.g. email + `dealerDealershipId`); the invitee signs up or accepts in the dealer app and is granted the owner role. (2) Dealer provides a one-time bootstrap flow (e.g. link or token in post-provision instructions); the first person to complete sign-up for that tenant becomes owner. (3) At provision time, platform sends `primaryOwnerEmail`; the dealer creates a pending invite or placeholder and sends the invite from the dealer system. Choice of pattern is a later design step; no endpoint design is required in this spec. The principle: the first owner is always created or linked **inside** the dealer portal and auth system.

---

## Routing / RBAC rules

**Platform**

- **Routes**: UI under `/platform/*`, API under `/api/platform/*`.
- **Auth**: Every handler verifies platform session; then enforces `requirePlatformAdmin` (or role-based) **before** any DB read that could reveal existence of entities (e.g. dealerships, applications).
- **Tenant scoping**: N/A for tenant data (platform does not have tenant data); platform resources are scoped by platform user/role only.

**Dealer**

- **Routes**: UI under `/app/*` (or dealer root); API under e.g. `/api/*` (dealer-scoped).
- **Auth**: Every API requires valid dealer session and membership (and optionally active dealership context).
- **RBAC**: Permission check per route (e.g. "customers:read", "deals:write"); least privilege; no blanket admin bypass unless specified.
- **Tenant scoping**: Every business query includes `dealership_id` from membership/context; no cross-tenant access; no endpoint returns or mutates another tenant's data.

**Cross-routing**

- Platform UI may show "Open dealer" link (URL to `https://app.<domain>/...`) only; no session transfer; no shared cookies. Dealer access requires separate dealer login.

---

## Test plan (high-level)

- **Platform auth**: Unauthenticated requests to `/platform/*` and `/api/platform/*` are rejected; no access without platform auth and appropriate role.
- **Dealer auth**: Unauthenticated or non-member requests to dealer UI/API are rejected; no access without dealer auth and membership (+ permission where applicable).
- **Dealer internal API**: Requests without valid JWT (or HMAC) are rejected (401/403); invalid or expired token rejected; replayed `jti` rejected.
- **Provisioning idempotency**: Two identical requests with same Idempotency-Key yield same `dealerDealershipId` and no duplicate tenant creation.
- **Suspension/closure**: Per chosen model (push vs pull), verify that when platform sets SUSPENDED or CLOSED, dealer operations for that tenant are disabled or limited as designed.
- **Audit**: All platform lifecycle transitions (application and provisioning states) and all calls to dealer internal API produce audit records; tests verify presence and non-tampering of logs (high-level; no code in this spec).

---

## Open decisions

1. **Subdomains vs path-based**
   - **Recommendation**: Subdomains — `app.<domain>` (dealer), `platform.<domain>` (platform). Clear separation of origin, cookies, and future scaling (e.g. different infra per subdomain). Path-based (e.g. `/dealer`, `/platform`) is possible but shares origin and requires strict path and cookie handling.

2. **ACTIVE enforcement**
   - **(A) Platform pushes status to dealer**: Platform calls dealer `POST .../status`; dealer stores and enforces. Simpler for dealer (single source of truth locally); platform must call dealer for every status change.
   - **(B) Dealer checks platform**: Dealer resolves "is this dealership active?" from platform (e.g. internal read or webhook). No status stored in dealer DB; always fresh but adds dependency and latency.
   - **Recommendation**: **(A)** for MVP: explicit status endpoint; clear audit trail on dealer side; no polling or read dependency on platform from dealer.

3. **Support session**
   - **Deferred**: MVP = "create support request" only. "Support session issued" (one-time link, restricted session, or view-only) to be designed and implemented later.

4. **Platform storing compliance docs**
   - **Default**: Platform does **not** store tenant documents or links to dealer document storage. If compliance requires proof of X, options later: dealer-generated export, or dealer upload to platform in a controlled flow; no automatic sync of dealer docs to platform in MVP.

5. **Billing (Stripe)**
   - **Scope**: Platform-only. Stripe account and webhooks live in platform app; dealer app has no Stripe keys; subscription/plan/limits stored in platform DB; no payment data in dealer DB.

---

*End of Step 1 spec. No code or schema edits; implementation in later steps.*

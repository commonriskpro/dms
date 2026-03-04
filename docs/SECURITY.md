# DMS Security

## Tenant scoping

- Every business table includes `dealership_id`. All queries are scoped by the active dealership.
- The active dealership is resolved from an encrypted cookie, revalidated on every request: the user must have an active (non-disabled) membership for that dealership. If the membership is invalid, the cookie is cleared and the user gets FORBIDDEN.
- **Never** use client-supplied `dealership_id` for authorization or data access. The server derives the active dealership from the validated session/cookie only.

## RBAC

- Every API route enforces a permission check before performing the action. There is no undocumented “admin bypass.”
- Permissions are granted via roles; roles are per-dealership. Membership ties user ↔ dealership ↔ role.
- Permission keys are defined in `docs/design/core-platform-spec.md` (e.g. `admin.roles.write`, `documents.read`, `documents.write`). Missing permission returns **403 FORBIDDEN**.

## Platform admin

- **Tenant isolation:** Non-platform users **MUST** receive **403 FORBIDDEN** on **all** `/api/platform/*` routes (dealerships, dealerships/[id], invites, pending-users, approve, reject, impersonate). There must be **no way to infer dealership existence**: a non-platform user must never see 404 "Dealership not found" for a path under `/api/platform/*`—`requirePlatformAdmin()` is called **before** any handler logic on every platform route, so unauthorized callers get 403 first. Do not return 404 for "dealership not found" to a non-platform user; that would leak that the dealership exists.
- **Platform admins** are users with a row in **PlatformAdmin** (DB-backed; granted via seed allowlist `PLATFORM_ADMIN_EMAILS` or manual insert). This table is the **source of truth** for platform access—no claim-only or cookie-only auth. Tenant (dealership) admins (Owner, Admin, etc.) have **no** access to `/api/platform/*`; only the presence of a PlatformAdmin row grants access.
- Platform routes (`/api/platform/*`) require `requirePlatformAdmin(userId)` **first**; they do not use dealership context for **authorization**. The `dealershipId` in path or body is the **target** of the operation only. Platform routes **never** use client-supplied `dealershipId` for auth; target comes from path (or body where specified) only.
- **Invite tokens:** Tokens are **unguessable** (cryptographically secure, 32 bytes hex). They are stored in plain form in the DB; they are **never** logged (no `metadata.token`, no console.log of token). Audit metadata is sanitized to redact `token` and PII. **One-time use after accept:** Once an invite is ACCEPTED, resolve (GET) returns **410 Gone** so the token cannot be used to "see" the invite again. Expiry and revoke: invites have `expiresAt`; cancel sets status CANCELLED. Accept uses **only** `invite.roleId`—no client-supplied roleId; no role escalation.
- **Pending approval / approval flow:** Only **platform admins** can approve or reject. `POST .../pending-users/[userId]/approve` and `.../reject` are behind `requirePlatformAdmin`. Approval requires explicit **body.dealershipId** and **body.roleId**; the service validates that the role belongs to the dealership. No implicit owner; no client-driven role escalation. (Self-serve signup creates a PendingApproval row; no tenant-side approval; no self-service “claim” of a dealership.
- **Audit:** Every platform write produces an audit entry. Audit **metadata must not** contain PII (no email, phone, SSN, DOB) or **tokens**; `lib/audit` sanitizes metadata (redacts `email`, `phone`, `token`, etc.). Allowed metadata: IDs (`inviteId`, `dealershipId`, `roleId`, `membershipId`, `userId`) and `changedFields`. Action strings: `platform.invite.created`, `platform.invite.accepted`, `platform.invite.cancelled`, `platform.membership.approved`, `platform.pending.rejected`, plus platform.dealership.* and platform.impersonate.*.
- **Rate limits (invite flow):** Applied per client (IP): **invite_create** 20/min, **invite_resend** 20/min, **invite_accept** 10/min, **invite_resolve** 60/min (to limit token enumeration). Endpoints return **429** when exceeded. See `lib/api/rate-limit.ts`.
- **Impersonation** sets the active-dealership cookie so a platform admin can act in the UI as a given dealership (for troubleshooting). Tenant routes still resolve context via the same cookie but allow platform admins to have an active dealership without membership. Normal users with a disabled dealership have their cookie cleared and get FORBIDDEN.
- When a dealership is **disabled** (`Dealership.isActive = false`), all its memberships are soft-disabled and tenant access for non–platform users is blocked (session returns no active dealership; tenant routes return FORBIDDEN). See `docs/modules/platform-admin.md`.

## Audit guarantees

- Append-only audit log records: create/update/delete on critical entities (dealership, locations, memberships, roles, files), plus sensitive reads (e.g. file.accessed).
- Audit rows include: `actor_id`, `dealership_id`, `action`, `entity`, `entity_id`, `metadata` (no PII), `ip`, `user_agent`, `created_at`.
- Metadata is sanitized to remove PII (SSN, DOB, income, email, phone) and secrets (e.g. token). Audit is never used to store secrets.

## File access

- Private files are stored in Supabase Storage. Only file metadata lives in the DB; blobs are not in the database.
- Download access is via **short-lived signed URLs** only. The signed-url endpoint checks that the file belongs to the active dealership and that the user has `documents.read`. Each issuance is audited (`file.accessed`).
- Uploads are validated: bucket allowlist, MIME allowlist, max size (e.g. 25MB), and filename/path sanitization (no path traversal or control characters). Storage paths are prefixed by `dealershipId` so client input cannot escape tenant scope.

## Documents module (sensitive-read audit, no PII)

- **Signed-url:** Every successful call to get a signed URL is a sensitive read and writes an audit row (`document.accessed`). Failed lookups (NOT_FOUND or FORBIDDEN) do not write an access audit entry.
- **No PII:** Audit metadata for documents does not include PII. Document titles and tags must not contain SSN, DOB, or other sensitive data; storage paths use sanitized filenames only.

## What is NOT stored

- **SSN / DOB / income**: Not stored by default. Finance flows use lender embed/redirect; only external IDs/status are stored unless explicitly approved. The **Customers** module does not store SSN or DOB; customer profiles are contact and lead data only.
- **Raw payment card data**: Never stored. Use tokenized providers only.
- **Passwords**: Handled by Supabase Auth; we do not store or log them.

## Inventory module

- **Tenant isolation:** All vehicle and photo access is scoped by `dealership_id` from auth. Cross-tenant vehicle ID or photo ID returns **404 NOT_FOUND** on GET/PATCH/DELETE and photo upload/delete. List, search, filter, and pagination return only the active dealership’s vehicles.
- **RBAC:** `inventory.read` for list, detail, aging, VIN decode, and photo metadata; `inventory.write` for create/update/delete vehicles and upload/delete photos (photo operations also require `documents.write`). Missing permission returns **403 FORBIDDEN**.
- **Validation:** List and aging query params validated with Zod at the edge: `limit` (1–100), `offset` ≥ 0, `minPrice`/`maxPrice` ≥ 0, `minPrice` ≤ `maxPrice`, `status` from enum (AVAILABLE, HOLD, SOLD, WHOLESALE, REPAIR, ARCHIVED). Invalid values return **400**.
- **Audit:** Create/update/delete vehicle and photo upload/delete are audited; metadata does not include PII. VIN decode and file access (signed URL) are audited where applicable.

## Module-specific isolation (Customers)

- Customer, contact, notes, tasks, and activity data are strictly scoped by `dealership_id`. List, search, and GET by id all enforce tenant scope. Cross-tenant customer ids return 404 NOT_FOUND. Search by phone or email cannot return customers belonging to another dealership.

## Deals module (money safety + immutability)

- **Money:** All deal amounts are stored as BIGINT cents; API uses string cents. No floating-point for persisted values. UI uses `lib/money.ts` for parse/format only.
- **CONTRACTED immutability:** Once a deal is CONTRACTED, financial fields and fee/trade edits are locked; only status → CANCELED is allowed. Enforced in service layer with 409 CONFLICT on mutation attempts.

## Finance module (money integrity + immutability)

- **Tenant isolation:** All finance routes and DB access are scoped by `dealership_id` from auth. Cross-tenant deal or product IDs return 404 NOT_FOUND (no cross-tenant read or mutate).
- **RBAC:** Every route enforces `finance.read` (GET finance, GET products) or `finance.write` (PUT/PATCH/POST/DELETE). No admin bypass. Missing permission returns 403 FORBIDDEN.
- **Money integrity:** All amounts are BIGINT cents; APR in basis points (Int). Payment and totals are computed with BigInt-only math (no floats, no `Math.round` on floats). HALF_UP rounding at cent boundary; deterministic (unit tests with known vectors). `totalOfPaymentsCents = monthlyPaymentCents * termMonths`; `financeChargeCents = totalOfPaymentsCents - amountFinancedCents`.
- **CONTRACTED immutability:** When Deal.status = CONTRACTED, the finance shell is locked: PUT finance, PATCH status (except → CANCELED if allowed), POST/PATCH/DELETE products return 409 CONFLICT. DealFinance.status is set to CONTRACTED when the deal contracts; event `finance.locked` is emitted. Product inclusion and soft-delete rules exclude deleted products from totals and list.

## CRM module (pipeline, automation, sequences, jobs)

- **Tenant isolation:** All CRM routes use `dealership_id` from auth only. Cross-tenant resource IDs return **404 NOT_FOUND**. List endpoints return only the authenticated dealership’s data.
- **RBAC:** `crm.read` for all GETs; `crm.write` for all POST/PATCH/DELETE. Job worker POST requires `crm.write`; cron GET requires valid **CRON_SECRET** (no client-supplied dealership).
- **Atomic job claim:** Jobs are claimed with a single UPDATE and row locking so only one worker executes each job; stuck “running” jobs are reclaimed after a timeout.
- **Idempotency:** AutomationRun uniqueness and canonical event keys prevent duplicate automation runs; delayed jobs use a run transition (scheduled → running) so retries do not duplicate actions.
- **Loop guard:** Per-entity per-minute run cap and origin/depth checks prevent unbounded automation loops.
- **Sequence stop:** Step execution re-checks instance status and opportunity WON/LOST; delayed steps after stop are skipped with no side effects.
- **Audit:** CRM audit metadata contains only IDs and changedFields; no PII (no email, phone, address, or message content).
- **UI permission gates:** UI checks `crm.read` before rendering CRM data; when the user lacks `crm.read`, pages show "You don't have access to CRM." and **no** requests are made to `/api/crm/*`. Mutation controls (Move, Create/Edit/Delete, Run worker) are shown only when the user has `crm.write`.
- **UI safe rendering:** Untrusted strings (activity metadata, rule names/descriptions, job payload/lastError) are rendered as text only (e.g. `<pre>{…}</pre>` or text nodes). The CRM UI does not use `dangerouslySetInnerHTML` for user or job data, preventing HTML/script injection.

## Lender integration module

- **Tenant isolation:** All lender, application, submission, and stipulation access is scoped by `dealership_id` from auth. Cross-tenant resource IDs (e.g. Dealer A requesting Dealer B's application or lender) return **404 NOT_FOUND**. Lists for another tenant's deal return empty or NOT_FOUND per route design.
- **RBAC:** `lenders.read` / `lenders.write` and `finance.submissions.read` / `finance.submissions.write` are enforced on every route. No admin bypass.
- **Snapshot immutability:** Submission financial snapshot is taken at creation and is immutable.
- **Deal canceled:** When Deal is CANCELED, submission updates only allow status/fundingStatus → CANCELED; deal PATCH (e.g. notes) returns **409 CONFLICT**.
- **Funding:** FUNDED is allowed only when Deal is CONTRACTED and only via the funding endpoint.
- **Stip document linking:** Document must be same tenant, entityType DEAL, entityId = submission.dealId, and not soft-deleted. Otherwise **NOT_FOUND**. Linking does not create document.accessed audit.
- **Audit:** Audit metadata for applications and submissions contains only IDs and changedFields; no applicant email/phone or decisionNotes PII.

## Secure defaults

- Active dealership cookie: **HttpOnly**, **Secure** in production, **SameSite=Strict**, **AES-256-GCM** encrypted. Cleared when membership is invalid or on logout.
- Rate limiting applies to auth, session switch, file upload, signed-url, report export, and **invite flow** (invite_create, invite_resend, invite_accept, invite_resolve). The in-memory limiter is replaceable (e.g. Upstash Redis) for production—see `docs/DEPLOYMENT.md`.

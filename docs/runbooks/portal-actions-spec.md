# Portal Actions Spec — Platform UI + Dealer UX

## Overview

This spec defines the exact screens, buttons, RBAC rules, API calls, audit requirements, and dealer UX entry points for the portal actions work. No breaking API response shapes.

---

## 1. Platform: Applications

### 1.1 Screens and Buttons

| Screen | Button / Control | Visibility |
|--------|------------------|------------|
| **Applications list** (`/platform/applications`) | **New Application** | Owner + Compliance only |
| **Applications list** | Status filter, table, pagination | All (Owner, Compliance, Support) |
| **Application detail** (`/platform/applications/[id]`) | **Approve** | Owner + Compliance only; shown when status = APPLIED |
| **Application detail** | **Reject** (opens modal with required reason) | Owner + Compliance only; shown when status = APPLIED |
| **Application detail** | Read-only details | Support sees details only (no Approve/Reject) |

### 1.2 API Calls

| Action | Method | Route | Payload / Notes |
|--------|--------|--------|------------------|
| List applications | GET | `/api/platform/applications` | Query: `limit`, `offset`, `status?` |
| Create application | POST | `/api/platform/applications` | Body: `legalName`, `displayName`, `contactEmail`, `contactPhone?`, `notes?` (Zod: `applicationCreateRequestSchema`) |
| Get application | GET | `/api/platform/applications/[id]` | — |
| Approve | POST | `/api/platform/applications/[id]/approve` | No body |
| Reject | POST | `/api/platform/applications/[id]/reject` | Body: `{ reason: string }` (required; Zod: `applicationRejectRequestSchema`) |

### 1.3 RBAC

- **PLATFORM_OWNER, PLATFORM_COMPLIANCE**: Create, Approve, Reject, list, detail.
- **PLATFORM_SUPPORT**: List, detail only (read-only). No Create / Approve / Reject.

Enforce role **before** any DB lookup; return 403 for unauthorized (no existence leak via 404).

---

## 2. Platform: Dealerships

### 2.1 Screens and Buttons

| Screen | Button / Control | Visibility |
|--------|------------------|------------|
| **Dealership detail** (`/platform/dealerships/[id]`) | **Provision** | Owner only; disabled if already provisioned (`dealerDealershipId` present) or status ≠ APPROVED |
| **Dealership detail** | **Activate** (Set ACTIVE) | Owner only |
| **Dealership detail** | **Suspend** (opens modal, reason required) | Owner only |
| **Dealership detail** | **Close** (opens modal, reason required) | Owner only |
| **Dealership detail** | **Send Owner Invite** | Owner only; when provisioned |
| **Dealership list** | List, filters, pagination | Owner, Compliance, Support |

### 2.2 API Calls

| Action | Method | Route | Payload / Notes |
|--------|--------|--------|------------------|
| List dealerships | GET | `/api/platform/dealerships` | Query: `limit`, `offset`, `status?` |
| Get dealership | GET | `/api/platform/dealerships/[id]` | — |
| Provision | POST | `/api/platform/dealerships/[id]/provision` | Body: `{ idempotencyKey: string }` (required). Header `Idempotency-Key` optional duplicate. |
| Set status | POST | `/api/platform/dealerships/[id]/status` | Body: `{ status: "ACTIVE" \| "SUSPENDED" \| "CLOSED", reason?: string }`. **Reason required for SUSPENDED and CLOSED** (Zod: `platformSetDealershipStatusRequestSchema`). |

### 2.3 RBAC

- **PLATFORM_OWNER**: Provision, status (Activate/Suspend/Close), owner invite, list, detail.
- **PLATFORM_COMPLIANCE, PLATFORM_SUPPORT**: List, detail only (read-only).

Enforce platform role **before** lookup; 403 for non-owner on provision/status.

---

## 3. Platform: Audit Logs

### 3.1 Screens and Buttons

| Screen | Control | Visibility |
|--------|---------|------------|
| **Audit list** (`/platform/audit`) | Filters: action, targetType, targetId, actor, dateFrom, dateTo | All (Owner, Compliance, Support) |
| **Audit list** | Pagination (limit/offset) | All |
| **Audit list** | Row click → **detail** (modal or detail page) | All |
| **Audit detail** | Show: actorPlatformUserId, action, targetType, targetId, beforeState (JSON), afterState (JSON), reason, requestId, idempotencyKey, createdAt | All |

### 3.2 API Calls

| Action | Method | Route | Payload / Notes |
|--------|--------|--------|------------------|
| List audit | GET | `/api/platform/audit` | Query: `limit`, `offset`, `action?`, `targetType?`, `targetId?`, `actor?`, `dateFrom?`, `dateTo?` (Zod: `platformAuditQuerySchema`; add `targetType` if missing). |
| Get audit entry | GET | `/api/platform/audit/[id]` | Single entry by ID. Enforce platform auth + role before lookup. |

### 3.3 RBAC

- **PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT**: List and get audit entry (read-only). Enforce platform auth + role **before** lookup.

---

## 4. Audit Requirements (Platform)

All platform mutations must write to the **platform audit log** (append-only). Each row must include:

| Field | Required | Notes |
|-------|----------|--------|
| actorPlatformUserId | Yes | Platform user ID performing the action |
| action | Yes | e.g. `application.created`, `application.approved`, `application.rejected`, `dealership.provision`, `dealership.status` |
| targetType | Yes | e.g. `application`, `dealership` |
| targetId | Yes (where applicable) | Target entity ID |
| beforeState | Optional | Snapshot before change (object) |
| afterState | Optional | Snapshot after change (object) |
| reason | Optional | Required for reject / suspend / close (stored here) |
| requestId | Optional | Correlation ID for the request |
| idempotencyKey | Optional | For provision and other idempotent operations |

- **Applications**: create, approve, reject already audited.
- **Dealerships**: provision (requestId + idempotencyKey), status (requestId, reason for SUSPENDED/CLOSED) already audited.
- **Audit API**: list returns paginated rows; detail by ID returns one row (include requestId/idempotencyKey in response).

---

## 5. Dealer UX: Invite + Lifecycle

### 5.1 Accept Invite Entry Point

- **Where**: On **login** and **unauthenticated home** (e.g. `/` when not signed in).
- **What**: Visible CTA: **“Have an invite? Accept it”** (or similar) linking to **`/accept-invite`**.
- **Behavior**: No change to invite security rules. Existing flow: user opens `/accept-invite?token=...` (from email) or `/accept-invite` and can sign in with `?next=/accept-invite` to land on accept page after login. CTA simply makes this path discoverable.
- **Do not**: Invent new invite routes or change validation/accept logic.

### 5.2 Lifecycle Visibility Panel

- **Where**: In the **app shell** (header/topbar or a consistent place when logged in with an active dealership). Alternatively on **settings** or a dedicated “Dealership” area if no global header.
- **What**:
  - Show **active dealership name**.
  - Show **lifecycleStatus** badge: **ACTIVE** | **SUSPENDED** | **CLOSED**.
- **SUSPENDED**:
  - Link or button to a small **help modal/page** explaining “read-only mode” (writes blocked; data view-only).
  - Existing `SuspendedBanner` can remain; ensure it’s visible and optionally link to this help content.
- **CLOSED**:
  - Ensure **`/closed`** shows:
    - **“Switch dealership”** CTA → e.g. `/get-started` (or existing switch flow).
    - **“Contact support”** CTA (e.g. mailto or support link).
  - These CTAs already exist on `ClosedScreen`; verify and keep.

### 5.3 No Platform Controls in Dealer

- Dealer app must **not** expose platform-only actions (provision, set status, approve/reject applications). Only lifecycle **visibility** and **accept invite** entry points.

---

## 6. Test Plan (Deployed URLs)

Assumed base URLs (replace with actual Vercel URLs):

- **Platform**: `https://<platform-project>.vercel.app`
- **Dealer**: `https://<dealer-project>.vercel.app`

### 6.1 Platform

1. **Create application**  
   - As Owner or Compliance: Applications → **New Application** → submit form → success toast, list refresh.  
   - As Support: **New Application** not visible.

2. **Approve**  
   - Open an APPLIED application → **Approve** → success; status → APPROVED.  
   - As Support: no Approve/Reject buttons.

3. **Reject**  
   - Open an APPLIED application → **Reject** → modal, enter reason → submit → success; status → REJECTED.

4. **Provision**  
   - Dealership detail (APPROVED, not yet provisioned) → **Provision** (idempotency key sent) → success; dealerDealershipId and provisionedAt shown.

5. **Set SUSPENDED**  
   - Dealership detail → **Suspend** → reason modal → submit.  
   - In **Dealer** app: verify banner/read-only and writes blocked.

6. **Set ACTIVE**  
   - Dealership detail → **Activate** → in Dealer app verify writes enabled.

7. **Set CLOSED**  
   - Dealership detail → **Close** → reason modal → submit.  
   - In Dealer app: verify redirect to `/closed`, “Switch dealership” and “Contact support” visible.

8. **Audit**  
   - Audit Logs → filters + pagination.  
   - Row click → detail with before/after JSON, requestId, idempotencyKey.  
   - Verify audit rows exist for: create application, approve, reject, provision, status changes.

### 6.2 Dealer

1. **Accept invite CTA**  
   - From login page and unauthenticated home: “Have an invite? Accept it” → links to `/accept-invite`.  
   - With valid token: resolve → sign in → accept → redirect to dashboard.

2. **Lifecycle badge**  
   - When logged in: app shell (or settings) shows dealership name and lifecycle status (ACTIVE/SUSPENDED/CLOSED).

3. **SUSPENDED**  
   - When status SUSPENDED: banner/help explains read-only; write actions blocked.

4. **CLOSED**  
   - When status CLOSED: redirect to `/closed`; “Switch dealership” and “Contact support” CTAs work.

### 6.3 Deployed-only manual checklist (replace base URLs with your Vercel URLs)

**Platform** (e.g. `https://platform-xxx.vercel.app`):

1. Create application: Applications → **New Application** → submit → toast + list refresh.
2. Approve: Open an APPLIED application → **Approve** → status APPROVED.
3. Reject: Open an APPLIED application → **Reject** → reason modal → status REJECTED.
4. Provision: Dealership (APPROVED, not provisioned) → **Provision** → success; dealerDealershipId shown.
5. Set SUSPENDED: Dealership → **Suspend** → reason → in Dealer app verify banner + writes blocked.
6. Set ACTIVE: Dealership → **Set ACTIVE** → in Dealer app verify writes enabled.
7. Set CLOSED: Dealership → **Close** → reason → in Dealer app verify redirect to `/closed`.
8. Audit: Audit Logs → filters (e.g. targetType) + pagination → row click → detail with before/after JSON, requestId, idempotencyKey. Verify audit rows for create/approve/reject/provision/status.

**Dealer** (e.g. `https://dealer-xxx.vercel.app`):

1. Login page and home (logged out): **Have an invite? Accept it** → `/accept-invite`.
2. Logged in: topbar shows dealership name + lifecycle badge (ACTIVE/SUSPENDED/CLOSED).
3. SUSPENDED: banner + "Learn more" → read-only explanation.
4. CLOSED: `/closed` → "Switch dealership" (→ `/get-started`) and "Contact support" work.

---

## 7. Validation and Security Summary

- **Zod at edge**: All API inputs (query, body) validated with Zod; prefer `@dms/contracts` schemas.
- **Reason**: Required for reject (application), and for SUSPENDED/CLOSED (dealership status).
- **Idempotency**: Provision requires `idempotencyKey` in body (and optionally `Idempotency-Key` header).
- **403 before lookup**: Platform routes enforce role before fetching by ID where applicable.
- **Pagination**: All list endpoints (applications, dealerships, audit) paginated (limit/offset).
- **No breaking API shapes**: Response types remain backward compatible.

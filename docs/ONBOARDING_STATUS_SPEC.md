# Onboarding Status + Timeline — Spec (Step 1)

**Step 1 — Architecture & contracts only. No code changes.**

This document defines a first-class, secure, non-PII “Onboarding Status” API (plus optional timeline/events) so onboarding state is observable in one call, without leaking tokens or email.

**Context:** Platform → Dealer flow: Application → Approve → Provision → Owner Invite → Accept Invite → Membership → Session Switch → Dashboard.

**Problem:** Debugging is hard because support must manually inspect both apps, multiple tables, and logs to see where onboarding is stuck.

**Goal:** One API call to see exactly where an application’s onboarding is, and (optionally) a chronological timeline for support.

**Non-negotiables:** Dealer DB multi-tenant; Platform DB single-tenant; RBAC on platform endpoints; Zod at the edge; deterministic installs; Jest only; no token or raw-email leakage (masked/hash only); internal API JWT with issuer/audience from `@dms/contracts`.

---

## SECTION 1 — ENDPOINTS (contracts)

### A) Platform endpoint (RBAC protected)

**Path:** `GET /api/platform/applications/[id]/onboarding-status`

**Auth:**
- `requirePlatformAuth` + platform admin role (e.g. `requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_SUPPORT"])` or equivalent “can see applications” role).
- Only platform admins/support may call this endpoint.

**Inputs:**
- **params:** `applicationId` (UUID); validate with Zod at the edge.

**Output shape (draft):**

```ts
{
  data: {
    applicationId: string;           // UUID
    applicationStatus: "APPLIED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    contactEmailMasked?: string;     // e.g. "c***@gmail.com"; optional (can omit and use only hash)
    contactEmailHash: string;        // deterministic hash (e.g. SHA-256 hex), no raw email
    platformDealershipId: string | null;   // UUID or null
    platformDealershipStatus: string | null;  // e.g. APPROVED | PROVISIONING | PROVISIONED | ACTIVE | SUSPENDED | CLOSED
    mapping: {
      dealerDealershipId: string;    // UUID
      provisionedAt: string;         // ISO 8601 datetime
    } | null;
    ownerInvite: {
      status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED" | "UNKNOWN";
      invitedAt?: string;            // ISO 8601
      expiresAt?: string | null;
      acceptedAt?: string | null;
    } | null;
    ownerJoined: boolean;            // true when invite ACCEPTED or membership known (derived)
    nextAction: string;              // see Section 4
  }
}
```

**Rules:**
- MUST NOT return invite token or `acceptUrl` containing a token.
- MUST NOT return raw email. Only `contactEmailMasked` and/or `contactEmailHash`.
- 404 when application not found; 403 when caller lacks platform admin.

**How Platform computes it (spec):**
1. Read Platform DB: `Application` (by `applicationId`), `PlatformDealership` (if `Application.dealershipId` set), `DealershipMapping` (by `platformDealershipId`), and optionally `PlatformEmailLog` for “last sent” timing.
2. Derive `contactEmailHash` from `Application.contactEmail` (e.g. same `hashEmail` as elsewhere); optionally derive `contactEmailMasked` (e.g. first char + `***` + `@` + domain).
3. If `DealershipMapping` exists for this application’s dealership:
   - Call Dealer internal: `GET /api/internal/dealerships/[dealerDealershipId]/owner-invite-status?email=[Application.contactEmail]`.
   - Platform passes raw email only in this internal server-to-server call; the **response** from the platform’s own endpoint to the UI must never contain raw email—only masked/hash in the payload above.
4. If no mapping: `ownerInvite` should be `null` or `status: "UNKNOWN"`; `nextAction` should indicate provisioning required (see Section 4).

---

### B) Dealer endpoint (authenticated, user-facing)

**Path:** `GET /api/auth/onboarding-status`

**Auth:**
- `requireUser` (session required). Returns 401 if not authenticated.

**Inputs:** None (current user from session).

**Output shape (draft):**

```ts
{
  data: {
    userIdTail: string;              // last 4–8 chars of userId for support/debug (no full id)
    emailMasked?: string;            // e.g. "u***@example.com"
    membershipsCount: number;
    hasActiveDealership: boolean;
    activeDealershipIdTail?: string; // last 4–8 chars if has active
    pendingInvitesCount?: number;    // count of PENDING invites for this user’s email; no tokens
    nextAction: "CHECK_EMAIL_FOR_INVITE" | "SELECT_DEALERSHIP" | "NONE";
  }
}
```

**Rules:**
- No token exposure. No invite tokens, no accept URLs with tokens.
- `pendingInvitesCount` is allowed; do not leak dealership names/ids for invites unless the user is already a member of that dealership or the product explicitly entitles them to see “you have N pending invites.”
- Derive `nextAction`: if `membershipsCount > 0` and `!hasActiveDealership` → `SELECT_DEALERSHIP`; if `membershipsCount === 0` and `pendingInvitesCount > 0` → `CHECK_EMAIL_FOR_INVITE`; else `NONE`.

---

### C) Dealer internal endpoint (existing — contract documented here)

**Path:** `GET /api/internal/dealerships/[dealerDealershipId]/owner-invite-status?email=...`

**Auth:**
- Internal JWT required (`Authorization: Bearer <JWT>`). Same `INTERNAL_API_JWT_SECRET`, issuer/audience from `@dms/contracts`. Rate limit applies.

**Inputs:**
- **params:** `dealerDealershipId` (UUID, Zod).
- **query:** `email` (required, max 320 chars).

**Response (success 200):**  
Schema: `dealerOwnerInviteStatusResponseSchema` (in `@dms/contracts`):

```ts
{
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expiresAt: string | null;   // ISO 8601
  acceptedAt: string | null;  // ISO 8601
}
```

**Rules:**
- Status and timestamps only. **Never** return token, `acceptUrl`, or raw email in the response.
- When no invite found for (dealership, email), dealer may return a synthetic “PENDING” with null timestamps (as in current implementation) so platform can treat “no invite yet” consistently.

---

## SECTION 2 — OPTIONAL TIMELINE (events)

### Option A: Use existing PlatformAuditLog

Platform already has `PlatformAuditLog` with `action`, `targetType`, `targetId`, `beforeState`, `afterState`, `createdAt`, `actorPlatformUserId`.

- **Use for timeline:** Query logs where `targetType = "application"` and `targetId = applicationId`, order by `createdAt` ascending.
- **Relevant actions (examples):** `application.approved`, `application.provision`, `application.owner_invite_sent` (and any existing actions that map to provisioning/invite sent).
- **Payload rules:** `beforeState` / `afterState` must remain token-free and must not contain raw email; use at most `recipientHash` or `contactEmailHash` if needed.

Timeline can be built in Platform UI by fetching onboarding-status and (separately or combined) the audit log entries for that application.

### Option B: New table PlatformOnboardingEvent (optional)

If a dedicated, normalized timeline is preferred:

**Table (conceptual):**

| Column                   | Type    | Notes |
|--------------------------|---------|--------|
| id                       | UUID    | PK    |
| eventType                | Enum    | See below |
| applicationId            | UUID    | FK Application |
| platformDealershipId     | UUID?   | Optional |
| dealerDealershipIdTail   | string? | Last 4–8 chars only, no full id |
| payload                  | Json    | Token-free; email only as hash if needed |
| actorPlatformUserId      | UUID    | Who triggered (if any) |
| recordedAt               | DateTime| Default now() |

**eventType enum (suggested):**
- `APPLICATION_APPROVED`
- `DEALERSHIP_PROVISIONED`
- `OWNER_INVITE_SENT`
- `OWNER_INVITE_ACCEPTED` (or inferred from dealer status)
- `OWNER_JOINED` (membership created / first session switch)

**Payload rules:**
- No tokens. No raw email. Only hashes (e.g. `contactEmailHash`) or tail identifiers as needed for support.

**How timeline is shown:**
- Platform UI: “Onboarding Timeline” for an application — list events chronologically (e.g. “Approved”, “Dealership provisioned”, “Owner invite sent”, “Owner joined”) with `recordedAt` and optional actor. No tokens or PII.

---

## SECTION 3 — SECURITY & PRIVACY REQUIREMENTS

- **No tokens** in any onboarding-status or timeline response, log, or audit payload. No `acceptUrl` that contains a token in responses to clients.
- **No raw email** in platform responses to the UI. Only masked email and/or deterministic hash (e.g. SHA-256 of normalized email).
- **Platform onboarding-status** is RBAC protected: platform admin (or equivalent) only.
- **Dealer user onboarding-status** returns only what the authenticated user is allowed to know (own memberships, own pending invite count, recommended next action).
- **Internal call** (platform → dealer owner-invite-status) must validate JWT (issuer/audience/exp from `@dms/contracts`) and apply rate limiting as for other internal endpoints.

---

## SECTION 4 — DATA SOURCES + DERIVATIONS

### Platform onboarding-status

| Field                     | Source / derivation |
|---------------------------|----------------------|
| applicationId             | Route param (Zod UUID). |
| applicationStatus         | `Application.status`. |
| contactEmailMasked        | From `Application.contactEmail`: e.g. first character + `***` + `@` + domain. Optional; can omit. |
| contactEmailHash          | Deterministic hash of normalized `Application.contactEmail` (e.g. same as `hashEmail` used elsewhere). |
| platformDealershipId      | `Application.dealershipId` (null if not linked). |
| platformDealershipStatus  | If `platformDealershipId` set: `PlatformDealership.status`; else null. |
| mapping                   | If `platformDealershipId` set: `DealershipMapping` where `platformDealershipId`; else null. Contains `dealerDealershipId`, `provisionedAt`. |
| ownerInvite               | If mapping exists: call dealer `GET .../owner-invite-status?email=Application.contactEmail`; map response to `{ status, invitedAt?, expiresAt?, acceptedAt? }`. If no mapping or call fails: `null` or `status: "UNKNOWN"`. **Never** include token or acceptUrl. |
| ownerJoined               | `true` when `ownerInvite?.status === "ACCEPTED"`. Optionally also `true` if platform later has a way to know membership exists (e.g. dealer callback or internal check); for Step 1, “ACCEPTED” is sufficient. |
| nextAction                | See priority below. |

### nextAction priority (platform)

1. If `applicationStatus` is not `APPROVED` → `"NONE"` (or a dedicated `"APPROVE"` if product wants to show that).
2. If `platformDealershipId` is null → `"PROVISION"`.
3. If `mapping` is null → `"PROVISION"`.
4. If `ownerInvite` is null or `status === "UNKNOWN"` → `"INVITE_OWNER"`.
5. If `ownerInvite.status === "PENDING"` → `"WAIT_FOR_ACCEPT"` (or `"RESEND_INVITE"` if invite is expired and product supports resend).
6. If `ownerInvite.status === "EXPIRED"` (or similar) and resend is allowed → `"RESEND_INVITE"`.
7. If `ownerInvite.status === "ACCEPTED"` but user still “stuck” (e.g. no active dealership reported) → `"REPAIR_ROLES"` or `"CHECK_ACTIVE_DEALERSHIP"` (for support to suggest session/switch or role repair).
8. Else → `"NONE"`.

### Dealer user onboarding-status

| Field                   | Source / derivation |
|-------------------------|----------------------|
| userIdTail              | Last 4–8 characters of session user id. |
| emailMasked             | From session/profile email; mask the same way as platform (optional). |
| membershipsCount        | Count of `Membership` for current user where `disabledAt` is null. |
| hasActiveDealership     | From session/cookie: whether active dealership is set. |
| activeDealershipIdTail  | If has active: last 4–8 chars of that dealership id (optional). |
| pendingInvitesCount     | Count of `DealershipInvite` where email = current user email and status = PENDING and (expiresAt is null or expiresAt > now). No token or dealership detail in response. |
| nextAction              | If `membershipsCount > 0` and `!hasActiveDealership` → `"SELECT_DEALERSHIP"`; if `membershipsCount === 0` and `pendingInvitesCount > 0` → `"CHECK_EMAIL_FOR_INVITE"`; else `"NONE"`. |

---

## SECTION 5 — ACCEPTANCE CRITERIA (for Step 2/3/4 later)

- A **single** platform API call (`GET /api/platform/applications/[id]/onboarding-status`) lets support see exactly where that application’s onboarding is stuck (nextAction + full status).
- No sensitive leakage: no token, no raw email in any response or log. Masked email and/or hash only.
- Contract schemas are defined; prefer adding Zod schemas to `@dms/contracts` for request/response of the new endpoints (platform onboarding-status response, dealer onboarding-status response).
- Internal dealer owner-invite-status contract is already in contracts; ensure it is referenced and that platform does not expose its raw-email internal call in its own response.

### Example JSON responses (platform)

**1) Approved, not provisioned**

```json
{
  "data": {
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "applicationStatus": "APPROVED",
    "contactEmailMasked": "o***@acme.com",
    "contactEmailHash": "a1b2c3d4e5f6...",
    "platformDealershipId": null,
    "platformDealershipStatus": null,
    "mapping": null,
    "ownerInvite": null,
    "ownerJoined": false,
    "nextAction": "PROVISION"
  }
}
```

**2) Provisioned, invite pending**

```json
{
  "data": {
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "applicationStatus": "APPROVED",
    "contactEmailMasked": "o***@acme.com",
    "contactEmailHash": "a1b2c3d4e5f6...",
    "platformDealershipId": "660e8400-e29b-41d4-a716-446655440001",
    "platformDealershipStatus": "PROVISIONED",
    "mapping": {
      "dealerDealershipId": "770e8400-e29b-41d4-a716-446655440002",
      "provisionedAt": "2025-03-01T12:00:00.000Z"
    },
    "ownerInvite": {
      "status": "PENDING",
      "invitedAt": "2025-03-02T09:00:00.000Z",
      "expiresAt": null,
      "acceptedAt": null
    },
    "ownerJoined": false,
    "nextAction": "WAIT_FOR_ACCEPT"
  }
}
```

**3) Invite accepted / owner joined**

```json
{
  "data": {
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "applicationStatus": "APPROVED",
    "contactEmailMasked": "o***@acme.com",
    "contactEmailHash": "a1b2c3d4e5f6...",
    "platformDealershipId": "660e8400-e29b-41d4-a716-446655440001",
    "platformDealershipStatus": "PROVISIONED",
    "mapping": {
      "dealerDealershipId": "770e8400-e29b-41d4-a716-446655440002",
      "provisionedAt": "2025-03-01T12:00:00.000Z"
    },
    "ownerInvite": {
      "status": "ACCEPTED",
      "invitedAt": "2025-03-02T09:00:00.000Z",
      "expiresAt": null,
      "acceptedAt": "2025-03-03T14:30:00.000Z"
    },
    "ownerJoined": true,
    "nextAction": "NONE"
  }
}
```

---

**End of spec. No code changes in this step.**

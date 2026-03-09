# Dealer Application Approval V1 — Security QA

**Sprint:** Dealer Application + Approval Flow V1  
**Step:** 4 — Security QA  
**Scope:** Implemented application → approval → activation flow only. No redesign; routes/RBAC unchanged unless a real issue was found.

---

## 1. Public apply / invite flow

### 1.1 Application IDs cannot be abused to view or edit another application

- **GET /api/apply/[id]** and **PATCH /api/apply/[id]** use only the path parameter `id` (UUID). There is no session or tenant scope; access is by possession of the application ID (e.g. “resume by link”).
- **Finding:** By design, anyone with an application ID can load or update that application. Application IDs are UUIDs (unguessable). Risk is limited to link leakage (e.g. sharing the resume link). No cross-application data leak: each ID maps to a single row; there is no way to enumerate or guess other IDs.
- **Verdict:** Acceptable. No change.

### 1.2 Invite token route only resolves the correct invite/application

- **GET /api/apply/invite/[token]** resolves the invite by token (status/expiry validated), then calls `getApplicationByInviteId(invite.id)` and creates a draft only if none exists. The returned application is always the one linked to that invite.
- **Finding:** `getDealerApplicationByInviteId` uses `findFirst` with `orderBy: { createdAt: "desc" }`, so if multiple applications existed for the same invite (see 1.5), the most recent would be returned. Invite flow itself creates at most one application per invite (create only when `!app`). Optional hardening applied: `createDraft` now reuses an existing application when `inviteId` is provided, so one invite → one application.
- **Verdict:** Correct. Optional hardening applied in service.

### 1.3 Public PATCH limited to allowed statuses only

- **PATCH /api/apply/[id]** body is validated with `updateDraftBodySchema`: only profile fields (`businessInfo`, `ownerInfo`, `primaryContact`, `additionalLocations`, `pricingPackageInterest`, `acknowledgments`). No `status` or other lifecycle fields.
- **Finding:** Service `updateDraft` allows updates only when `app.status` is in `SUBMITTABLE_STATUSES` (`draft`, `invited`). So public PATCH cannot set or change status; it is effectively “draft/invited only.”
- **Verdict:** Correct. No change.

### 1.4 Public submit cannot spoof internal lifecycle fields

- **POST /api/apply/[id]/submit** takes no body; it calls `submitApplication(id)` only. Service sets `status: "submitted"` and `submittedAt` server-side. No client-supplied status, reviewerUserId, reviewNotes, or rejectionReason.
- **Verdict:** Correct. No change.

### 1.5 Submitted/approved/rejected states not editable unless intended

- **PATCH /api/apply/[id]** goes through `updateDraft`, which throws `INVALID_STATE` when status is not in `SUBMITTABLE_STATUSES` (draft, invited). So submitted, approved, rejected, activation_sent, and activated applications cannot be edited via public API.
- **Verdict:** Correct. No change.

---

## 2. Internal review flow

### 2.1 /api/platform/dealer-applications* is platform-auth only

- **GET /api/platform/dealer-applications** and **GET/PATCH /api/platform/dealer-applications/[id]** call `requirePlatformAuth()` and then `requirePlatformRole(user, [...]).` List/GET require PLATFORM_OWNER, PLATFORM_COMPLIANCE, or PLATFORM_SUPPORT; PATCH requires PLATFORM_OWNER or PLATFORM_COMPLIANCE.
- **Verdict:** Platform-only. No change.

### 2.2 List/detail/patch cannot be used by unauthorized users

- Platform routes are in the platform app; they are not exposed to the dealer app’s end users. Dealer app exposes only public apply routes (`/api/apply/*`) and internal API (`/api/internal/applications*`). Internal API is protected by `verifyInternalApiJwt` (shared secret JWT); only the platform server (using `callDealerApplicationsList`, `callDealerApplicationGet`, `callDealerApplicationPatch`) holds the secret. So list/detail/patch are not callable by dealer users or the public.
- **Verdict:** Correct. No change.

### 2.3 Approve/reject/save-notes paths properly restricted

- Approve, reject, and save-notes are performed via platform **PATCH /api/platform/dealer-applications/[id]** with body `status`, `reviewNotes`, `rejectionReason`, etc. That route is protected by platform auth + PLATFORM_OWNER or PLATFORM_COMPLIANCE. Dealer internal PATCH accepts the same fields and is only callable with a valid internal JWT.
- **Verdict:** Correct. No change.

### 2.4 Review notes and rejection reasons not exposed publicly

- Public apply responses (**GET /api/apply/[id]**, **GET /api/apply/invite/[token]**) return only: `applicationId`, `status`, `source`, `ownerEmail`, `submittedAt`, `profile`. They do not include `reviewNotes`, `rejectionReason`, or `reviewerUserId`. Those fields are only returned by the dealer **internal** GET `/api/internal/applications/[id]`, which is JWT-protected and used only by the platform.
- **Verdict:** Correct. No change.

---

## 3. Activation and invite linkage

### 3.1 Activation only possible after approval/invite issuance

- `markActivated` is called only from `invite.ts`: in `acceptInvite` and `acceptInviteWithSignup`, after membership creation and invite status update, when `invite.dealerApplicationId` is set. The invite is created by the platform when sending the owner-invite (after approval); the platform passes `dealerApplicationId` into the dealer internal **POST /api/internal/dealerships/[id]/owner-invite**, which stores it on `DealershipInvite`. So activation is only reachable after an approved application and an issued invite that contains the application ID.
- **Verdict:** Correct. No change.

### 3.2 Linked dealerApplicationId lifecycle correct

- `markActivated(id)` in the service requires `app.status === "activation_sent" || app.status === "activated"`; otherwise it throws `INVALID_STATE`. So the application must already be in `activation_sent` (or idempotently `activated`) before it can be marked activated. There is no path to set `activated` without going through invite acceptance.
- **Verdict:** Correct. No change.

### 3.3 No path to mark activated without legitimate invite acceptance/signup

- The only callers of `markActivated` are the two accept flows above, and they use `invite.dealerApplicationId` from the DB. There is no public or dealer-user-facing endpoint that accepts an application ID and calls `markActivated`. The dealer internal PATCH can set `status: "activated"`, but that endpoint is only reachable with the internal JWT (platform server). Platform UI is expected to use the normal flow (approve → send invite → user accepts → markActivated). If platform were to misuse PATCH to set status to activated without invite acceptance, that would be an operational/process issue, not a public security hole.
- **Verdict:** No public or tenant path to mark activated without invite. No change.

### 3.4 No pre-approval tenant leakage or premature dealership access

- Applications are pre-tenant: `dealershipId` is null until approval and provisioning. Provisioning creates the dealership and then the owner invite (with optional `dealerApplicationId`) is sent. The user gains dealership access only by accepting the invite (membership created at accept time). No endpoint grants dealership access based only on application ID.
- **Verdict:** Correct. No change.

---

## 4. First-login onboarding handoff

### 4.1 Only valid activated users reach /get-started after signup

- After **accept-invite signup**, the client redirects to `/get-started` (see `AcceptInviteClient.tsx`). That user has just received a membership for the invite’s dealership; the invite was created after approval and (for application flow) may have `dealerApplicationId`, and `markActivated` is called on accept. So the user reaching get-started from this path is an activated user with at least one membership.
- **Verdict:** Correct. No change.

### 4.2 Pending/rejected/non-activated users do not reach onboarding/dashboard

- Rejected or never-approved applicants do not receive an owner invite and never get an account or membership. They have no way to log in to the dealer app. Pending (e.g. submitted but not yet approved) applicants also have no account until an invite is sent and accepted. So “pending/rejected/non-activated” users cannot reach get-started or dashboard; they can only use the public apply pages (by application ID or invite token) to view/update their draft or see success.
- **Verdict:** Correct. No change.

---

## 5. Optional hardening applied

- **One application per invite:** When `createDraft` is called with `inviteId`, the service now checks for an existing application with that `inviteId`. If one exists, it returns that application instead of creating a second one. This prevents multiple drafts for the same invite (e.g. if a client ever sent duplicate create requests or reused inviteId from the invite response) and keeps “invite token → single application” deterministic.

---

## 6. Summary

| Area                         | Result   | Notes                                                |
|-----------------------------|----------|------------------------------------------------------|
| Public apply ID abuse       | OK       | UUID; access by possession only                      |
| Invite token resolution     | OK       | Correct invite → application; hardening applied     |
| Public PATCH scope          | OK       | Profile only; status enforced in service             |
| Public submit spoofing      | OK       | No body; server-side lifecycle only                  |
| Non-draft edit              | OK       | updateDraft blocks non-draft/invited                 |
| Platform dealer-applications| OK       | requirePlatformAuth + role                           |
| Internal list/detail/patch   | OK       | JWT-only; used by platform only                      |
| Review notes/rejection      | OK       | Not in public apply API                              |
| Activation / invite link    | OK       | markActivated only on invite accept                  |
| dealerApplicationId lifecycle | OK     | activation_sent → activated only                     |
| First-login / get-started   | OK       | Only after accept; no account for pending/rejected   |

No security issues requiring route or RBAC changes were found. One optional hardening was applied: one-application-per-invite in `createDraft`.

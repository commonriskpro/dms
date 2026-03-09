# Dealer Application + Approval Flow V1 — Specification

**Sprint:** Dealer Application + Approval Flow V1  
**Step:** 1 — Architect  
**Repo:** DMS monorepo · apps/dealer, apps/platform, packages/contracts

---

## 1. Current State (Inspection Summary)

### 1.1 Invites and accept-invite

- **Dealer app:** `DealershipInvite` (dealer Prisma) — status PENDING, ACCEPTED, EXPIRED, CANCELLED. Token-based; created per-dealership for a role (e.g. Owner).
- **Accept-invite:** `/accept-invite` (page + client). Resolve token via `GET /api/invite/resolve`. Accept: (1) **Authenticated:** `POST /api/invite/accept` with `{ token }` → membership created, redirect to dashboard with `switchDealership`. (2) **Signup:** unauthenticated, body `{ token, email, password, confirmPassword?, fullName? }` → `acceptInviteWithSignup` (Supabase admin createUser, profile, membership, invite marked ACCEPTED), then client signs in and redirects to dashboard with `switchDealership`.
- **No password is emailed.** Invite email contains only the accept URL (single-use link). User sets password on the accept-invite page.

### 1.2 Login and get-started

- **Login:** `/login` — Supabase signInWithPassword or magic link. After login, home `/` redirects by permission (e.g. inventory, deals, dashboard) or, if no `activeDealership`, to `/get-started`.
- **Get-started:** `(app)/get-started` — server fetches `GET /api/auth/onboarding-status` (memberships count, hasActiveDealership, pendingInvitesCount, nextAction) and dealership list. Client shows: (1) Select dealership (multiple memberships, none active); (2) Pending invite — check email / open invite link; (3) No dealership — accept invite or dev bootstrap. No “application” or “apply” concept here today.

### 1.3 Platform / admin user and dealership management

- **Platform app:** Own DB (Application, PlatformDealership, DealershipMapping, PlatformUser, etc.). Applications: created only from platform UI (`POST /api/platform/applications`) by PLATFORM_OWNER/PLATFORM_COMPLIANCE. Fields: legalName, displayName, contactEmail, contactPhone, notes. Status: APPLIED → UNDER_REVIEW → APPROVED | REJECTED. No public apply; no staged form.
- **Provision:** After APPROVED, platform can call `provision` (creates PlatformDealership, calls dealer internal `POST /api/internal/provision/dealership` → dealer creates Dealership, roles, memberships not created yet).
- **Owner invite:** Platform calls dealer internal `POST /api/internal/dealerships/[dealerDealershipId]/owner-invite` (email, platformDealershipId, platformActorId, idempotency). Dealer creates DealershipInvite (Owner role), returns acceptUrl. Platform sends email via Resend (owner-invite template) with acceptUrl. User clicks → accept-invite → set password (if signup) → redirect to dashboard with switchDealership. **No emailed password.**

### 1.4 Onboarding state

- **Onboarding-status API:** Returns membershipsCount, hasActiveDealership, pendingInvitesCount, nextAction (CHECK_EMAIL_FOR_INVITE | SELECT_DEALERSHIP | NONE). No “application submitted” or “activation pending” state today.
- **First-login handoff:** Currently after accept-invite signup the client redirects to `/dashboard?switchDealership=...`. If the user had no active dealership, the app’s home redirect would send them to get-started; with switchDealership they land on dashboard. Spec will require: **first login after activation → get-started** (onboarding entry); then if “onboarding complete” → dashboard.

### 1.5 Public auth / apply routes

- **Dealer:** No public “apply” route. Login, accept-invite, forgot-password are the only public auth surfaces.
- **Platform:** No public apply; applications created by platform staff only.

### 1.6 Data models (relevant)

- **Dealer DB:** Dealership, Profile, DealershipInvite, Membership, Role, PendingApproval, PlatformAdmin, ProvisioningIdempotency, OwnerInviteIdempotency. No DealerApplication.
- **Platform DB:** Application (minimal: legalName, displayName, contactEmail, contactPhone, notes, reviewNotes, rejectionReason, dealershipId FK to PlatformDealership), PlatformDealership, DealershipMapping, PlatformUser, PlatformAuditLog, PlatformEmailLog (OWNER_INVITE), PlatformInviteLog.

---

## 2. Flow Variants

### A. Admin-invited owner flow

1. **Admin creates owner invite** (platform or future dealer-admin): Invite is created for a specific owner email, optionally linked to a “pending” application record (see lifecycle).
2. **Owner opens invite link** (e.g. `/apply?token=...` or `/accept-invite?token=...` with a variant that leads into application).
3. **Owner completes staged application** (same multi-step form as public apply). Draft is saved and resumable; application is tied to invite (invitedByUserId / inviteId).
4. **Owner submits for review.** Status → submitted; application enters review queue.
5. **Internal reviewer approves or rejects** (platform application queue).
6. **On approval:** Provision dealership if not already; create owner DealershipInvite; send **approval email with secure activation / set-password link** (no password in email). Optionally mark application as activation_sent.
7. **Owner activates account:** Clicks link → lands on accept-invite (or dedicated set-password page); sets password; account created/linked.
8. **First successful login** → redirect to **onboarding / get-started**. After onboarding complete (or skipped), subsequent logins → dashboard.

### B. Public apply flow

1. **Public visitor** opens apply page (e.g. `/apply`).
2. **Completes staged application** (multi-step). Draft saved anonymously (e.g. by session or link token); no tenant, no auth required for draft.
3. **Submits for review.** Status → submitted; application enters review queue.
4. **Internal reviewer** approves or rejects (platform application queue).
5. **On approval:** Provision dealership; create owner invite for application’s owner email; send **approval email with secure activation / set-password link** (no password in email).
6. **Owner activates account** (same as A.7).
7. **First successful login** → **onboarding / get-started**; then dashboard when onboarding complete.

---

## 3. Lifecycle Model

### 3.1 Statuses (recommended)

| Status            | Meaning |
|-------------------|--------|
| `draft`           | Application created; not yet submitted. Editable, resumable. |
| `invited`         | (Invite flow only.) Owner was invited; may complete application. |
| `submitted`       | Applicant submitted for review. No longer editable. |
| `under_review`    | Reviewer has taken it into review (optional explicit state). |
| `approved`        | Approved; provisioning and/or activation can proceed. |
| `rejected`       | Rejected; optional reason stored. |
| `activation_sent` | Approval email / set-password link sent. |
| `activated`       | Owner has set password and (optionally) first login recorded. |

### 3.2 Who can transition

- **draft → submitted:** Applicant (owner, via invite or public apply).
- **invited → draft / submitted:** Invited owner (same as above in context of invite).
- **submitted → under_review:** Platform reviewer (optional; can go straight to approved/rejected).
- **submitted | under_review → approved | rejected:** Platform reviewer (PLATFORM_OWNER, PLATFORM_COMPLIANCE as today).
- **approved → activation_sent:** System when approval email is sent (or platform “Send activation” action).
- **activation_sent → activated:** System when owner completes set-password / first login (or explicit “mark activated” after accept-invite).

### 3.3 Allowed transitions

- draft → submitted  
- invited → draft, submitted  
- submitted → under_review, approved, rejected  
- under_review → approved, rejected  
- approved → activation_sent  
- activation_sent → activated  
- rejected, activated: terminal for lifecycle; no further transitions.

(Re-submission from rejected is out of scope for V1 unless explicitly added.)

### 3.4 Audit expectations

- Every status transition and material action must be audited (platform and/or dealer audit log as appropriate): created, submitted, approved, rejected, activation_sent, activated.
- Invite flow: who invited, when; who submitted.
- No PII (passwords, tokens) in audit metadata; entity IDs and status only.

---

## 4. Data Model Plan

### 4.1 Where application data lives

- **Dealer DB** holds the full application and profile data (single source of truth for the staged form). Applications are **pre-tenant**: no `dealershipId` until approved and provisioned; tenant is assigned only after approval/activation.
- **Platform DB** may retain a slim **Application** (or equivalent) row for the review queue and linkage to PlatformDealership post-provision, with a reference to the dealer-side application id (e.g. `dealerApplicationId`). Platform list/detail can be backed by dealer internal API or by synced minimal fields; see Route plan.

### 4.2 Core records (Dealer DB)

**DealerApplication**

- `id` (UUID, PK)
- `source` — enum: `invite` | `public_apply`
- `status` — enum: draft, invited, submitted, under_review, approved, rejected, activation_sent, activated
- `invitedByUserId` — nullable; set when source = invite (platform or dealer admin who created the invite)
- `inviteId` — nullable; FK to DealershipInvite if application was started from an invite (optional; can be inferred from invite token flow)
- `ownerEmail` — required; identity for activation
- `dealershipId` — nullable until approved and provisioned; then set to dealer Dealership id
- `platformApplicationId` or `platformDealershipId` — nullable; set when platform creates/links platform records (for platform queue and provisioning)
- `submittedAt`, `approvedAt`, `rejectedAt`, `activationSentAt`, `activatedAt` — nullable timestamps
- `reviewerUserId` — nullable; platform user id or dealer user id depending where review runs
- `reviewNotes`, `rejectionReason` — optional text
- `createdAt`, `updatedAt`
- Indexes: status, ownerEmail (for dedupe/collision), submittedAt, (source, status), optional unique constraint (e.g. one active draft per invite if needed)

**DealerApplicationProfile**

- Stores all staged application data. Two approaches:

  - **Option A (recommended):** Single row per application; JSON column(s) for sections (business, owner, primary contact, locations, pricing/package, acknowledgments). Simpler schema, flexible for DealerCenter-level coverage without a large number of columns; easy to version and resume.
  - **Option B:** Normalized child tables (e.g. DealerApplicationLocation, DealerApplicationProviderSelection). Better for querying/filtering by location or product; more migrations and joins.

- **Recommendation:** Option A for V1 — one **DealerApplicationProfile** with `applicationId` (FK to DealerApplication), and JSON fields such as `businessInfo`, `ownerInfo`, `primaryContact`, `additionalLocations`, `pricingPackageInterest`, `acknowledgments`. This keeps the schema stable while the exact field set evolves and matches “broad DealerCenter-level information coverage” without overcomplicating the schema. If product/pricing filters are needed later, add indexed child tables in a follow-up.

**Additional structures**

- **Locations:** Embedded in `additionalLocations` JSON (array of { dealerName, firstName, lastName, phone, fax, email, address, city, state, zip }).
- **Selected providers/products, package options:** Embedded in `pricingPackageInterest` JSON (pre-bundle vs build-your-own, selected providers/products, commercial selection). No separate tables for V1.

### 4.3 Platform-side (optional / backward compatibility)

- Keep or add **Application** (or **DealerApplicationReview**) in platform DB with: id, dealerApplicationId (UUID, reference to dealer’s DealerApplication), status (mirror or subset), contactEmail/legalName/displayName (denormalized for list), dealershipId (platform), createdAt, updatedAt. This supports the existing platform queue UI and provisioning flow without rewriting all platform list/detail to dealer internal API in one step. Detail view can load full profile from dealer internal API.

---

## 5. UX Structure (Multi-Step Staged Application)

- **Only** multi-step staged flow; no single giant page.
- Steps:

  1. **Business Information** — application for / provider selections, business name, DBA, business phone/fax, address, mailing address + same-as toggle, business opened since, nature of business, website, dealer type, inventory types, entity type, how did you hear, referral code, representative, EIN, current DMS provider, total inventory units.
  2. **Business Owner** — full name, title, phone, email.
  3. **Primary Contact** — same-as-owner toggle, prefer Spanish-speaking representative, full name, title, phone, email.
  4. **Additional Locations** — repeatable block: dealer name, first/last name, phone, fax, email, address, city, state, zip.
  5. **Pricing / Package Interest** — pre-bundle vs build-your-own, selected providers/products, package interest / commercial selection.
  6. **Review & Submit** — summary, attestations/acknowledgments, submit button.

- **Autosave / resume:** Draft saved on blur or step change; resume by link (token/session). Public apply: anonymous draft key (e.g. token in URL or cookie). Invite flow: draft tied to invite token / application id.
- **Back/Next:** Step rail or progress; back/next buttons; validation per step before advancing (or validate on submit only for minimal friction — spec leaves this to implementation; recommend step-level validation for required fields).
- **Completion tracking:** Per-step completion (e.g. “step 1 of 6 complete”) for UX; optional persistence of completed step index.
- **Save draft:** Explicit “Save and continue later” and/or autosave; no submit until Review & Submit.

---

## 6. Admin Review Workflow

- **Application queue:** List applications in status submitted (and optionally under_review). Filter by status, date; sort by submittedAt. Platform UI (existing applications list) or dealer admin UI; access controlled by RBAC (platform roles or dealer admin permission).
- **Application detail:** Full read-only view of application + profile (business, owner, contact, locations, pricing, acknowledgments). Timeline/audit: submitted, approved/rejected, activation sent, activated.
- **Approve:** Button → transition to approved; optionally trigger provision + send activation email in one action, or separate “Provision” then “Send activation”.
- **Reject:** Button + required or optional reason → status rejected; store rejectionReason; optional rejection email (out of scope or minimal for V1).
- **Request changes:** Defer to later sprint; not required for V1. If in scope, allow transition back to draft with a comment; otherwise explicitly out of scope.
- **Resend activation:** If status is activation_sent and owner hasn’t activated, “Resend activation email” (same secure link, rate-limited). In scope if simple (reuse same invite token or generate new one per existing invite lifecycle).
- **Review notes:** Stored on DealerApplication (reviewNotes); visible to reviewers only.
- **Audit trail:** All transitions and “resend activation” recorded; no PII in audit.

---

## 7. Activation Flow

- **Approved application** either already has a Dealership (provisioned) or is provisioned on approve. Owner is identified by `ownerEmail`. No auth identity is created until activation.
- **Approval email:** Sent to ownerEmail. Contains **secure activation / set-password link** only (e.g. existing accept-invite URL with token, or a dedicated activation URL with a one-time token). **No password in email; no generated password.**
- **Email as login identity:** After activation, login is email + password (or magic link); email is the unique identity.
- **Set password:** User clicks link → lands on accept-invite (or dedicated set-password page). If new user: set password, create Supabase user, create Profile, create Membership (Owner), mark invite accepted and application activated. If existing user: must match email; accept invite (set password not required) and mark activated.
- **First successful login:** Redirect to **onboarding / get-started**. Logic: if application was just activated and “onboarding complete” flag not set (or no active dealership selected), send to get-started; else dashboard. Session/flag can be used to show “first time” experience once.
- **No emailed password ever.**

---

## 8. Route Plan

### 8.1 Dealer app (public or unauthenticated)

- **`/apply`** — Public apply entry. Optional query: `?token=...` for resume (draft token).
- **`/apply/[applicationId]`** or **`/apply?token=...`** — Staged application (steps 1–6). Same route for public and invite; invite flow can use `?invite=...` or path to load draft linked to invite.
- **`/apply/success`** or **`/apply/submitted`** — Post-submit confirmation (“Thank you; we’ll review”).
- **`/accept-invite`** — Existing. Kept; used for activation link (set-password / accept). No route rename.
- **`/get-started`** — Existing. First-login post-activation lands here; no route rename.

### 8.2 Dealer app (invite flow)

- **`/accept-invite?token=...`** — If invite is “application required” type, redirect to `/apply?invite=...` or show application steps; after submit, show success. If invite is “accept only” (e.g. post-approval activation), current behavior: set password and redirect. (Implementation may use same accept-invite URL for both “complete application” and “set password”; token type or state distinguishes.)
- Alternatively: **`/apply?invite=...`** — Invited user opens this to complete application; after submit → success.

### 8.3 Dealer app (authenticated admin, if review is in dealer)

- **`/admin/applications`** — List applications (submitted, etc.). Optional for V1 if review is platform-only.
- **`/admin/applications/[id]`** — Detail + approve/reject. Optional for V1.

### 8.4 Platform app

- **`/platform/applications`** — Existing list. Backed by platform Application table and/or dealer internal API (list applications).
- **`/platform/applications/[id]`** — Existing detail. Load full profile from dealer internal API; show onboarding status, approve, reject, provision, invite-owner / send activation, resend activation.
- **Provision / invite-owner / approve** — Existing or extended routes; approve may create dealer application + link, then provision, then send activation email (no password).

### 8.5 Activation completion

- **Set-password continuation:** Current accept-invite page handles “sign up with password” for invite; that is the set-password flow. Optional: dedicated **`/activate?token=...`** that redirects to accept-invite with token for clarity; not required if accept-invite is the canonical activation entry.
- **Post-activation redirect:** Handled in client after accept: redirect to get-started (first login) or dashboard (onboarding already complete). Can be implemented in middleware or in get-started/dashboard layout by checking “first login after activation” flag or membership creation time.

---

## 9. RBAC / Tenant / Platform Boundary

- **Who can view applications:** Platform: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT (read). Approve/reject: PLATFORM_OWNER, PLATFORM_COMPLIANCE. Dealer: no tenant until approval; if dealer admin review is added, a permission like `admin.applications.read` / `admin.applications.write` scoped to “global” applications (no dealershipId) or a dedicated role.
- **Who can approve/reject:** Platform reviewers only (PLATFORM_OWNER, PLATFORM_COMPLIANCE). Not dealer users in V1 (unless explicitly added).
- **Where review lives:** Platform app (existing applications list/detail). Dealer app can add optional read-only or full review UI later; V1 can be platform-only for review.
- **Tenant assignment:** Tenant (dealershipId) is assigned only after approval and provisioning. Application records in dealer DB have no dealershipId (or null) until then. No tenant leakage: list/detail of applications must not expose other tenants; application data is pre-tenant.
- **Public apply:** No auth; draft and submit by token/session; rate-limit and abuse protection (e.g. per-IP, per-email submit limits).

---

## 10. Slice Plan with Acceptance Criteria

### SLICE A — Spec and lifecycle architecture

- **Deliverable:** This spec and any small refinements; lifecycle state machine documented and agreed.
- **Acceptance:** Spec approved; lifecycle transitions and owners clear; no app code.

### SLICE B — Backend data model and persistence

- **Deliverable:** DealerApplication, DealerApplicationProfile (and optional platform Application linkage); migrations; indexes; timestamps; status enum; services: create, update draft, submit, list, get, approve, reject, send/resend activation, mark activated.
- **Acceptance:** Can create draft (invite + public), update draft, submit; platform or dealer can list/get; approve/reject and activation transitions work; audit events for transitions; no tenant on application until approved.

### SLICE C — Public apply + invite application flow UI

- **Deliverable:** Staged multi-step application UI (steps 1–6); public `/apply` and invite entry; save draft / resume; back/next; validation; review step and submit; success page.
- **Acceptance:** All DealerCenter-level fields collectible in staged UX; both public and invite entry work; draft persists and resumes; submit moves to submitted; no single-page giant form.

### SLICE D — Admin review queue + detail + decisions

- **Deliverable:** Application list and detail (platform and optionally dealer); approve; reject (with reason); review notes; status and audit visibility; resend activation if in scope.
- **Acceptance:** Reviewer can list, open detail, approve, reject, see timeline; resend activation works when applicable; RBAC enforced.

### SLICE E — Secure activation and first-login handoff

- **Deliverable:** Approval triggers activation email with set-password link only; accept-invite (or dedicated page) sets password; no password in email; first successful login → get-started; then dashboard when appropriate.
- **Acceptance:** No plaintext or generated password in email; activation link works once; first login lands on get-started; subsequent on dashboard when onboarding complete.

### SLICE F — Onboarding entry integration

- **Deliverable:** Post-activation first login routes to get-started; get-started shows correct state (e.g. select dealership, or “you’re all set”); if onboarding complete, redirect to dashboard.
- **Acceptance:** Newly activated owner sees get-started; after selecting dealership or completing onboarding, goes to dashboard; no regression for existing invite (non-application) flow.

### SLICE G — Tests, docs, hardening

- **Deliverable:** Targeted tests (application lifecycle, validation, review actions, activation handoff); docs update; DEALER_APPLICATION_APPROVAL_V1_REPORT.md.
- **Acceptance:** Tests pass; docs and report complete; known unrelated failures listed separately.

---

## 11. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Emailing credentials** | Strict rule: never email password or generated password. Approval email contains only secure set-password/activation link. Code review and spec reminder. |
| **Invite/application duplication** | One active draft per invite (or per email for public) where applicable; idempotency on submit; clear source (invite vs public_apply). |
| **Partial drafts** | Autosave and resume by token/session; no submit until Review & Submit; optional “abandoned draft” cleanup job later. |
| **Owner email collisions** | On submit (public apply), check for existing application with same email in submitted/approved/activation_sent/activated; either block or allow one “active” per email with clear UX. Invite flow: one invite per email per dealership. |
| **Pre-approval tenant assignment mistakes** | Application has no dealershipId until approval and provision. Provisioning runs only after approve; tenant created then. No link from application to tenant before that. |
| **Approval without activation edge cases** | Lifecycle: approved → activation_sent when email sent; activation_sent → activated when user completes set-password. Resend activation if needed; do not create auth user before activation link use. |
| **Long-form UX abandonment** | Staged steps, autosave, resume, progress indicator; optional email reminder for incomplete drafts (later). |
| **Package/pricing schema overcomplication** | V1: JSON blob for pricing/package interest; no normalized provider/product tables until reporting/filtering is required. |

---

## 12. Design Lock

- **Information coverage:** Preserve all DealerCenter-level fields listed in the product intent (business, owner, primary contact, locations, pricing/package, acknowledgments).
- **UX:** Modern, staged, trustworthy, enterprise, secure; consistent with Dealer OS; no giant legacy one-page form.
- **Security:** No emailed passwords; activation via secure link only; tenant only after approval; RBAC and audit as above.
- **Scope:** Application system, admin approval workflow, secure activation, staged onboarding entry. Not: dashboard sprint, full UI redesign, RBAC rewrite, or Supabase auth rewrite.

---

*End of Step 1 — Architect. No app code in this step.*

# Platform Admin Completion Spec

**Sprint goal:** Complete the Platform Admin app so it is no longer mid-stage. Deliver missing operational features for tenant onboarding, dealership invites, platform admin management, reporting, monitoring, and hardening.

**Repo:** DMS monorepo · **Apps:** apps/dealer, apps/platform, packages/contracts  
**Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Prisma, Supabase auth, Jest.

---

## 1. CURRENT STATE AUDIT

### 1.1 What Already Exists

| Area | Status | Location / Notes |
|------|--------|------------------|
| **Platform auth** | Complete | `lib/platform-auth.ts`: getPlatformUserOrNull, requirePlatformAuth, requirePlatformRole. Roles: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT. |
| **Platform DB (Prisma)** | Complete | `prisma/schema.prisma`: Application, PlatformDealership, DealershipMapping, PlatformUser, PlatformAuditLog, PlatformEmailLog (OWNER_INVITE), PlatformInviteLog (platform user invites), PlatformMonitoringEvent, PlatformAlertState. |
| **Dealer DB (dealership invites)** | Complete | Dealer schema: DealershipInvite (PENDING/ACCEPTED/EXPIRED/CANCELLED), token, email, roleId, dealershipId. Invite create/resolve/accept/cancel/resend in `modules/platform-admin/service/invite.ts` and `db/invite.ts`. |
| **Application CRUD** | Complete | GET/POST `/api/platform/applications`, GET/POST approve, POST reject, GET detail. List supports status filter, pagination. |
| **Application approve/reject** | Partial | Approve: only sets status to APPROVED (no auto-provision or invite). Reject: sets REJECTED + reason, audit. **Missing:** duplicate-approve/reject protection (idempotency). |
| **Provision + owner invite (application)** | Complete | `lib/application-onboarding.ts`: provisionDealershipFromApplication, inviteOwnerForApplication (provisions if needed, calls dealer internal owner-invite, sends email via Resend, PlatformEmailLog, audit). Rate limit `invite_owner`. |
| **Dealership owner invite (from dealership)** | Complete | POST `/api/platform/dealerships/[id]/owner-invite` with email. Calls dealer internal owner-invite, Resend email, PlatformEmailLog, audit. UX on dealership detail: "Send Owner Invite" modal. |
| **Dealership list/detail** | Complete | GET/POST dealerships, GET dealerships/[id]. Detail: provision, status (suspend/close/activate), owner invite. Status syncs via dealer internal API. |
| **Platform users** | Complete | GET/POST/PATCH `/api/platform/users`, POST `/api/platform/users/invite`. Users page: list, filter, add by UUID, invite by email, role change, disable/enable. |
| **Audit** | Complete | PlatformAuditLog, `lib/audit.ts` platformAuditLog. GET audit with filters, GET audit/[id]. Audit page with filters and detail modal. |
| **Monitoring** | Complete | Health, dealer-health proxy, rate-limits/daily, job-runs/daily, check-dealer-health, maintenance/run. Monitoring page with status, diagnostics, Sentry links. |
| **Rate limiting** | Present | `lib/rate-limit.ts`: onboarding_status, provision, invite_owner. In-memory, per client IP. |
| **Contracts** | Present | packages/contracts: platform applications, dealerships, users, audit, monitoring; internal owner-invite, provision; dealer invite. |

### 1.2 What Is Partial

| Area | Gap |
|------|-----|
| **Invite lifecycle from platform** | Owner invite is end-to-end (create → email → accept in dealer). No platform-side **list** of dealership invites or **revoke** from platform UI. Dealer has GET/POST/PATCH for invites under `/api/platform/dealerships/[id]/invites` (dealer app). Platform app does not call these; platform UI has no "Invites" list per dealership or revoke. |
| **Application → dealership flow** | Approve does not auto-provision or send invite; operator must click Provision then Invite Owner. Optional: "Approve and provision" or "Approve and invite" to reduce steps. |
| **Dashboard** | Home redirects to /platform/applications. No KPI dashboard (totals, recent applications, invite activity). |
| **Reports** | No /platform/reports. No dealership growth, application funnel, or usage views. |
| **Billing / plans** | PlatformDealership has planKey and limits (JSON). No billing page; no Stripe. Display-only scaffold only. |
| **Dealership detail sections** | No dedicated "Users", "Invites", "Activity / Audit", "Onboarding" tabs—only overview and actions. |
| **Approve/reject idempotency** | Approve and reject can be called again; no guard against double-approve or double-reject. |

### 1.3 What Is Missing

| Area | Need |
|------|------|
| **Platform dashboard** | Route /platform with KPI cards, recent applications, recent invite/audit activity, quick links. |
| **Reports route + page** | /platform/reports: growth, application funnel, tenant usage (from existing data). |
| **Billing route + page** | /platform/billing: scaffold showing planKey and limits per dealership; no checkout. |
| **Dealership invites (list/revoke)** | Backend: platform must get invite list per dealership (dealer internal API or platform proxy). Revoke: dealer already has cancelInvite; platform needs API that calls dealer or dealer exposes internal revoke. Frontend: Dealership detail "Invites" section + revoke. |
| **Confirm invite endpoint** | Dealer has GET invite/resolve and POST invite/accept. Platform does not need to duplicate; "confirmed" = accept flow exists in dealer. Optional: platform GET that proxies dealer resolve for "invite status" by token (no raw token in URL from platform). |
| **Duplicate approval/rejection** | Approve: if status already APPROVED, return 200 + current state. Reject: if already REJECTED, return 200 + current state. |
| **Onboarding visibility** | application/[id] has OnboardingStatusPanel; dealership detail could show onboarding stage if we have dealer internal endpoint for it. |
| **Jest tests** | More coverage for invite accept (expired/revoked/already accepted), approve/reject idempotency, RBAC, validation. |

### 1.4 What Can Be Reused Safely

- All existing platform API routes and services.
- Dealer `DealershipInvite` model and dealer invite service/db (platform calls dealer internal for owner-invite; list/revoke via new dealer internal endpoints or platform proxy).
- Existing `platformAuditLog`, `checkPlatformRateLimit`, `getPlatformClientIdentifier`, Zod schemas from contracts.
- Platform layout, shell, auth context, api-client, toast, shadcn components.
- Existing monitoring and audit pages (extend, do not replace).

---

## 2. SCOPE

Modules in scope:

1. **Platform dashboard** — KPIs, recent activity, quick links.
2. **Dealership management** — List (existing), detail (extend with Users/Invites/Activity/Onboarding), status/suspend/reactivate (existing).
3. **Dealership invitations** — Complete UX: send owner invite (existing), list invites per dealership, revoke invite. Automatic dealershipId from context (no manual ID input).
4. **Applications review and conversion** — Approve/reject with idempotency; optional polish: single "Approve and invite owner" action.
5. **Platform user/role management** — Already complete; ensure documented and tested.
6. **Tenant onboarding tracker** — Visible on application detail (OnboardingStatusPanel) and optionally on dealership detail.
7. **Platform reports** — New reports page: growth, funnel, usage.
8. **Platform monitoring** — Existing; add invite/audit widgets if data available.
9. **Billing/plans scaffold** — Display plan and limits; no Stripe or external billing.

---

## 3. ROUTES

| Route | Purpose |
|-------|---------|
| `/platform` | Dashboard (replace redirect with real dashboard). |
| `/platform/dealerships` | List (existing). |
| `/platform/dealerships/[id]` | Detail with Overview, Invites, Activity, Plan (existing + extend). |
| `/platform/applications` | List (existing). |
| `/platform/applications/[id]` | Detail, approve/reject, provision, invite owner (existing). |
| `/platform/users` | Platform users (existing). |
| `/platform/reports` | **New.** Growth, funnel, usage. |
| `/platform/monitoring` | Existing; add recent audit/invite signals if feasible. |
| `/platform/audit` | Existing. |
| `/platform/billing` | **New.** Scaffold: plan list / per-dealership plan and limits. |

---

## 4. DEALERSHIP MANAGEMENT

- **List page:** Keep current: status filter, table (status, legal name, display name, plan, created), pagination, "New Dealership" (owner). Add column or link: "View" → detail.
- **Detail page:** Keep overview card (status, provision, status actions, owner invite). Add sections:
  - **Invites:** List of invites for this dealership (from dealer API or platform proxy). Show email (masked), role, status, expires, actions: Revoke (if PENDING).
  - **Activity / Audit:** Recent platform audit entries for targetType=dealership, targetId=this id (link to full audit with filter).
  - **Plan / Billing:** Show planKey and limits (from existing API). No edit in scaffold.
- **Onboarding status:** If dealer exposes onboarding state for a dealership, show on detail; else skip or "—".
- **Metrics:** Optional: user count, inventory count, deals count from dealer internal (only if such endpoints exist); otherwise omit to avoid scope creep.
- **Suspend / Reactivate:** Already present (status change with reason); keep as is.

---

## 5. INVITATION SYSTEM

### 5.1 Lifecycle (Current + Completions)

- **Create invite (owner):** From platform: (1) Application → "Invite Owner" (application-onboarding), (2) Dealership detail → "Send Owner Invite" (dealerships/[id]/owner-invite). Both use dealer internal owner-invite; dealershipId is always from context (application or selected dealership). **No manual dealership ID in UX.**
- **Token:** Generated and stored in dealer DB (DealershipInvite.token). Not stored in platform DB. Platform never exposes raw token in URLs; accept link is built by dealer and sent by email.
- **Email:** Sent via Resend from platform (sendOwnerInviteEmail); PlatformEmailLog stores recipientHash only.
- **Lookup by token:** Dealer GET /api/invite/resolve?token=… (or similar). Used by accept page. Platform does not need to lookup by token except for optional "invite status" that does not expose token.
- **Accept flow:** In dealer app (invite/accept). Single-use: accept marks invite ACCEPTED; second accept fails.
- **Expired / Revoked / Accepted:** Dealer already enforces: expired (expiresAt), cancelled (status CANCELLED), accepted (status ACCEPTED). Platform needs **revoke** = cancel invite via dealer (if dealer exposes internal cancel for platform, or platform proxies dealer PATCH).
- **Single-use protection:** Enforced in dealer accept flow.
- **Audit:** Platform audits: application.owner_invite_sent, dealership.owner_invite.email_sent. Dealer audits platform.invite.created, platform.invite.cancelled, platform.invite.accepted.
- **Invite statuses:** Use dealer enum: PENDING, ACCEPTED, EXPIRED, CANCELLED. "REVOKED" = map to CANCELLED in UI if desired.

### 5.2 Completions Required

- **List invites per dealership:** Backend: platform calls dealer internal API to list invites by dealerDealershipId (dealer must expose GET internal for invites by dealership, or platform stores nothing and dealer already has GET /api/platform/dealerships/[id]/invites — but that lives in dealer app; platform app is separate). So: either (A) add dealer internal endpoint GET /api/internal/dealerships/[dealerDealershipId]/invites (JWT), and platform calls it and maps to platform dealership id, or (B) platform proxy from server to dealer app’s existing platform route with auth. Choice: (A) keep platform server calling dealer internal API for list invites.
- **Revoke invite:** Dealer has cancelInvite (PATCH). Expose internal POST/DELETE or PATCH /api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/revoke (or reuse dealer’s platform-admin PATCH if dealer accepts internal JWT). Platform then calls it when admin clicks Revoke.
- **Rate limiting:** Already have invite_owner. Apply to any new "list invites" if high volume (likely low; optional).

---

## 6. APPLICATIONS → DEALERSHIP CONVERSION

- **Review queue:** Current applications list with status filter (APPLIED, UNDER_REVIEW, APPROVED, REJECTED). Keep.
- **Approve:** Keep current behavior (set status APPROVED). Add: if application already APPROVED, return 200 with current state (idempotent). Audit only on actual transition.
- **Reject:** If already REJECTED, return 200 with current state (idempotent). Audit only on actual transition.
- **On approve (optional polish):** Do not auto-create dealership or send invite in this sprint unless product explicitly asks; current flow (Approve → Provision → Invite Owner) is acceptable. Optionally add single button "Approve and invite owner" that: approve → provision if needed → invite owner (one click).
- **On reject:** Current: set REJECTED, rejectionReason, audit. Keep.
- **Idempotency:** Approve: if status === APPROVED return success. Reject: if status === REJECTED return success.
- **Duplicate protection:** Same as idempotency; no double state change.

---

## 7. PLATFORM USERS / ROLES

- **Internal platform users page:** Exists at /platform/users. List, add by UUID, invite by email, role change, disable/enable. Keep.
- **Roles:** PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT. Map to spec names: platform.admin ≈ PLATFORM_OWNER, platform.support ≈ PLATFORM_SUPPORT, platform.readonly = no existing role (support can read; add readonly only if needed). Minimum: keep current three roles.
- **Permission mapping:** Enforced in requirePlatformRole per route. Document in spec: OWNER: full; COMPLIANCE: approve/reject, read all; SUPPORT: read applications, dealerships, audit, monitoring; no write to users or critical mutations.

---

## 8. DASHBOARD / REPORTS / MONITORING

### 8.1 Dashboard (/platform)

- **KPI cards (from platform DB + optional dealer):** Total dealerships, active (status ACTIVE or PROVISIONED), total applications, applications in APPLIED, recent signups (e.g. applications created in last 7 days). Total users = platform users count (platform DB). Inventory/deals only if dealer exposes aggregates; else omit.
- **Recent applications:** Last 5–10 applications (id, status, displayName, createdAt) with link to detail.
- **Recent invite/audit:** Last 5 platform audit entries with action containing "invite" or "owner_invite", or last 5 PlatformEmailLog entries (no PII). Link to audit.
- **Quick links:** Dealerships, Applications, Monitoring, Reports, Audit.

### 8.2 Reports (/platform/reports)

- **Dealership growth:** Count of platform dealerships by createdAt (e.g. by month). From PlatformDealership.
- **Application funnel:** Count by status (APPLIED, UNDER_REVIEW, APPROVED, REJECTED). From Application.
- **Tenant usage overview:** Optional: table of dealerships with planKey, status, provisionedAt. No complex telemetry.
- Use existing data only; no new telemetry tables required. Simple cards/tables; charts only if existing chart stack exists (e.g. simple bar/list).

### 8.3 Monitoring (/platform/monitoring)

- Keep: health, dealer health, rate limits daily, job runs daily, Sentry links.
- Add: **Recent platform audit events** (last 10–20, filter by targetType or action) — reuse audit API with limit.
- Add: **Invite-related signals:** Count of PlatformEmailLog OWNER_INVITE in last 24h; or audit actions "owner_invite" / "invite" in last 24h. No "invalid accepts" unless dealer sends such events to platform (out of scope).

---

## 9. BILLING / PLANS

- No Stripe or external billing. Scaffold only.
- **Data:** PlatformDealership.planKey, PlatformDealership.limits (JSON).
- **Billing page:** List dealerships with planKey and limits (display). Optional: table "Plan" | "Limits" | "Dealership". No checkout, no payment methods.
- **Seat limit / inventory limit:** If in `limits` (e.g. `{ "users": 5 }`), display; else "—".

---

## 10. DATA MODEL PLAN

### 10.1 No New Platform Tables Required (Baseline)

- Invites live in dealer DB (DealershipInvite). Platform has PlatformEmailLog, PlatformInviteLog (platform user invites only).
- Application, PlatformDealership, PlatformAuditLog, PlatformUser already exist.

### 10.2 Optional / If Needed

- **DealershipPlan:** Only if we need a normalized plan table (name, key, seatLimit, etc.). Current planKey + limits is enough for scaffold; skip unless product asks.
- **Platform "invite" table:** Not needed; platform does not store dealership invite rows—dealer does. Platform only calls dealer and logs audit/email log.

### 10.3 Dealer Side (for list/revoke invites)

- No new tables. Dealer already has DealershipInvite. Dealer may need internal endpoints: GET invites by dealership, PATCH/revoke invite (or reuse existing platform-admin PATCH with JWT from platform).

---

## 11. API PLAN

### 11.1 New or Updated Endpoints (Platform)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/platform/dashboard | KPIs + recent applications + recent audit/invite (or server component fetches existing APIs). |
| GET | /api/platform/reports/growth | Dealership growth counts (by month or week). |
| GET | /api/platform/reports/funnel | Application counts by status. |
| GET | /api/platform/reports/usage | Tenant usage table (dealerships + plan + status). |
| GET | /api/platform/dealerships/[id]/invites | **New.** Returns list of invites for this platform dealership (platform resolves mapping, calls dealer internal GET invites, returns shaped list). |
| POST or PATCH | /api/platform/dealerships/[id]/invites/[inviteId]/revoke | **New.** Revoke (cancel) invite; platform calls dealer internal revoke. |
| (existing) | applications approve/reject | Add idempotent behavior (return 200 if already in target state). |

### 11.2 Dealer Internal (New, for platform to call)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/internal/dealerships/[dealerDealershipId]/invites | List invites for dealership (JWT). Response: array of { id, emailMasked, roleName, status, expiresAt, createdAt }. |
| PATCH/DELETE | /api/internal/dealerships/[dealerDealershipId]/invites/[inviteId] | Cancel/revoke invite (JWT). Body or action: { cancel: true } or DELETE. |

(If dealer already has a route that platform can call with JWT for list/cancel, reuse it; otherwise add these.)

### 11.3 Existing Endpoints Used As-Is

- List dealerships, dealership detail, owner-invite, status, provision.
- List applications, application detail, approve, reject, provision, invite-owner, onboarding-status.
- Platform users, invite.
- Audit list, audit detail.
- Monitoring: health, dealer-health, rate-limits/daily, job-runs/daily, check-dealer-health, maintenance.

---

## 12. VALIDATION / SECURITY / QA PLAN

### 12.1 RBAC

- All platform routes: requirePlatformAuth + requirePlatformRole as today. Dashboard: SUPPORT+; Reports: SUPPORT+; Monitoring: SUPPORT+; Dealership invites list/revoke: OWNER or COMPLIANCE (or SUPPORT read-only for list). Document matrix in security report.

### 12.2 Rate Limiting

- invite_owner already limited. Add rate limit for new "list invites" only if needed (e.g. 60/min per client). Revoke: low volume; optional 20/min.

### 12.3 Tenant Isolation

- Platform reads aggregate across tenants only for platform-scoped data (applications, dealerships, audit). Dealership-scoped operations always use platformDealershipId from URL and resolve dealerDealershipId via DealershipMapping; never expose cross-tenant data.

### 12.4 Token Security

- Invite token lives in dealer only; platform never stores or logs raw token. Accept URL built by dealer; platform sends link via email (Resend). No token in platform URLs.

### 12.5 Response Hygiene

- Use existing errorResponse; no stack traces or raw errors to client. Production-safe messages.

### 12.6 Audit Logging

- Keep logging: application.created, application.approved, application.rejected, application.provision, application.owner_invite_sent, dealership.created, dealership.owner_invite.email_sent, dealership.owner_invite.email_skipped_recent, dealership.owner_invite.email_failed, dealership status changes. Add: invite.revoked (or dealership.invite.revoked) when platform revokes.

### 12.7 Jest Test Plan

- Invite: dealer-side tests already cover accept (expired, cancelled, already accepted). Platform: test that owner-invite endpoint returns 409 when dealer returns 409; test rate limit 429.
- Applications: test approve idempotency (second approve returns 200); test reject idempotency.
- RBAC: test 403 for SUPPORT calling approve, reject, owner-invite, revoke.
- Validation: invalid UUID, missing body, invalid schema return 422.
- Dashboard/reports: test dashboard and reports endpoints return 200 and expected shape for allowed role.

### 12.8 Rollout Safety

- No breaking changes to existing APIs. New routes additive. Dealer internal invite list/revoke additive. Feature flag not required unless desired.

---

## 13. ACCEPTANCE CRITERIA

1. **Dashboard:** /platform shows KPI cards (dealerships, applications, recent counts), recent applications list, recent audit/invite activity, quick links to Dealerships, Applications, Reports, Monitoring, Audit.
2. **Dealership detail:** Invites section shows list of invites (email masked, role, status, expires); Revoke available for PENDING invites. Activity section links to audit filtered by dealership. Plan section shows planKey and limits.
3. **Invite lifecycle:** Send owner invite from application or dealership (existing). List invites and revoke from dealership detail (new). No manual dealership ID input; dealershipId always from context.
4. **Applications:** Approve and Reject are idempotent (already APPROVED/REJECTED returns 200). Optional: "Approve and invite owner" single action.
5. **Reports:** /platform/reports shows growth, funnel, and usage (tables/cards from existing data).
6. **Monitoring:** Existing page; optionally show recent audit and invite-related counts.
7. **Billing:** /platform/billing shows plan list and per-dealership plan/limits (scaffold).
8. **Platform users:** No change; documented and covered by tests.
9. **Security:** RBAC matrix documented; invite token never in platform responses; audit for revoke; Jest coverage for critical paths.
10. **No regressions:** Dealer app behavior unchanged; existing platform flows (provision, invite owner, status) unchanged.

---

## Document control

- Version: 1.0
- Created: Platform Admin Completion Sprint (Step 1 — Architect).
- Next: Step 2 — Backend Engineer (implement per this spec).

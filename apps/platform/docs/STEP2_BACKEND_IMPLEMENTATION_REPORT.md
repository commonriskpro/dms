# Step 2 — Backend Implementation Report

## Summary

Backend work for Platform Admin Completion Sprint: invite list/revoke via dealer internal API, idempotent application approve/reject, dashboard and reports APIs, billing scaffold, and Jest tests.

## Implemented

### 1. Dealership invite list and revoke (platform ↔ dealer)

- **Dealer (apps/dealer):**
  - `cancelInviteFromPlatform(dealershipId, inviteId, platformActorId)` in `modules/platform-admin/service/invite.ts` — cancels invite with audit `actorUserId: null` and `metadata.platformActorId`.
  - `GET /api/internal/dealerships/[dealerDealershipId]/invites` — JWT required; returns list with `emailMasked`, `roleName`, `status`, `expiresAt`, `createdAt`, `acceptedAt`; supports `limit`, `offset`, `status` query.
  - `PATCH /api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]` — body `{ cancel: true, platformActorId: string }`; calls `cancelInviteFromPlatform`.
- **Platform (apps/platform):**
  - `callDealerListInvites`, `callDealerRevokeInvite` in `lib/call-dealer-internal.ts`.
  - `GET /api/platform/dealerships/[id]/invites` — returns 422 if not provisioned; otherwise calls dealer list and returns `{ data, meta }`.
  - `PATCH /api/platform/dealerships/[id]/invites/[inviteId]/revoke` — calls dealer revoke; audits `dealership.invite.revoked`; returns 204.

### 2. Application approve / reject idempotency

- **Approve:** If `application.status === "APPROVED"`, return 200 with `{ id, status: "APPROVED" }` without update or audit.
- **Reject:** If `application.status === "REJECTED"`, return 200 with `{ id, status: "REJECTED" }` without update or audit.

### 3. Dashboard and reports

- `GET /api/platform/dashboard` — KPIs (totalDealerships, activeDealerships, totalApplications, appliedApplications, totalPlatformUsers, applicationsLast7Days), recentApplications (10), recentAudit (10). Requires platform role.
- `GET /api/platform/reports/growth?months=12` — Dealership count by month (platform DB).
- `GET /api/platform/reports/funnel` — Application counts by status (APPLIED, UNDER_REVIEW, APPROVED, REJECTED).
- `GET /api/platform/reports/usage?limit=50&offset=0` — Tenant usage: dealerships with planKey, limits, status, provisionedAt.
- `GET /api/platform/billing?limit=50&offset=0` — Scaffold: dealerships with planKey, limits, status; plus `planKeys` array.

### 4. Tests (Jest)

- `app/api/platform/applications/[id]/approve/route.idempotency.test.ts` — already APPROVED returns 200 without update/audit; APPLIED triggers update and audit.
- `app/api/platform/applications/[id]/reject/route.idempotency.test.ts` — already REJECTED returns 200 without update/audit; APPLIED triggers update and audit.
- `app/api/platform/dashboard/route.test.ts` — 403 when no role; 200 with kpis, recentApplications, recentAudit shape.
- `app/api/platform/dealerships/[id]/invites/route.test.ts` — 422 when not provisioned; 200 when dealer returns list.

## Files created

- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts`
- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts`
- `apps/platform/app/api/platform/dealerships/[id]/invites/route.ts`
- `apps/platform/app/api/platform/dealerships/[id]/invites/[inviteId]/revoke/route.ts`
- `apps/platform/app/api/platform/dashboard/route.ts`
- `apps/platform/app/api/platform/reports/growth/route.ts`
- `apps/platform/app/api/platform/reports/funnel/route.ts`
- `apps/platform/app/api/platform/reports/usage/route.ts`
- `apps/platform/app/api/platform/billing/route.ts`
- `apps/platform/app/api/platform/applications/[id]/approve/route.idempotency.test.ts`
- `apps/platform/app/api/platform/applications/[id]/reject/route.idempotency.test.ts`
- `apps/platform/app/api/platform/dashboard/route.test.ts`
- `apps/platform/app/api/platform/dealerships/[id]/invites/route.test.ts`
- `apps/platform/docs/STEP2_BACKEND_IMPLEMENTATION_REPORT.md`

## Files modified

- `apps/dealer/modules/platform-admin/service/invite.ts` — added `cancelInviteFromPlatform`.
- `apps/platform/lib/call-dealer-internal.ts` — added `callDealerListInvites`, `callDealerRevokeInvite`.
- `apps/platform/app/api/platform/applications/[id]/approve/route.ts` — idempotent when already APPROVED.
- `apps/platform/app/api/platform/applications/[id]/reject/route.ts` — idempotent when already REJECTED.

## Risks / follow-ups

- Dealer internal invite list returns masked email only; platform never sees raw email (PII-safe).
- Dashboard/reports use platform DB only; no dealer aggregates (e.g. user count per dealership) in this step.
- Revoke requires PLATFORM_OWNER or PLATFORM_COMPLIANCE; list allows PLATFORM_SUPPORT.

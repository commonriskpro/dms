# Step 4 — Platform Admin Test Report

## Scope

Jest tests added or relevant to the Platform Admin Completion Sprint.

## New tests (Step 2)

| File | Description |
|------|-------------|
| app/api/platform/applications/[id]/approve/route.idempotency.test.ts | Approve when already APPROVED returns 200 without update or audit; when APPLIED performs update and audit. |
| app/api/platform/applications/[id]/reject/route.idempotency.test.ts | Reject when already REJECTED returns 200 without update or audit; when APPLIED performs update and audit. |
| app/api/platform/dashboard/route.test.ts | 403 when requirePlatformRole throws; 200 with kpis, recentApplications, recentAudit shape. |
| app/api/platform/dealerships/[id]/invites/route.test.ts | 422 when dealership not provisioned; 200 with data when callDealerListInvites returns success. |

## Existing tests (unchanged, relevant)

- app/api/platform/applications/[id]/invite-owner/route.rbac.test.ts
- app/api/platform/dealerships/[id]/owner-invite/route.rbac.test.ts
- app/api/platform/users/route.rbac.test.ts, users/[id]/route.rbac.test.ts, users/invite/route.rbac.test.ts
- app/api/platform/dealerships/route.rbac.test.ts
- app/api/platform/audit/route.test.ts, audit/[id]/route.test.ts
- lib/application-onboarding.test.ts

## Run command

From repo root:

```bash
npm run test --workspace=apps/platform
```

To run only new/idempotency/dashboard/invites tests:

```bash
npm run test --workspace=apps/platform -- --testPathPattern="(idempotency|dashboard/route.test|dealerships/\\\\[id\\\\]/invites/route.test)"
```

## Coverage notes

- Invite revoke PATCH: not yet covered by Jest (recommended: mock callDealerRevokeInvite, expect 204 and platformAuditLog).
- Reports and billing routes: no dedicated tests; protected by same requirePlatformAuth/requirePlatformRole pattern as dashboard.
- Dealer internal GET/PATCH invites: can be covered in dealer app tests (internal API JWT and response shape).

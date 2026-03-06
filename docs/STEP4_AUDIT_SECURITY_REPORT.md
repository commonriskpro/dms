# Step 4 — Security audit report

**Date:** 2025-03-04

## Tenant isolation

- **Dealer:** All tenant tables have `dealership_id`; routes use `getAuthContext()` → `requireDealershipContext()` and pass `dealershipId` into services. Internal routes use JWT and body/params for tenant id; must not trust client for cross-tenant.
- **Platform:** Single-tenant DB; no cross-dealership data in same DB. Cross-tenant concerns are platform→dealer calls (internal API) with JWT.
- **Verification:** RBAC and tenant isolation tests exist (platform); dealer tenant tests in route.tenant-status.test.ts. Full cross-tenant attempt tests to be run in clean env.

## RBAC

- **Platform:** All protected API routes call `requirePlatformAuth()` then `requirePlatformRole()` where needed. RBAC tests present for users, dealerships, applications, audit, monitoring.
- **Dealer:** Routes use `requirePermission()` after `getAuthContext()`. Permission load from RolePermission; least privilege.
- **Gaps (if any):** To be re-verified when builds pass; see ROUTE_COMPLIANCE_MATRIX.

## Validation (Zod at edge)

- **Platform:** List/create/update routes use schemas from @dms/contracts or local Zod; params/query/body validated. See ROUTE_COMPLIANCE_MATRIX.
- **Dealer:** Handlers use validate + Zod; see FIX_PLAN for any routes missing validation.
- **Abuse cases:** Invalid UUID, oversized body, wrong type — covered by Zod; add tests where gaps exist.

## Rate limiting

- **Dealer:** lib/api/rate-limit.ts; applied to auth/sensitive endpoints per existing code.
- **Platform:** Auth callback and login are external-facing; rate limit on auth endpoints to be confirmed.
- **Action:** Verify rate limit on /api/platform/auth/callback and login flow; add if missing.

## Log hygiene

- **Redact:** lib/redact.ts used; tokens, cookies, authorization headers must not be logged.
- **Error sanitization:** sanitizeErrorForLog / toErrorPayload used in handlers; ensure no PII/tokens in responses or logs.

## Status

PASS (design and existing code). Full verification blocked by environment; re-run after npm ci and builds succeed.

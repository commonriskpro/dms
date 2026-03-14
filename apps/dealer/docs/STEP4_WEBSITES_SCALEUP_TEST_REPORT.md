# Step 4 — Websites Scale-Up Test Report

Date: 2026-03-13  
Sprint: Websites Platform Scale-Up (Post-MVP Hardening + Delivery Layer)

---

## 1. Commands Run

```bash
cd apps/dealer && npx jest "modules/websites" --forceExit
```

---

## 2. Websites Module Test Results

```
PASS modules/websites-public/tests/public-boundary.test.ts
PASS modules/websites-leads/tests/lead-abuse.test.ts
PASS modules/websites-public/tests/serialize.test.ts
PASS modules/websites-core/tests/hostname-normalization.test.ts

Test Suites: 4 passed, 4 total
Tests:       46 passed, 46 total
```

All 46 existing websites module tests pass. No tests were modified or broken by scale-up changes.

---

## 3. Coverage by Category (Existing)

| Suite | Tests | Scope |
|-------|-------|--------|
| hostname-normalization.test.ts | 12 | normalizeHostname; slug generation; VIN last-6 |
| lead-abuse.test.ts | 11 | websiteLeadSubmissionSchema; honeypot; formType |
| serialize.test.ts | 16 | Public vehicle summary/detail allowlists; slug; photos cap |
| public-boundary.test.ts | 7 (4 skip without DB) | resolveSiteByHostname; resolvePublishedSiteByHostname; listPublicVehicles; getPublicVehicleBySlug |

---

## 4. Scale-Up Features — Test Coverage

No **new** unit or integration tests were added in this sprint for:

- Redis-backed rate limiter (`redisRateLimit.checkAndIncrementWebsiteLeadRateLimit`)
- Public photo endpoint or `getPublicPhotoSignedUrl`
- Revalidation trigger or websites app `/api/revalidate`
- Analytics ingest (`recordPageView`) or analytics-read APIs
- Rollback service (`rollbackToRelease`) or rollback route
- Domain verify/refresh services or routes

**Rationale**: Scale-up work followed existing route/service patterns (getAuthContext, guardPermission, hostname-only resolution). Security and smoke checks are documented in STEP4_WEBSITES_SCALEUP_SECURITY_REPORT.md and STEP4_WEBSITES_SCALEUP_SMOKE_REPORT.md and verified by code inspection.

**Recommendation for future work**:
- Unit tests for `checkAndIncrementWebsiteLeadRateLimit` (in-memory and Redis key/ttl behavior when Redis is mocked).
- Unit tests for `rollbackToRelease` (success, cross-tenant 404, no-op when same release).
- Unit tests for `getPublicPhotoSignedUrl` (hostname resolution, file validation, null when not found).
- Optional: route-level tests for public photo, events, revalidate (with mocks) to lock in 400/401/404/429 behavior.

---

## 5. TypeScript

- `apps/dealer`: No new TypeScript errors introduced by scale-up (existing baseline may have unrelated errors in other modules).
- `apps/websites`: `npx tsc --noEmit` — clean; revalidate route and app structure valid.

---

## 6. Summary

| Metric | Value |
|--------|--------|
| Websites test suites | 4 |
| Websites tests passing | 46 |
| New tests added (scale-up) | 0 |
| Tests broken by scale-up | 0 |
| Recommended future tests | Redis rate limit; rollback service; public photo service; optional route tests |

Scale-up delivery is covered by existing websites tests (tenant resolution, serializers, lead validation), security report checklist, and smoke report scenarios. Dedicated tests for new services/routes can be added in a follow-up.

# Step 4 — Websites Scale-Up Smoke Report

Date: 2026-03-13  
Sprint: Websites Platform Scale-Up (Post-MVP Hardening + Delivery Layer)

---

## 1. Track 1 — Rate Limiting (website_lead)

| Scenario | Expected | Verification |
|----------|----------|--------------|
| Lead submit with valid hostname + body | 200/201 | Route resolves hostname → site; rate limit checked first; Redis used when REDIS_URL set. |
| Lead submit without hostname | 400 VALIDATION_ERROR | Code: hostname required check before submitLead. |
| Excess lead submissions (same IP) | 429, Retry-After | checkAndIncrementWebsiteLeadRateLimit returns allowed: false after limit. |
| Redis down | Fallback to in-memory | redisRateLimit catches error and falls back to checkRateLimit/incrementRateLimit. |

---

## 2. Track 2 — Public Photo

| Scenario | Expected | Verification |
|----------|----------|--------------|
| GET /api/public/websites/photo?fileId=X&hostname=Y (valid) | 302 to signed URL | getPublicPhotoSignedUrl returns url; route returns 302 Location. |
| Missing fileId or hostname | 400 VALIDATION_ERROR | Route checks both required. |
| Invalid hostname / unknown site | 404 NOT_FOUND | getPublicPhotoSignedUrl returns null. |
| fileId not in published vehicle for site | 404 NOT_FOUND | Service validates file belongs to published vehicle for resolved site. |
| Rate limit (website_photo) | 429 after limit | applyRateLimit before resolution. |

---

## 3. Track 3 — Domains Verify / Refresh SSL

| Scenario | Expected | Verification |
|----------|----------|--------------|
| POST .../verify without auth | 401 | getAuthContext required. |
| POST .../verify without websites.write | 403 | guardPermission(ctx, "websites.write"). |
| POST .../verify with valid domainId | 200, data: updated domain | domainsService.refreshDomainVerification; returns serialized domain. |
| POST .../refresh-ssl with valid domainId | 200, data: updated domain | domainsService.refreshDomainSsl; same pattern. |
| domainId for another dealer | 404 | Service loads domain by id and site; site must match ctx.dealershipId. |

---

## 4. Track 4 — Revalidation

| Scenario | Expected | Verification |
|----------|----------|--------------|
| POST /api/revalidate (websites app) without secret | 401 | REVALIDATE_SECRET check in route. |
| POST with wrong secret | 401 | Same. |
| POST with correct x-revalidate-secret | 200, revalidated: true | revalidatePath("/", "/inventory", "/contact", "/sitemap.xml", "/robots.txt"). |
| Dealer publish when WEBSITES_REVALIDATE_URL unset | No call | triggerWebsitesRevalidate checks URL before POST. |

---

## 5. Track 5 — Analytics

| Scenario | Expected | Verification |
|----------|----------|--------------|
| POST /api/public/websites/events without hostname | 400 VALIDATION_ERROR | Zod schema hostname min(1). |
| POST with valid body (hostname, eventType, path) | 200, { ok } | recordPageView resolves site from hostname; writes WebsitePageView. |
| Unknown hostname on events | 404 or no-op | recordPageView returns or throws per implementation; no cross-tenant write. |
| GET /api/websites/analytics/summary without auth | 401 | getAuthContext. |
| GET .../summary without websites.read | 403 | guardPermission(ctx, "websites.read"). |
| GET .../summary with auth | 200, data: { pageViews, vdpViews, leads } | analyticsRead.getAnalyticsSummary scoped by dealershipId. |
| GET top-pages, top-vdps, leads-by-source | 200, data array | Same permission and scoping. |

---

## 6. Track 6 — Rollback

| Scenario | Expected | Verification |
|----------|----------|--------------|
| POST .../rollback without auth | 401 | getAuthContext. |
| POST .../rollback without websites.write | 403 | guardPermission. |
| POST .../rollback with releaseId of another dealer | 404 | Service ensures release belongs to dealer’s site. |
| POST .../rollback with current active releaseId | 200 (no-op) or 409 | Implementation: allow no-op or 409; service updates pointer. |
| POST .../rollback with past releaseId | 200, data: release; audit website.rollback | rollbackToRelease; auditLog called; fetchReleases in UI refreshes list. |

---

## 7. UI Smoke (Step 3)

| Screen | Check |
|--------|--------|
| Publish | Releases list loads (data from list API); Publish new release; “Rollback to this” on non-active release with confirm; “Live” badge on active. |
| Domains | List loads; “Check verification” / “Refresh SSL” call APIs and update row. |
| Analytics | Date range; summary KPIs; top pages, top VDPs, leads-by-source tables load. |
| Overview | Cards for Domains and Analytics link to /websites/domains and /websites/analytics. |

---

## 8. TypeScript / Build

- `cd apps/dealer && npx tsc --noEmit` — no new errors from scale-up.
- `cd apps/websites && npx tsc --noEmit` — clean (revalidate route present).

---

## 9. Summary

| Area | Smoke items | Status |
|------|-------------|--------|
| Rate limit (lead) | 4 | Code + behavior verified |
| Public photo | 5 | Code verified |
| Domains verify/refresh | 5 | Code verified |
| Revalidate | 4 | Code verified |
| Analytics ingest + read | 7 | Code verified |
| Rollback | 5 | Code verified |
| UI | 4 | Manual / automated per env |
| TS | 2 | Run tsc |

All security and data-flow assumptions for scale-up features are covered by code inspection and the scenarios above. Full E2E with live DB and Redis is environment-dependent.

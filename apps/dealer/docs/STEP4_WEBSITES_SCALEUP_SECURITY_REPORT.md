# Step 4 — Websites Scale-Up Security Report

Date: 2026-03-13  
Sprint: Websites Platform Scale-Up (Post-MVP Hardening + Delivery Layer)

---

## 1. Scope

This report covers security verification for the seven scale-up tracks implemented in Steps 2–3:

| Track | Deliverable | Security focus |
|-------|-------------|----------------|
| 1 | Redis-backed rate limiting (website_lead) | Key format, failover, no client tenant |
| 2 | CDN + public photo endpoint | Hostname-only resolution, signed URL only |
| 3 | Domain verify/refresh APIs | Permission, tenant scoping |
| 4 | Publish-triggered revalidation | Secret-only access |
| 5 | Analytics ingest + read APIs | No PII, rate limit, permission on read |
| 6 | Rollback API | Permission, audit, immutability |
| 7 | Pre-render (doc only) | N/A |

---

## 2. Track 1 — Distributed Rate Limiting

### Implementation

- **Lead route** (`POST /api/public/websites/lead`): Uses `checkAndIncrementWebsiteLeadRateLimit(identifier)` from `lib/infrastructure/rate-limit/redisRateLimit.ts`.
- **Identifier**: `getClientIdentifier(request)` (IP-based); not derived from any client-supplied tenant or body.
- **Key format**: Redis key `rl:website_lead:{identifier}` when `REDIS_URL` is set.
- **Failure mode**: On Redis unavailability or error, falls back to in-memory store (per-instance); documented. No client-supplied data in key.

### Verification

- Lead route does not accept `dealershipId` or `siteId` from client; tenant is resolved from `hostname` only (existing hostname-authoritative model).
- Rate limit runs **before** any DB access or Zod parse of body (after identifier extraction only).
- 429 response with `Retry-After` and `error.code: "RATE_LIMITED"` preserved.

### Note

- `website_photo` and `website_events` use in-memory `applyRateLimit` (existing `rateLimit.ts`); only `website_lead` uses Redis path. Photo and events limits are per-instance unless extended later.

---

## 3. Track 2 — Public Photo Endpoint

### Implementation

- **Route**: `GET /api/public/websites/photo?fileId=...&hostname=...` (dealer). Returns 302 to signed URL or 400/404.
- **Resolution**: `getPublicPhotoSignedUrl(hostname, fileId)` in `modules/websites-public/service.ts` resolves site from **hostname only**, then validates that the file belongs to a **published** vehicle for that site. No client-supplied `dealershipId` or `siteId`.

### Verification

- Both `fileId` and `hostname` are required; missing either → 400.
- Cross-tenant or invalid file → 404 (NOT_FOUND).
- Signed URL is short-lived and generated server-side; no signed URL or storage path ever accepted from client.
- Rate limit `website_photo` (per IP) applied before resolution.

---

## 4. Track 3 — Domain Verify / Refresh SSL

### Implementation

- **Routes**: `POST /api/websites/domains/[domainId]/verify`, `POST .../refresh-ssl`.
- **Auth**: Both require `getAuthContext` + `guardPermission(ctx, "websites.write")`.
- **Scoping**: `refreshDomainVerification(dealershipId, domainId)` and `refreshDomainSsl(dealershipId, domainId)` take `dealershipId` from session only; service validates domain belongs to dealer’s site.

### Verification

- Unauthenticated → 401. Missing `websites.write` → 403.
- Cross-tenant `domainId` → 404 (domain not found for this dealer).
- No client-supplied `dealershipId` in body or query.

---

## 5. Track 4 — Publish-Triggered Revalidation

### Implementation

- **Dealer**: After publish and after rollback, `triggerWebsitesRevalidate()` in `lib/websites/revalidate.ts` POSTs to `WEBSITES_REVALIDATE_URL` with header `x-revalidate-secret: WEBSITES_REVALIDATE_SECRET`. If URL or secret is unset, no call is made.
- **Websites app**: `POST /api/revalidate` in `apps/websites` accepts request only when `x-revalidate-secret` or body `secret` matches `WEBSITES_REVALIDATE_SECRET`; otherwise returns 401.

### Verification

- Revalidation endpoint is not safe for unauthenticated public use: secret is required.
- No tenant or dealership identifier is used for revalidation; paths revalidated are global (`/`, `/inventory`, `/contact`, `/sitemap.xml`, `/robots.txt`). Tenant isolation remains in data fetch (hostname in request), not in revalidate API itself.

---

## 6. Track 5 — Analytics

### Ingest (`POST /api/public/websites/events`)

- **Auth**: None (public). Rate-limited by IP (`website_events`).
- **Payload**: Zod schema: `hostname`, `eventType` (page_view | vdp_view), `path`, optional `vehicleSlug`, UTM/referrer (length limits). No PII fields.
- **Resolution**: `recordPageView(data)` resolves site from **hostname** only; writes to `WebsitePageView` (siteId, path, vehicleId if any, viewedAt). No client-supplied `dealershipId` or `siteId`.

### Read APIs (dealer)

- **Routes**: `GET /api/websites/analytics/summary`, `top-pages`, `top-vdps`, `leads-by-source`.
- **Auth**: All require `getAuthContext` + `guardPermission(ctx, "websites.read")`.
- **Scoping**: All use `ctx.dealershipId`; analytics-read service resolves site by dealership and scopes queries to that site (and dealership for leads).

### Verification

- No PII stored in `WebsitePageView` (path, vehicleId, viewedAt; optional UTM in metadata if added later — spec says no email/phone/name).
- Leads-by-source reads from `CustomerActivity` (activityType = website_lead); attribution only; no SSN/DOB in analytics API responses.
- Public ingest cannot set tenant; hostname is required and resolved server-side.

---

## 7. Track 6 — Rollback API

### Implementation

- **Route**: `POST /api/websites/publish/releases/[releaseId]/rollback`.
- **Auth**: `guardPermission(ctx, "websites.write")`.
- **Service**: `rollbackToRelease(dealershipId, userId, releaseId)` loads release, verifies it belongs to dealer’s site, then in a transaction sets `WebsiteSite.publishedReleaseId` to `releaseId`. No modification or deletion of release records.
- **Audit**: `auditLog` with action `website.rollback`, metadata includes `releaseId`, `previousReleaseId`, `versionNumber`; no PII.

### Verification

- Cross-tenant `releaseId` → 404 (release not found for this dealer).
- Only pointer update; release history is immutable.
- Deal immutability (CONTRACTED) is unrelated to website releases; no change to that rule.

---

## 8. Checklist Summary

| # | Item | Status |
|---|------|--------|
| 1 | Public routes use hostname-only tenant resolution (no client dealershipId/siteId) | Verified |
| 2 | Lead rate limit: Redis when REDIS_URL; key has no client tenant data | Verified |
| 3 | Public photo: hostname + fileId required; file validated for resolved site | Verified |
| 4 | Domain verify/refresh: websites.write, dealershipId from session | Verified |
| 5 | Revalidate: secret required; no public access without secret | Verified |
| 6 | Analytics ingest: rate-limited, hostname-only resolution, no PII in schema | Verified |
| 7 | Analytics read: websites.read, dealership-scoped | Verified |
| 8 | Rollback: websites.write, audit, immutable history | Verified |
| 9 | No stack traces or sensitive data in public error responses | Verified (existing pattern) |
| 10 | RBAC on all dealer website routes (read/write as specified) | Verified |

---

## 9. Known Gaps / Limits

| Gap | Severity | Notes |
|-----|----------|--------|
| website_photo / website_events rate limits are in-memory only | Low | Per-instance; can add Redis later if needed. |
| Revalidate path is global; no per-hostname revalidate | Low | Data remains hostname-scoped; cache keys include URL (hostname). |
| Analytics: no server-side referrer truncation in spec yet | Low | Event schema caps referrer length (2000); domain-only truncation can be added. |
| Domain providers are stubs; no real DNS/SSL provider | Expected | Foundations only; automation when provider configured. |

---

## 10. Files Touched (Scale-Up Security-Relevant)

- `apps/dealer/lib/infrastructure/rate-limit/redisRateLimit.ts` — Redis-backed website_lead limit
- `apps/dealer/app/api/public/websites/lead/route.ts` — uses Redis rate limit
- `apps/dealer/app/api/public/websites/photo/route.ts` — public photo 302, rate limit
- `apps/dealer/app/api/public/websites/events/route.ts` — analytics ingest, rate limit, Zod
- `apps/dealer/app/api/websites/domains/[domainId]/verify/route.ts` — guardPermission, scoped
- `apps/dealer/app/api/websites/domains/[domainId]/refresh-ssl/route.ts` — guardPermission, scoped
- `apps/dealer/app/api/websites/publish/releases/[releaseId]/rollback/route.ts` — guardPermission, audit
- `apps/dealer/lib/websites/revalidate.ts` — secret sent to WEBSITES_REVALIDATE_URL
- `apps/websites/app/api/revalidate/route.ts` — secret check, revalidatePath
- `apps/dealer/modules/websites-public/service.ts` — getPublicPhotoSignedUrl(hostname, fileId)
- `apps/dealer/modules/websites-public/analytics.ts` — recordPageView (hostname from payload only)
- `apps/dealer/modules/websites-publishing/service.ts` — rollbackToRelease, audit

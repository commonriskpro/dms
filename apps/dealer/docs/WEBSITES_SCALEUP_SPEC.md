# Websites Platform Scale-Up Spec — Post-MVP Hardening + Delivery Layer

**Sprint**: Websites Platform Scale-Up  
**Date**: 2026-03-13  
**Status**: Step 1 — Spec (implementation deferred to Step 2)

---

## 1. Purpose and Scope

This spec defines the **next seven platform upgrades** for the Websites system after the MVP (Steps 1–4 complete). It is aligned to the actual codebase under `apps/dealer`, `apps/websites`, `packages/contracts`, and `apps/worker`.

**In scope (7 tracks):**
1. Redis-backed distributed rate limiting for public website leads (and optional future public endpoints)
2. CDN + image optimization pipeline architecture
3. Custom domain + SSL automation foundations
4. Cache / revalidation strategy for inventory, VDP, home, sitemap, robots
5. Website analytics + attribution
6. Rollback API for website publish releases
7. Optional pre-rendering strategy for top public pages

**Out of scope for this sprint:**
- Rebuilding or redesigning the existing Websites MVP
- Generic CMS or page builder
- Collapsing public runtime back into apps/dealer
- Replacing publish snapshots with direct draft reads
- Client-supplied dealershipId anywhere in public resolution

---

## 2. Current Baseline (Code Truth)

### 2.1 Implemented Today

| Area | Location | Current State |
|------|----------|----------------|
| **Rate limit** | `lib/api/rate-limit.ts`, `lib/infrastructure/rate-limit/rateLimit.ts` | In-memory `Map`; type `website_lead` 5/min per IP. Lead route uses `applyRateLimit(request, { type: "website_lead", keyStrategy: "ip" })`. |
| **Redis** | `lib/infrastructure/jobs/redis.ts`, `lib/infrastructure/cache/cacheClient.ts` | Used for BullMQ connection and cache backend when `REDIS_URL` is set. No Redis-backed rate limiter. |
| **Publish** | `modules/websites-publishing` | Atomic single transaction: create release + update `site.publishedReleaseId`. No rollback. |
| **Releases API** | `GET /api/websites/publish/releases`, `GET .../releases/[id]` | List and detail only. |
| **Domains** | `WebsiteDomain` (verificationStatus, sslStatus), `modules/websites-domains` | PENDING/VERIFIED/FAILED, PENDING/PROVISIONED/FAILED/NOT_APPLICABLE. Manual update via PATCH. No provider abstraction or async jobs. |
| **Public media** | `websites-public/serialize.ts` returns `fileObjectId`; VDP uses `/api/photo/[id]` | Dealer has `/api/files/signed-url` (auth + documents.read). **Gap:** `apps/websites` has no `/api/photo/` route; VDP references it — requires public-safe photo URL path. |
| **Cache (apps/websites)** | `site-resolver.ts`, inventory/VDP/sitemap fetch | `revalidate: 60` (resolve), 30 (inventory, VDP), 3600 (sitemap inventory). No publish-triggered invalidation. |
| **Analytics** | Lead submission only | UTM stored in `CustomerActivity.metadata`. No page view, VDP view, or aggregated website analytics. |
| **Pre-render** | All pages dynamic | Hostname from request; no `generateStaticParams`. |

### 2.2 Repo Patterns to Reuse

- **Rate limit**: Extend or replace via `lib/api/rate-limit.ts` and/or `lib/infrastructure/rate-limit/rateLimit.ts`; reuse `getClientIdentifier`, response shape (429, Retry-After).
- **Redis**: Single `redisConnection` in `lib/infrastructure/jobs/redis.ts`; cache uses `cacheClient.ts` (Redis when `REDIS_URL`). Prefer shared connection or a small Redis helper for rate-limit counters.
- **APIs**: `getAuthContext` → `guardPermission` → validate → service → `jsonResponse`. Public: hostname-only resolution, explicit public serializers.
- **Audit**: `auditLog()` from `@/lib/audit` for publish/rollback/domain actions.
- **Worker**: BullMQ only where async is clearly justified; Postgres for durable state.

---

## 3. Track 1 — Distributed Rate Limiting (Spec)

### 3.1 Goal

Replace the **in-memory** store for `website_lead` (and optionally other public limits) with a **Redis-backed** distributed limiter so that all app instances share the same counters.

### 3.2 Design

- **Backend**: When `REDIS_URL` is set, use Redis for rate-limit counters for public types (at minimum `website_lead`). Reuse existing Redis connection pattern (e.g. `ioredis` from cache/jobs) or a dedicated small client for rate limiting to avoid tying rate-limit availability to BullMQ.
- **Key strategy**: `website_lead` → per-IP. Key format: `rl:website_lead:ip:{identifier}` (or `rl:public:website_lead:{identifier}`). Identifier = same as today (`getClientIdentifier(request)`).
- **Window**: Fixed or sliding window matching current behavior: 5 requests per 60 seconds per IP for `website_lead`.
- **Failure mode**: If Redis is unavailable, **fail open** is unacceptable for abuse; **fail closed** (reject request with 503 or treat as rate limited) or **fallback to in-memory per instance** with documented limitation. Spec recommendation: fallback to in-memory with a short TTL and document that under Redis outage, limits are per-instance.
- **Response shape**: Keep current 429 with `Retry-After` and `error.code: "RATE_LIMITED"`.
- **Preserve**: Honeypot and Zod validation unchanged; rate limit runs before any DB access.

### 3.3 Implementation Plan (Step 2)

- Add a Redis-backed rate-limit helper (e.g. in `lib/infrastructure/rate-limit/` or extend `lib/api/rate-limit.ts` with a pluggable store). Use existing `REDIS_URL` and avoid duplicate connection logic.
- For `website_lead`, call the Redis-backed path when Redis is available; else fall back to current in-memory check.
- Optional: make the backend configurable so future public endpoints (e.g. inventory/search) can use the same shared limiter with different keys/limits.
- No app-instance-local counters as the **primary** enforcement when Redis is present.

### 3.4 Worker Usage

Rate limiting is synchronous in the request path. No BullMQ involvement.

---

## 4. Track 2 — CDN + Image Optimization (Spec)

### 4.1 Goal

Add a **real architecture path** for website media delivery: abstraction for URLs, optional image transforms, and a documented CDN integration path. Do not fake full CDN provisioning if infra is absent.

### 4.2 Current State

- Vehicle photos: stored via Supabase storage; `VehiclePhoto.fileObjectId` → `FileObject`; dealer uses `/api/files/signed-url` (authenticated).
- Public serializer returns `fileObjectId` list and `primaryPhotoUrl` (fileObjectId). VDP in `apps/websites` uses `src={/api/photo/${fileObjectId}}` but **no `/api/photo/` route exists in apps/websites** — this is a gap (either implement or document as placeholder).
- No CDN or image transform layer in front of website media.

### 4.3 Design

- **Public photo URL path**: Dealer must expose a **public-safe** endpoint that, given a fileObjectId (and optionally hostname or site context for tenant validation), returns a redirect to a signed URL or a direct URL. Tenant resolution must be hostname/site-based, not client-supplied. This can be:
  - `GET /api/public/websites/photo?fileId=...&hostname=...` → 302 to signed URL (short-lived), or
  - Same plus optional query params for width/height for future image API.
- **Media URL helper**: Introduce a small helper in dealer (e.g. `modules/websites-public` or `lib/websites-media`) that builds the public photo URL (or CDN URL when configured). Templates in apps/websites consume this URL shape; they do not know storage internals.
- **apps/websites**: Either (a) use dealer API URL for images directly (e.g. `DEALER_API_URL + "/api/public/websites/photo?..."`) or (b) add a proxy route in apps/websites that forwards to dealer with hostname. Prefer (a) for simplicity and to avoid leaking dealer origin; ensure CORS/cookies are not required.
- **Image optimization**: Use Next.js `next/image` where applicable with the public URL as `src`; or document that when a CDN is introduced, the same URL helper can emit CDN URLs with transform params. No hardcoding of provider-specific assumptions unless already present.
- **CDN path**: Document that future CDN can sit in front of dealer public asset origin; env (e.g. `WEBSITES_MEDIA_CDN_BASE` or `NEXT_PUBLIC_WEBSITES_IMAGE_BASE`) can switch URL builder to CDN base. Out of scope for this sprint: actual CDN provisioning and transform service.

### 4.4 Implementation Plan (Step 2)

- Add public-safe photo endpoint in dealer (hostname + fileId; validate file belongs to published site’s dealership and is a vehicle photo).
- Add media URL builder for websites (dealer and/or contracts) so templates get a single URL shape.
- In apps/websites, use that URL for VDP (and inventory cards if they show primary photo). Prefer `next/image` with appropriate `sizes`/placeholder.
- Document CDN integration path and env placeholder in WEBSITES_CACHING_AND_DELIVERY_SPEC.

### 4.5 Worker Usage

None. Sync URL generation and redirect.

---

## 5. Track 3 — Custom Domain + SSL Automation Foundations (Spec)

### 5.1 Goal

Move toward **automation-ready** domain/SSL architecture: lifecycle states, verification workflow, SSL workflow fields, and provider abstraction. Implement **only** what the repo/infra can truthfully support; do not promise zero-touch DNS if not implemented.

### 5.2 Current State

- `WebsiteDomain`: hostname, isPrimary, isSubdomain, verificationStatus (PENDING | VERIFIED | FAILED), sslStatus (PENDING | PROVISIONED | FAILED | NOT_APPLICABLE).
- Platform subdomains: created with VERIFIED/PROVISIONED. Custom domains: created with PENDING/PENDING; manual PATCH to update status.
- No provider abstraction; no async jobs for verification or SSL.

### 5.3 Design

- **Lifecycle states**: Already present. Optional: add `lastVerifiedAt` / `lastSslCheckAt` for UI and idempotent refresh.
- **Verification workflow**: Define semantics: e.g. “verify domain ownership” (TXT or CNAME check). Provider abstraction: interface that accepts (domainId, hostname) and returns success/failure/pending. Implement a **no-op or mock** implementation when no DNS provider is configured; real implementation when env (e.g. DNS_PROVIDER) is set.
- **SSL workflow**: Same idea: interface for “provision SSL” / “check SSL status”. Manual fallback: dealer can set sslStatus via PATCH; when provider is present, job or sync path can update status.
- **Async jobs**: Only if justified — e.g. “refresh domain verification” or “provision SSL” can be BullMQ jobs that call the provider and update `WebsiteDomain`. Document that worker must be running and configured for automation.
- **Admin/API**: Endpoints like “refresh verification” or “check SSL” (POST or GET) that trigger re-check and update status; permission `websites.write`. UI shows verification/SSL state and “Check again” / “Refresh” where implemented.
- **Public resolver**: Unchanged. Hostname-based resolution remains authoritative; no client-supplied tenant.

### 5.4 Implementation Plan (Step 2)

- Add provider abstraction (e.g. `modules/websites-domains/providers/dns.ts` and `ssl.ts`) with stub implementations.
- Optional: add `lastVerifiedAt` / `lastSslCheckAt` to schema if useful for UX.
- Add domain “refresh verification” and “refresh SSL status” API (and optionally enqueue worker job if async is chosen).
- Document in WEBSITES_DOMAINS_AUTOMATION_SPEC what is automated vs manual and what env is required.

### 5.5 Worker Usage

Optional: BullMQ job for “domain verification check” or “SSL refresh” when provider is configured. Otherwise sync refresh in API.

---

## 6. Track 4 — Cache / Revalidation Strategy (Spec)

### 6.1 Goal

Define a **deliberate** public caching strategy with safe TTLs and **publish-triggered** invalidation/revalidation so that new publishes are reflected within a bounded time.

### 6.2 Current State

- apps/websites: `resolveSite` revalidate 60s; inventory list 30s; VDP 30s; sitemap inventory 3600s.
- No invalidation when dealer publishes; cache entries expire only by TTL.
- Next.js fetch cache; no custom cache layer.

### 6.3 Design

- **Routes and TTLs** (recommended):
  - Resolve (site context): 60s revalidate.
  - Home: uses resolve; same 60s effective.
  - Inventory list: 30s (or 60s) revalidate.
  - VDP: 30s (or 60s) revalidate.
  - Contact: 60s (low churn).
  - Sitemap: static routes + inventory slug list; inventory slug list 300–3600s; consider 300s for faster post-publish visibility.
  - Robots: static or 300s.
- **Cache keys**: Next.js data cache is keyed by URL (and hostname is in the request). Ensure hostname is part of any custom key if a custom cache layer is added; do not cache cross-tenant.
- **Publish-triggered revalidation**: On successful publish (after transaction commits), call Next.js `revalidatePath`-style API **if** apps/websites is the same deployment. If apps/websites is a separate deployment (e.g. different Vercel project), dealer cannot call into it directly — then options are: (1) webhook from dealer to websites app to revalidate, (2) on-demand revalidation token in websites app that dealer calls with a shared secret, or (3) accept TTL-only and document max staleness. Spec recommendation: document the pattern (dealer POST to websites revalidate endpoint with secret, or webhook); implement revalidation hook in dealer (e.g. `afterPublish()` that calls a configured `WEBSITES_REVALIDATE_URL` with auth). Websites app exposes a small route that validates secret and runs revalidate for relevant paths (e.g. `/`, `/inventory`, path prefix `/vehicle/`).
- **Safety**: All resolution and data fetch must remain hostname-scoped; no cross-tenant data in cache.

### 6.4 Implementation Plan (Step 2)

- Document TTL table in WEBSITES_CACHING_AND_DELIVERY_SPEC.
- In dealer publish flow (post-transaction), call optional revalidation hook (env `WEBSITES_REVALIDATE_URL` + secret). In apps/websites, add internal route (e.g. `POST /api/revalidate` or `api/internal/revalidate`) that accepts token and revalidates home, inventory, contact, sitemap, and optionally path for vehicles.
- Keep existing revalidate values or adjust per table; ensure hostname is never omitted from resolution.

### 6.5 Worker Usage

Revalidation can be sync (dealer calls websites revalidate endpoint after publish). Optional: fire-and-forget async call so publish response is not blocked by revalidation latency.

---

## 7. Track 5 — Website Analytics + Attribution (Spec)

### 7.1 Goal

Add a **first meaningful** analytics loop: page views, VDP views, lead attribution, UTM/referrer capture, and aggregated reporting shape. Privacy-conscious and tenant-safe.

### 7.2 Design

- **Events to capture** (backend or via apps/websites API):
  - **Page view**: siteId, dealershipId, path, hostname, timestamp. Optional: referrer (sanitized), UTM params.
  - **VDP view**: same + vehicleId (internal) and/or slug.
  - **Lead**: already stored as CustomerActivity with UTM in metadata; ensure attribution is queryable (e.g. link to same session or first-touch UTM).
- **Storage**: New models or reuse. Options: (1) `WebsitePageView` (and optionally `WebsiteVdpView`) with dealershipId, siteId, path, vehicleId?, timestamp, utmSource, utmMedium, utmCampaign, referrer (truncated); (2) daily/hourly aggregates table for reporting. Prefer event-level for flexibility; aggregates can be materialized by job or on read.
- **Privacy**: No PII in analytics tables (no email, phone, name). Referrer truncated to domain if stored. IP not stored or hashed if needed for rate/dedup.
- **Attribution**: Lead submission already has UTM in activity metadata; analytics can join or aggregate “leads by source/medium/campaign” from existing data plus new page-view data for funnel.
- **API**: Dealer-only read APIs: e.g. `GET /api/websites/analytics/summary` (views, VDP views, leads over range; top pages, top campaigns). Permission `websites.read`.
- **Ingestion**: Public endpoint (no auth) that accepts page view / VDP view payload with hostname; server resolves site and writes event. Rate-limited and validated (e.g. max path length, enum for event type). Or: apps/websites server actions that call dealer public endpoint with hostname.

### 7.3 Implementation Plan (Step 2)

- Add Prisma models (e.g. WebsitePageView, optional WebsiteLeadAttribution or rely on CustomerActivity). Index dealershipId, siteId, createdAt.
- Add public ingest endpoint (e.g. POST /api/public/websites/events with hostname + event type + path + vehicle slug optional). Validate and rate-limit; resolve tenant from hostname only.
- Add dealer analytics read API and optional daily aggregate job. Dealer UI: analytics placeholder or summary (views, leads, top pages) under websites.

### 7.4 Worker Usage

Optional: BullMQ job to aggregate daily/hourly stats from raw events. Sync write on ingest is acceptable for MVP analytics.

---

## 8. Track 6 — Rollback API (Spec)

### 8.1 Goal

Allow dealer to **roll back** the live website to a **previous** published release safely: immutable history, atomic update of current live pointer, audit, permission-gated.

### 8.2 Design

- **Semantics**: “Promote release R as the new live release” for the site. Only releases that already exist for that site are allowed. Current `site.publishedReleaseId` is set to R.id in a transaction; no mutation of release payloads.
- **API**: e.g. `POST /api/websites/publish/releases/[releaseId]/rollback` (or `POST /api/websites/publish/rollback` with body `{ releaseId }`). Permission `websites.write`. Validate that releaseId belongs to the dealer’s site and is not already the active release (optional: allow “rollback” to current = no-op).
- **Service**: `rollbackToRelease(dealershipId, userId, releaseId)`: load release, ensure site ownership and release belongs to site, then transaction: update `WebsiteSite.publishedReleaseId` to releaseId. Audit log: e.g. `website.rollback` with releaseId, previousReleaseId, versionNumber.
- **Response**: Return updated release summary (same shape as publish response) and optionally “previous” release id for UI.
- **Safety**: No deletion or modification of historical releases; only the pointer changes.

### 8.3 Implementation Plan (Step 2)

- Add `rollbackToRelease` in websites-publishing service.
- Add route POST for rollback; guardPermission `websites.write`.
- Audit log on success.
- Frontend: rollback button/flow in publish/releases UI (Step 3).

### 8.4 Worker Usage

None. Sync transaction.

---

## 9. Track 7 — Pre-rendering Strategy (Spec)

### 9.1 Goal

Add **optional** pre-rendering or static optimization for high-value public pages where **safe** with hostname-based multi-tenant resolution. Do not break tenant resolution or assume a fixed host list unless it exists.

### 9.2 Constraints

- Each request can be for any hostname; there is no single static host list at build time unless explicitly configured (e.g. env list of known subdomains).
- Full SSG of all pages for all tenants is not feasible without a known list of hostnames.
- Correctness over theoretical performance: no cross-tenant bleed.

### 9.3 Design

- **Safe options**:
  1. **ISR / revalidate only**: Current approach — all pages are dynamic; use `revalidate` (30–60s) for data. No `generateStaticParams` for hostname or slug.
  2. **Sitemap/robots**: Already generated per request; can cache aggressively (e.g. 300–3600s) as today.
  3. **Optional static host list**: If env provides a list of hostnames (e.g. for platform subdomains), could pre-render home/inventory for those hosts at build time; complexity and build-time dealer API dependency are high — recommend **out of scope** for this sprint.
- **Recommendation**: Document that “optional pre-rendering” for this sprint means: (1) deliberate revalidate TTLs (see Track 4), (2) possible use of `generateStaticParams` for **vehicle slug** only when combined with a **single-tenant** build (e.g. one known hostname per deploy) — not general multi-tenant. For general multi-tenant, keep dynamic + revalidate and rely on cache/revalidation (Track 4) for performance.
- **Delivery notes**: Ensure Next.js config does not disable caching where we rely on it; document in WEBSITES_CACHING_AND_DELIVERY_SPEC.

### 9.4 Implementation Plan (Step 2)

- No change to generateStaticParams for multi-tenant case.
- Optional: add a short “Pre-rendering” section to WEBSITES_CACHING_AND_DELIVERY_SPEC explaining why full SSG is not used and what “optional” means (TTL + revalidation strategy).
- If a single-tenant build path is ever added (e.g. env WEBSITES_SINGLE_HOSTNAME), document it there; do not implement in this sprint unless specified.

### 9.5 Worker Usage

None.

---

## 10. Worker Usage Summary

| Track | Worker (BullMQ) | Notes |
|-------|------------------|------|
| 1 Rate limit | No | Sync in request path. |
| 2 CDN/Images | No | Sync URL/redirect. |
| 3 Domains/SSL | Optional | Async “refresh verification” / “SSL check” only if provider is async. |
| 4 Cache | No | Revalidation can be sync or fire-and-forget HTTP call. |
| 5 Analytics | Optional | Daily aggregate job; ingest is sync. |
| 6 Rollback | No | Sync transaction. |
| 7 Pre-render | No | Build-time or revalidate only. |

---

## 11. Step 2 Implementation Order

Recommended order for backend work:

1. **Track 1** — Redis rate limiter (unblocks production-safe scaling).
2. **Track 6** — Rollback API (discrete, no new infra).
3. **Track 2** — Public photo endpoint + media URL helper (closes VDP photo gap).
4. **Track 4** — Revalidation hook + TTL doc (reduces stale content risk).
5. **Track 5** — Analytics schema + ingest + read API (foundation for UI).
6. **Track 3** — Domain provider abstraction + refresh APIs (foundations only).
7. **Track 7** — Documentation only unless single-tenant path is added.

---

## 12. References

- Canonical: `docs/canonical/ARCHITECTURE_CANONICAL.md`, `MODULE_REGISTRY_CANONICAL.md`, `API_SURFACE_CANONICAL.md`, `KNOWN_GAPS_AND_FUTURE_WORK.md`.
- Existing specs: `apps/dealer/docs/WEBSITES_MODULE_SPEC.md`, `WEBSITES_PUBLIC_RUNTIME_SPEC.md`, `WEBSITES_PUBLISHING_MODEL.md`, `STEP4_WEBSITES_SECURITY_REPORT.md`.
- Code: `apps/dealer/lib/api/rate-limit.ts`, `lib/infrastructure/rate-limit/rateLimit.ts`, `lib/infrastructure/jobs/redis.ts`, `modules/websites-*`, `apps/websites/app/**`, `packages/contracts/src/websites*.ts`.

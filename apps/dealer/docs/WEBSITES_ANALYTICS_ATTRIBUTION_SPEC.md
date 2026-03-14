# Websites Analytics and Attribution Spec

**Sprint**: Websites Platform Scale-Up  
**Date**: 2026-03-13  
**Parent**: WEBSITES_SCALEUP_SPEC.md (Track 5)

---

## 1. Goal

Add a **first meaningful** analytics and attribution layer for the public dealer website:
- Page views (generic and VDP)
- Lead attribution (UTM, referrer, landing page)
- Aggregated reporting for dealer operators
- Privacy-conscious and tenant-safe

---

## 2. Events to Capture

### 2.1 Page View

- **When**: Any public page load (home, inventory, contact, VDP).
- **Payload**: siteId, dealershipId (server-resolved), path, hostname, timestamp. Optional: referrer (domain only, truncated), UTM (source, medium, campaign).
- **Storage**: Event-level row (e.g. `WebsitePageView`) or append to a stream. No PII (no IP stored in analytics table, or hashed if needed for dedup only).

### 2.2 VDP View

- **When**: Vehicle detail page load.
- **Payload**: Same as page view plus vehicleId (internal UUID, for join only) and/or vehicle slug. Enables “views per vehicle” and “top VDPs”.
- **Storage**: Same table with `vehicleId`/`slug` nullable; or dedicated `WebsiteVdpView` for simpler queries.

### 2.3 Lead (Existing + Attribution)

- **Current**: Lead submission creates `CustomerActivity` with `activityType: "website_lead"` and metadata: formType, pagePath, vehicleId, vehicleSlug, utmSource, utmMedium, utmCampaign, message.
- **Enhancement**: Ensure attribution is queryable; optional “session” or “visit” id for first-touch attribution (future). For this sprint: lead attribution = existing activity metadata + optional new analytics tables that can join by time/site.

---

## 3. Data Model (Proposed)

### 3.1 WebsitePageView (event-level)

- **Purpose**: Raw page and VDP views for aggregation and reporting.
- **Fields** (suggested):
  - id, dealershipId, siteId (all UUIDs)
  - path (e.g. `/`, `/inventory`, `/vehicle/2024-honda-civic-abc123`)
  - vehicleId (nullable, for VDP)
  - hostname (for debugging; can be truncated)
  - viewedAt (timestamp)
  - utmSource, utmMedium, utmCampaign (nullable, from request or session)
  - referrerDomain (nullable, truncated to domain; no full URL)
- **Indexes**: dealershipId, siteId, viewedAt; (siteId, vehicleId, viewedAt) for VDP reports.
- **Retention**: Configurable (e.g. 90 days); aggregate then prune or archive.

### 3.2 Optional: Daily/Hourly Aggregates

- **Purpose**: Fast dealer dashboard (views per day, top pages, top VDPs).
- **Table**: e.g. `WebsiteAnalyticsDaily` (dealershipId, siteId, date, pageViews, vdpViews, uniquePaths[], topVehicleIds[]). Filled by nightly job or on-demand from raw events.
- **Sprint**: Can defer aggregates and query raw events with limit; add aggregate table in a follow-up if needed.

---

## 4. Ingestion

### 4.1 Public Ingest Endpoint

- **Route**: e.g. `POST /api/public/websites/events` (dealer app).
- **Body**: `{ hostname, eventType: "page_view" | "vdp_view", path, vehicleSlug?: string, utmSource?, utmMedium?, utmCampaign?, referrer? }`.
- **Validation**: hostname required; path length limit; eventType enum; vehicleSlug optional only for vdp_view.
- **Flow**: Resolve site from hostname (fail closed if no published site). Create WebsitePageView (and resolve vehicleId from slug if vdp_view). Rate-limit by IP or hostname to prevent abuse.
- **Auth**: None; tenant is derived from hostname only. No client-supplied dealershipId/siteId.

### 4.2 Caller (apps/websites)

- **Option A**: Server component or API route in apps/websites that, after rendering a page, calls dealer public events endpoint with hostname and path (and vehicle slug for VDP). Fire-and-forget; do not block render.
- **Option B**: Client-side beacon (e.g. fetch on mount) with same payload. Prefer server-side for reliability and to avoid ad-blocker stripping.
- **Recommendation**: Server-side post-render call from apps/websites to dealer ingest endpoint; hostname and path (and slug for VDP) only; UTM/referrer can be passed from request headers/query if available and sanitized.

---

## 5. Reporting and Dealer API

### 5.1 Read API (Dealer Only)

- **Permission**: `websites.read`.
- **Endpoints** (suggested):
  - `GET /api/websites/analytics/summary?from=&to=` — totals: pageViews, vdpViews, leads (from CustomerActivity count), optional unique visitors estimate (e.g. by some fingerprint; or skip for MVP).
  - `GET /api/websites/analytics/top-pages?from=&to=&limit=10` — path, view count.
  - `GET /api/websites/analytics/top-vdps?from=&to=&limit=10` — vehicleId/slug, view count.
  - `GET /api/websites/analytics/leads-by-source?from=&to=` — aggregate by utmSource/utmMedium/utmCampaign from CustomerActivity where activityType = website_lead.

### 5.2 Tenant and Privacy

- All queries scoped by `ctx.dealershipId` (from auth). No cross-tenant data.
- No PII in analytics tables. Referrer stored as domain only. Do not store email, phone, or full URL in page view table.
- Audit: do not log request body with PII; log only event type and siteId for operational debugging if needed.

---

## 6. Implementation Plan (Step 2)

1. **Schema**: Add `WebsitePageView` (and indexes); run migration.
2. **Ingest**: Add `POST /api/public/websites/events` with validation, hostname resolution, rate limit, and insert.
3. **apps/websites**: From home, inventory, contact, VDP pages (or layout), call dealer events endpoint with hostname + path + vehicleSlug (for VDP). Fire-and-forget.
4. **Dealer read API**: Add summary and top-pages/top-vdps/leads-by-source routes; guardPermission `websites.read`.
5. **Dealer UI** (Step 3): Add Websites analytics section (e.g. `/websites/analytics`) with summary and simple tables; use existing dashboard/reporting patterns.

---

## 7. Out of Scope (This Sprint)

- Full session tracking and funnel visualization.
- Real-time dashboards.
- Export to external analytics (GA, etc.); can be added later.
- A/B testing or experimentation.

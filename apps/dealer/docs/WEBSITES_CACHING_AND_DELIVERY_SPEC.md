# Websites Caching and Delivery Spec

**Sprint**: Websites Platform Scale-Up  
**Date**: 2026-03-13  
**Parent**: WEBSITES_SCALEUP_SPEC.md (Track 2, 4, 7)

---

## 1. Scope

This document details:
- **Cache and revalidation** strategy for the public website runtime (Track 4).
- **Media delivery and CDN/image optimization** architecture (Track 2).
- **Pre-rendering** boundaries and safe options (Track 7).

---

## 2. Cache and Revalidation Strategy

### 2.1 Current Behavior (apps/websites)

| Surface | Fetch / Resolution | Revalidate (today) |
|---------|--------------------|---------------------|
| Site context (resolve) | `resolveSite(hostname)` → GET dealer `/api/public/websites/resolve?hostname=` | 60s |
| Home | Uses resolve + snapshot | 60s (via resolve) |
| Inventory list | GET dealer `/api/public/websites/inventory?hostname=&page=&limit=` | 30s |
| VDP | GET dealer `/api/public/websites/vehicle/[slug]?hostname=` | 30s |
| Contact | Uses resolve + snapshot | 60s |
| Sitemap (static routes) | N/A | N/A |
| Sitemap (vehicle slugs) | GET dealer inventory (limit 100) | 3600s |
| Robots | Static | N/A |

### 2.2 Recommended TTLs

| Surface | Revalidate | Rationale |
|---------|------------|-----------|
| Resolve / home / contact | 60s | Balance freshness vs load; theme/contact change infrequent. |
| Inventory list | 30–60s | Inventory can change; 30s keeps list fresh. |
| VDP | 30–60s | Same; price/photo/description updates. |
| Sitemap (vehicle slugs) | 300–3600s | 300s improves post-publish visibility; 3600s reduces dealer API load. |
| Robots | Static or 300s | Rarely changes. |

### 2.3 Cache Key and Tenant Safety

- Next.js data cache is keyed by **full URL** (including hostname when present in the request). All dealer API calls from apps/websites must include **hostname** in the query so that different hostnames do not share cached responses.
- **Never** cache or key by client-supplied `dealershipId` or `siteId`. Resolution is always hostname → site (server-side).
- If a custom cache layer is added (e.g. Redis for HTML or payloads), key format must include hostname, e.g. `websites:site:{hostname}:...` or `websites:inventory:{hostname}:page:...`.

### 2.4 Publish-Triggered Revalidation

**Problem**: After a dealer publishes, cached pages in apps/websites can stay stale until TTL expires (up to 60s or more for sitemap).

**Approach**:
- Dealer app, **after** successful publish transaction, calls a **revalidation endpoint** on the websites app (if configured).
- Env: `WEBSITES_REVALIDATE_URL` (e.g. `https://websites.example.com/api/revalidate`), `WEBSITES_REVALIDATE_SECRET`.
- Dealer POST body: e.g. `{ hostname, secret }` or `{ siteId, secret }`. Websites app validates secret and hostname/siteId, then runs Next.js `revalidatePath` (or equivalent) for:
  - `/` (home)
  - `/inventory`
  - `/contact`
  - `/sitemap.xml` (and optionally `/robots.txt`)
  - Optionally: revalidate by path prefix `/vehicle/` (harder without full slug list; can revalidate known paths or accept TTL for VDPs).
- If `WEBSITES_REVALIDATE_URL` is not set, dealer skips the call; caching remains TTL-only (documented).

### 2.5 Implementation Notes

- Revalidation endpoint in apps/websites must be **internal** (not public without auth). Use secret in header or body; do not expose revalidate to unauthenticated callers without it.
- Dealer can call revalidation in a fire-and-forget manner so publish response is not blocked; document that at-least-once is acceptable (duplicate revalidate is safe).

---

## 3. Media Delivery and CDN Architecture

### 3.1 Current State

- **Storage**: Vehicle photos stored in Supabase storage; `VehiclePhoto` has `fileObjectId` → `FileObject` (bucket, path).
- **Dealer**: `/api/files/signed-url?fileId=...` returns a short-lived signed URL; requires auth and `documents.read`.
- **Public**: Serializer returns `fileObjectId` (and `primaryPhotoUrl` as fileObjectId). VDP template in apps/websites uses `src={/api/photo/${fileObjectId}}` but **apps/websites has no `/api/photo/` route** — this is a gap.

### 3.2 Public Photo URL Path

- **Dealer** exposes a **public-safe** endpoint, e.g.:
  - `GET /api/public/websites/photo?fileId=<uuid>&hostname=<hostname>`
  - Server: resolve site from hostname; ensure file belongs to a vehicle that is published for that site’s dealership (via VehicleWebsiteSettings + VehiclePhoto + FileObject). Then generate short-lived signed URL and respond with **302 Redirect** to that URL (or 200 with JSON `{ url }` if client prefers).
- **Rate limit**: This endpoint is public; apply per-IP or per-hostname rate limit to prevent abuse (e.g. same as or higher than signed_url in dealer).
- **CORS**: If called from browser (apps/websites on different origin), allow appropriate origin or use server-side fetch from apps/websites to dealer and stream/redirect.

### 3.3 Media URL Helper

- **Location**: e.g. `modules/websites-public/media.ts` or `lib/websites-media.ts` in dealer.
- **Function**: `buildPublicPhotoUrl(fileId: string, hostname: string): string` returns the full URL to the public photo endpoint (dealer base URL + query params). Used by serializers or by apps/websites when building image URLs.
- **Contracts**: Public DTO can continue to expose `primaryPhotoUrl` and `photos` as **URLs** (string) when this helper is used (dealer builds URLs before sending), or keep as fileIds and have apps/websites build URLs using a shared base (e.g. `DEALER_API_URL`). Spec: prefer dealer returning full URLs for public API responses so apps/websites does not need to know dealer origin (optional; alternatively apps/websites builds URL from base + fileId + hostname).

### 3.4 apps/websites Image Rendering

- Use **next/image** for VDP and inventory cards when URL is available: `<Image src={primaryPhotoUrl} ... />` with appropriate `sizes` and `placeholder`.
- Fallback: placeholder or generic car icon when no photo.
- Do not expose internal storage paths or bucket names to client.

### 3.5 CDN Integration Path (Future)

- When a CDN is introduced:
  - **Option A**: CDN as reverse proxy in front of dealer; public photo endpoint URL is unchanged; CDN caches 302 or image response.
  - **Option B**: URL helper reads env e.g. `WEBSITES_MEDIA_CDN_BASE`; when set, builds URL as `{CDN_BASE}/photo?fileId=...&hostname=...` (CDN origin is dealer or a dedicated media service).
- **Image transforms**: If a future image service supports query params (e.g. `?w=800&h=600`), document in this spec; no implementation in current sprint beyond stable public URL shape.

---

## 4. Pre-rendering Strategy

### 4.1 Why Not Full SSG

- Public site is **multi-tenant by hostname**. At build time, Next.js does not have a fixed list of hostnames; each request can be for any subdomain or custom domain.
- **generateStaticParams** for dynamic routes (e.g. `[slug]` for VDP) would require either (1) a known list of hostnames + slugs per host (large matrix, build-time dealer API dependency), or (2) fallback to dynamic for unknown hostnames. (1) is complex and brittle; (2) is current behavior.

### 4.2 Safe Options

- **ISR / on-demand revalidate**: All pages are dynamic; use `revalidate` (30–60s) and optional publish-triggered revalidation. This is the recommended approach.
- **Sitemap/robots**: Cached with 300–3600s revalidate; no static generation of HTML.
- **Single-tenant build** (out of scope for this sprint): If a deployment serves exactly one hostname (e.g. env `WEBSITES_SINGLE_HOSTNAME`), then `generateStaticParams` for `/vehicle/[slug]` could pre-render known slugs for that host. Document only; do not implement in scale-up sprint.

### 4.3 “Optional Pre-rendering” Definition

For this sprint, “optional pre-rendering” means:
- Deliberate **revalidate** TTLs and **publish-triggered revalidation** (Track 4).
- No `generateStaticParams` for hostname or for vehicle slug in the general multi-tenant deployment.
- Possible future extension: single-tenant build with static params for that host’s known slugs.

---

## 5. Summary Table

| Area | In Scope (Scale-Up) | Out of Scope |
|------|----------------------|--------------|
| Cache TTLs | Document and optionally tune (30–60s for list/VDP; 60s resolve; 300–3600 sitemap). | Custom Redis HTML cache. |
| Revalidation | Dealer calls websites revalidate endpoint after publish; websites route with secret. | Full cache invalidation API. |
| Public photo | Dealer public photo endpoint; media URL helper; apps/websites use next/image. | Actual CDN provisioning; image resize service. |
| CDN | Document URL env and future CDN switch. | Live CDN and transforms. |
| Pre-render | ISR + revalidate only; doc why no SSG. | generateStaticParams for multi-tenant. |

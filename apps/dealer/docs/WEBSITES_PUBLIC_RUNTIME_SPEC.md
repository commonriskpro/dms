# Websites Public Runtime Spec — apps/websites

**Sprint**: Websites Module MVP  
**Date**: 2026-03-13  
**Status**: Planned

---

## Overview

`apps/websites` is a new, standalone Next.js App Router application in the monorepo. It serves public dealer websites to anonymous visitors. It has no dealer auth, no session cookies, and no access to internal dealer API endpoints.

It reads from the dealer database **only through controlled read-only service calls** via the `websites-public` module, or through a thin public API surface exposed by `apps/dealer`.

---

## App Initialization

```
apps/websites/
  app/
    layout.tsx                      — root layout, hostname → site resolution
    not-found.tsx                   — 404 page (also used for unpublished sites)
    page.tsx                        — home page
    inventory/
      page.tsx                      — inventory list
    vehicle/
      [slug]/
        page.tsx                    — VDP
    contact/
      page.tsx                      — contact page
    api/
      lead/
        route.ts                    — public lead submission (POST only)
    sitemap.ts                      — sitemap.xml
    robots.ts                       — robots.txt
  components/
    templates/
      premium-default/
        layout.tsx                  — template root layout shell
        header.tsx                  — nav, logo, phone
        footer.tsx                  — links, address, social
        home-page.tsx               — home page render
        inventory-page.tsx          — inventory list render
        vdp-page.tsx                — VDP render
        contact-page.tsx            — contact page render
        sections/
          hero.tsx
          featured-inventory.tsx
          finance-cta.tsx
          dealership-info.tsx
          contact-cta.tsx
          inventory-grid.tsx
          vdp-gallery.tsx
          vdp-specs.tsx
          vdp-pricing.tsx
          lead-form-modal.tsx       — shared form modal (vehicle-linked and general)
  lib/
    hostname.ts                     — extract hostname from Next.js request headers
    site-resolver.ts                — load published release for current hostname
    public-api.ts                   — fetch helpers for public inventory queries
    rate-limit.ts                   — IP-based rate limit helper (in-memory or KV)
  next.config.ts                    — Next.js config (see notes)
  package.json                      — workspace package for apps/websites
  tsconfig.json
```

---

## Package Setup

`apps/websites/package.json`:
```json
{
  "name": "@dms/websites",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "@dms/contracts": "*",
    "zod": "3.25.76"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

**Note:** `apps/websites` does NOT import `@prisma/client` directly. It calls the `websites-public` module via internal service calls within the monorepo, OR reads from a thin public API on `apps/dealer`. The approach for MVP is direct module import from `apps/dealer/modules/websites-public/service.ts` (same Prisma client, monorepo-internal). This avoids standing up a separate HTTP API boundary for reads that would add latency and complexity.

**Monorepo boundary note:** In the Vercel build, `apps/websites` and `apps/dealer` are separate deployments. For production, `apps/websites` will call `apps/dealer` public API endpoints for live inventory queries. For the published snapshot, `apps/websites` can call dealer API endpoints. The exact deployment boundary is documented in Step 2. For MVP, the approach is:
- Published release: cached/fetched from dealer public API or Supabase-direct (to be confirmed in Step 2).
- Live inventory queries: call dealer public inventory endpoints with site token.

---

## Hostname Resolution

`apps/websites/lib/hostname.ts`:
```ts
import { headers } from "next/headers";

export function resolveHostname(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  // Normalize: lowercase, strip port, strip leading www.
  return host.replace(/:\d+$/, "").toLowerCase().replace(/^www\./, "");
}
```

`apps/websites/lib/site-resolver.ts`:
```ts
// Resolves the published site release for the current hostname.
// Returns null if no published site is found (caller renders 404).
export async function resolvePublishedSite(hostname: string): Promise<PublishedSiteContext | null>
```

`PublishedSiteContext`:
```ts
type PublishedSiteContext = {
  siteId: string;
  dealershipId: string;
  subdomain: string;
  templateKey: string;
  snapshot: PublishSnapshot;  // the full parsed configSnapshotJson
};
```

Resolution:
1. Query `WebsiteDomain` where `hostname = $hostname`.
2. Load `WebsiteSite` via `siteId`.
3. If `site.publishedReleaseId = null` → return `null`.
4. Load `WebsitePublishRelease` by `publishedReleaseId`.
5. Parse and validate `configSnapshotJson`.
6. Return `PublishedSiteContext`.

**Cache strategy:**
- Published site resolution is cached per hostname with a short TTL (e.g. 60s) to avoid redundant DB reads per request.
- Uses `unstable_cache` (Next.js) or ISR with `revalidate`.
- Cache is invalidated on publish (via cache tag or short TTL).

---

## Route Behavior

### `app/layout.tsx`

- Calls `resolveHostname()` and `resolvePublishedSite()`.
- If `null` → renders `not-found.tsx` (Next.js 404 pattern).
- If found → passes `PublishedSiteContext` via React context or server component props to all child pages.
- Renders `<head>` with SEO defaults from snapshot.

### `app/page.tsx` — Home

- Reads site context.
- Renders `<PremiumDefaultHomePage config={snapshot} />`.
- SEO: `<title>` = snapshot.seo.defaultTitle || dealership.name.

### `app/inventory/page.tsx` — Inventory List

- Reads site context.
- Queries public inventory: calls `websites-public` service `listPublicVehicles(siteId, { page, limit })`.
- Render inventory grid via `<PremiumDefaultInventoryPage>`.
- Supports query params: `?make=`, `?model=`, `?year=`, `?page=`.
- All params validated with Zod before use.
- Returns 404 if inventory page is `isEnabled = false` in snapshot.

### `app/vehicle/[slug]/page.tsx` — VDP

- Reads site context.
- `slug` is the vehicle's public-safe slug (e.g. `2022-ford-f150-xlt`).
- Calls `websites-public` service `getPublicVehicle(siteId, slug)`.
- Returns 404 if vehicle not found, `isPublished = false`, or `vehicle.deletedAt != null`.
- Renders `<PremiumDefaultVdpPage>`.
- SEO: `<title>` = vehicle year/make/model/trim + dealership name.

### `app/contact/page.tsx` — Contact

- Renders contact form.
- Returns 404 if contact page `isEnabled = false` in snapshot.

### `app/api/lead/route.ts` — Lead Submission

- Method: POST only.
- Resolves hostname → `siteId` + `dealershipId` (from published site context).
- Validates body with `websites-forms.ts` Zod schema.
- Rate limit: 5 requests per 15 minutes per IP.
- Anti-spam: honeypot field must be empty.
- Calls `websites-leads` service.
- Response: `{ ok: true }` or `{ error: { code, message } }`.
- Never reveals customer IDs, internal UUIDs, or server state to the public response.

### `app/sitemap.ts` — Sitemap

- Reads published site context for hostname.
- Generates `SitemapEntry[]` for:
  - Home: `/`
  - Inventory: `/inventory`
  - Contact: `/contact`
  - VDPs: one entry per published, enabled vehicle
- Returns XML via Next.js `MetadataRoute.Sitemap`.

### `app/robots.ts` — Robots

- Returns `MetadataRoute.Robots` allowing all robots, pointing to sitemap.
- If site is not published → returns `disallow: "/"`.

---

## Template System — premium-default

The `premium-default` template is a set of React Server Components (RSC) that receive config props from the published snapshot and public inventory data.

### Config shape passed to template

```ts
type PremiumDefaultConfig = {
  dealership: {
    name: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    hours?: Record<string, string>;
  };
  theme: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  pages: PageConfig[];
  forms: FormConfig[];
};
```

All props are derived from the published snapshot's validated `configSnapshotJson`. No raw DB rows are passed to template components.

### Sections (home page)

Controlled section list rendered in order from `sectionsConfigJson`:
1. `hero` — headline, subheadline, CTA button (link to `/inventory`).
2. `featured_inventory` — up to 6 featured vehicles from snapshot `featuredVehicleIds`.
3. `finance_cta` — "Get pre-approved" CTA linking to finance form.
4. `dealership_info` — address, hours, phone.
5. `contact_cta` — "Contact us" section with form trigger.

Sections are enabled/disabled via `sectionsConfigJson` in the page config. Each section reads its config from the snapshot. No section accepts raw HTML.

### VDP layout

- Gallery: up to 20 photos. Uses `primaryPhotoOverrideId` if set.
- Specs: structured fields only (year, make, model, trim, mileage, condition, body, transmission, drivetrain, engine, ext/int color, vin — last 6 digits only for public VIN display).
- Pricing: shows formatted price or "Call for price" if `hidePrice = true`.
- Lead form: `CHECK_AVAILABILITY`, `TEST_DRIVE`, `GET_EPRICE` forms rendered as a tabbed or button-triggered modal.

---

## Public-Safe Vehicle DTO

Used in all public responses. Explicit allowlist only.

```ts
type PublicVehicleSummary = {
  slug: string;             // computed from year-make-model-trim-last6vin
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: string;        // "NEW" | "USED" | "CPO"
  mileage?: number;
  price?: number | null;    // null when hidePrice = true
  hidePrice: boolean;
  primaryPhotoUrl?: string;
  isFeatured: boolean;
  customHeadline?: string;
  bodyStyle?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
};

type PublicVehicleDetail extends PublicVehicleSummary {
  interiorColor?: string;
  engine?: string;
  vinPartial?: string;      // last 6 chars only
  photos: string[];         // up to 20 photo URLs
  customDescription?: string;
  seoTitle?: string;
  seoDescription?: string;
};
```

**Never included:** `costEntries`, `invoicePrice`, `floorplan`, `recon`, `dealershipId`, `createdAt`, `updatedAt`, `deletedAt`, `actorId`, `ownedAmount`, `packAmount`.

---

## SEO Basics

### Per-page `<head>` output

| Page | `<title>` | `<meta description>` | Canonical |
|---|---|---|---|
| Home | `{dealership.name} — {seo.defaultTitle}` | `seo.defaultDescription` | `https://{hostname}/` |
| Inventory | `Browse Inventory — {dealership.name}` | `Browse our {count} vehicles...` | `https://{hostname}/inventory` |
| VDP | `{year} {make} {model} {trim} — {dealership.name}` | `{customDescription ?? auto-generated}` | `https://{hostname}/vehicle/{slug}` |
| Contact | `Contact Us — {dealership.name}` | generic | `https://{hostname}/contact` |

### Structured Data (JSON-LD)

- VDP page: `Product` schema with vehicle name, description, image, offer price.
- Home page: `LocalBusiness` schema with dealership name, address, phone.

---

## Security Properties

| Property | Enforcement |
|---|---|
| No private data leaks | Public-safe serializer in `websites-public/serialize.ts` (explicit allowlist) |
| Unpublished site → 404 | `resolvePublishedSite` returns null; layout renders not-found |
| Unpublished vehicle → 404 | `getPublicVehicle` filters by `isPublished = true` AND `deletedAt = null` |
| No cross-tenant access | Hostname → domain → site → dealershipId is the only resolution chain |
| Rate limiting | IP-based, 5 lead submissions per 15 min |
| Anti-spam | Honeypot field check on lead forms |
| No internal UUIDs in public responses | Slugs used for vehicle routing, not IDs |
| No raw HTML injection | All text rendered as React children (auto-escaped) |
| No query-param tenant resolution | Tenant always resolved from hostname only |

---

## Development Environment

For local development with hostname resolution:
- Run `apps/websites` on port 3002.
- Set `NEXT_PUBLIC_SITE_HOSTNAME=demo.localhost` env var to bypass header-based resolution for local testing.
- Or add `127.0.0.1 demo.localhost` to `/etc/hosts` and use that hostname in the browser.
- Alternatively, the site resolver can fall back to a `WEBSITE_HOSTNAME_OVERRIDE` env var in non-production environments.

---

## Deployment Notes

- `apps/websites` is a separate Vercel project from `apps/dealer`.
- Subdomain routing (`*.dms-platform.com`) is configured via Vercel wildcard domain.
- Each subdomain resolves to the same `apps/websites` deployment.
- Hostname header identifies the tenant.
- MVP: all subdomains share one deployment. Custom domains require manual Vercel domain configuration.

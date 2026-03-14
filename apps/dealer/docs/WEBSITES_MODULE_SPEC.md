# Websites Module Spec — DMS Dealer Website Platform

**Sprint**: Websites Module MVP  
**Date**: 2026-03-13  
**Status**: Planned → implementation begins at Step 2

---

## A. Business Scope

### What this module does

The Websites module lets each dealership configure, publish, and operate a public-facing dealer website powered by DMS data. It is a formal, first-class DMS business domain.

**Capabilities in MVP:**
- Initialize a website for a dealership (one site per dealership).
- Configure branding: name, logo URL, colors, contact info, social links.
- Configure pages: enable/disable, set SEO fields (plain text), and section toggles/order (template-controlled; no raw markup).
- Manage which inventory vehicles appear publicly (opt-in per vehicle).
- Publish a versioned, immutable website release snapshot.
- Serve the published site from `apps/websites` at a subdomain.
- Render inventory list and Vehicle Detail Pages (VDP) publicly.
- Serve a public contact form, check-availability, and test-drive request forms.
- Capture form submissions as CRM-native customer and activity records.
- SEO basics: `<title>`, `<meta description>`, `<link rel="canonical">`, sitemap.xml, robots.txt.

### Ownership boundary: Platform Admin vs Dealer Owner

The boundary is explicit so that template code and technical setup stay platform-controlled while dealers control only safe configuration and content.

| **Platform Admin owns** | **Dealer Owner owns** |
|------------------------|------------------------|
| Template code | Template selection |
| Advanced layout structure | Branding (logo, colors, contact, social) |
| Custom widgets | Approved section toggles/order |
| Domain/SSL technical setup | Safe content (plain text only) |
| Provisioning (site creation, subdomain, infra) | Inventory display (publish/unpublish, featured, hide price, safe headlines) |
| | SEO (title, description) |
| | Publish (when to go live, release history, rollback) |

Dealer users **cannot** store or edit raw HTML, CSS, JavaScript, arbitrary embeds, or page/template source. All dealer-editable website fields use **schema allowlists** and **safe-content validation** (no markup/script). See `packages/contracts` website schemas and `modules/websites-core/tests/website-safe-content.test.ts`.

### Output model and future drift prevention

To keep the boundary clean over time:

- **Render text as text.** Dealer-editable strings are displayed as plain text (escaped). Do not introduce a “rich text” or WYSIWYG mode that would allow markup.
- **Do not add rich text mode later.** Any future “formatted” content must remain platform-defined (e.g. fixed templates or strict, allowlisted patterns), not dealer-authored HTML or arbitrary markup.
- **Avoid markdown unless tightly controlled.** If markdown is ever introduced, it must be a small, allowlisted subset with no raw HTML or script; prefer keeping dealer content plain text only.
- **Keep section config enums/fields explicit.** Section configuration stays allowlisted keys and primitive values (boolean, number, bounded safe string). Do not add free-form JSON or “custom section” payloads that could drift toward executable or markup content.

This keeps the output model strict and prevents boundary drift.

### What this module does NOT do in MVP

- Drag-and-drop page builder or visual editor.
- Arbitrary HTML/CSS/JS injection or raw page editing by dealers.
- Blog or news CMS.
- Automated custom DNS provisioning.
- Full marketing analytics or conversion tracking.
- A/B testing.
- Automated lender or financing integrations (placeholder form only).
- Value-my-trade integrations (placeholder form only).
- Mobile parity for the Websites admin UI.

---

## B. App Boundary

| App | Role |
|---|---|
| `apps/dealer` | Websites admin/configuration surface. All write operations, publishing, and settings management. Protected by dealer auth + RBAC. |
| `apps/websites` | Public runtime. Reads only published releases. No dealer auth. Hostname-based tenant resolution. |
| `packages/contracts` | Shared Zod schemas + TS types for website DTOs (public-safe and internal). |
| `apps/dealer/modules/websites-*` | Business logic, DB access, serializers, schemas for the Websites domain. |

**Dealer app never serves public website pages.**  
**`apps/websites` never exposes dealer-private data.**

---

## C. Data Flow

```
Dealer User
  → Websites admin UI (apps/dealer)
    → PATCH /api/websites/site, /pages, /forms, /vehicles
      → websites-core service (save draft config)

Dealer User
  → POST /api/websites/publish
    → websites-publishing service
      → assemble snapshot from: site config + pages + forms + public inventory + branding
      → write WebsitePublishRelease (immutable JSON blob)
      → update site.publishedReleaseId

Public Visitor
  → requests https://<subdomain>.dms.example.com/
    → apps/websites hostname resolver
      → fetch site by subdomain → get publishedReleaseId
      → fetch WebsitePublishRelease
      → render via premium-default template

Public Visitor
  → submits contact/lead form on public site
    → POST /api/lead (apps/websites public route)
      → websites-leads service
        → match or create Customer
        → create CustomerActivity (timeline entry)
        → optionally create CRM Opportunity
        → attribute source (website, pagePath, vehicleId, campaignParams)
```

---

## D. Draft vs Live Model

- All configuration changes are **draft-only** until published.
- Publish creates a `WebsitePublishRelease` with an immutable `configSnapshotJson` field.
- The `WebsiteSite.publishedReleaseId` points to the active live release.
- `apps/websites` reads ONLY the active published release. It never reads live `WebsiteSite` config fields directly.
- Draft state never goes live automatically.
- Only a user with `websites.write` can trigger publish.
- Multiple releases accumulate; rollback is an explicit action (set `publishedReleaseId` to a prior release ID). MVP: rollback is NOT implemented as a self-serve UI action, but the service layer is designed to support it.

---

## E. Public-Safe Boundary

Fields that must NEVER appear in public-facing responses:
- `dealershipId` (never expose internal UUIDs to anonymous public)
- Internal vehicle fields: `costEntries`, `floorplan`, `recon`, `reconLineItems`, `buyerFee`, `backendFee`, `totalCost`, `profit`, `invoicePrice`, `packAmount`, `bookValue`, `owedAmount`
- Any `deletedAt` / `deletedBy` fields
- `userId`, `actorId`, internal audit metadata
- Unpublished vehicle data (any vehicle with `VehicleWebsiteSettings.isPublished = false`)
- Unpublished site or page (`site.publishedReleaseId = null`, or page `isEnabled = false` in snapshot)

Public serializers live in `modules/websites-public/serialize.ts`. They produce explicit field allowlists, not pass-through from Prisma rows.

---

## F. Tenant Resolution Strategy

Resolution is **hostname-based only**, never query-param based.

Resolution order in `apps/websites`:
1. Read hostname from request (`x-forwarded-host` or `host` header).
2. Normalize hostname (lowercase, strip port, strip `www.` if present).
3. Query `WebsiteDomain` for matching `hostname` where `isPrimary = true` OR `hostname = subdomain.dms-platform.com`.
4. Load `WebsiteSite` via `siteId` from `WebsiteDomain`.
5. If no match → 404.
6. If `site.publishedReleaseId = null` → render "coming soon" 404 or tenant-not-found.
7. Load `WebsitePublishRelease` by `publishedReleaseId`.
8. All rendering uses the release snapshot exclusively.

MVP only supports platform-managed subdomains (`<subdomain>.dms-platform.com`). Custom domain records are stored but DNS/SSL automation is not implemented.

---

## G. Template Strategy

- Templates are **controlled React component packs**, not stored HTML blobs.
- Template keys are strings registered in a server-side registry.
- MVP provides exactly one template key: `premium-default`.
- Templates receive a validated, typed config object derived from the published release snapshot.
- No raw HTML is ever passed from DB → template. All interpolated text is rendered as React children (auto-escaped).
- Template registry lives at `apps/dealer/modules/websites-templates/registry.ts`.
- Template React components live at `apps/websites/components/templates/premium-default/`.

---

## H. Inventory Publication Strategy

- Vehicles are NOT published to the website by default. Opt-in is required.
- Each vehicle has a `VehicleWebsiteSettings` record (separate model, 1:1 with `Vehicle`).
- Settings include: `isPublished`, `isFeatured`, `hidePrice`, `customHeadline`, `customDescription`, `sortPriority`, `primaryPhotoOverrideId`.
- The publish snapshot captures only vehicles where `isPublished = true` and `vehicle.deletedAt = null` and `vehicle.status != SOLD` (unless the team decides sold vehicles should remain visible — MVP excludes them).
- Inventory website controls appear inside the existing vehicle detail/edit flow (not as a separate inventory UI).
- Vehicle data in the public snapshot uses a **public-safe vehicle serializer** that strips all cost, margin, and internal operational fields.

---

## I. CRM Lead Ingestion Strategy

Lead forms in `apps/websites` POST to `POST /api/lead` (public route within `apps/websites`).

This route calls the `websites-leads` service which:
1. Validates submission with Zod.
2. Checks rate limit (IP-based, 5 submissions per 15 minutes).
3. Anti-spam: honeypot field check, basic content heuristic.
4. Matches existing customer by phone OR email within the dealership (uses same matching logic as `customers` domain service if accessible, or inline Prisma query scoped to `dealershipId`).
5. Creates or updates `Customer` record (existing customer module rules apply: no SSN, no DOB, no raw card data).
6. Creates `CustomerActivity` timeline entry with:
   - `type: "website_lead"`
   - `source: "website"`
   - `notes` containing form type and vehicle context
   - `metadata`: `{ formType, pagePath, vehicleId?, vehicleSlug?, utm_source?, utm_medium?, utm_campaign? }`
7. Optionally creates a `CrmOpportunity` (if CRM module service is callable from websites-leads without cross-module DB access).
8. Returns `{ ok: true }` or validation error — never reveals customer ID or internal IDs to public.

Lead forms supported in MVP:
- `contact` — general contact
- `check_availability` — linked to a vehicle
- `test_drive` — linked to a vehicle
- `get_eprice` — linked to a vehicle, no price negotiation logic
- `financing` — lightweight, no lender routing
- `trade_value` — placeholder, stores lead without valuation logic

---

## J. Permission Strategy

Two new permissions added to `DEALER_PERMISSION_CATALOG`:

```ts
{ key: "websites.read",  description: "View website settings and publish history", module: "websites" }
{ key: "websites.write", description: "Edit website settings and publish website",  module: "websites" }
```

**Role assignments:**
- Owner: `websites.read`, `websites.write`
- Admin: `websites.read`, `websites.write`
- Sales: `websites.read` only
- Finance: (no websites permissions by default)
- Default system roles that match existing catalog additions in `DEFAULT_SYSTEM_ROLE_KEYS`

**Guard pattern:** All dealer API routes for websites use `guardPermission(ctx, "websites.read")` or `guardPermission(ctx, "websites.write")`.

**Public routes** in `apps/websites` have NO dealer auth guard. They are fully public. Rate limiting and anti-spam protections protect them from abuse.

---

## K. Module Structure

### Dealer app modules

```
apps/dealer/modules/
  websites-core/
    db/
      site.ts            — CRUD for WebsiteSite
      page.ts            — CRUD for WebsitePage
      form.ts            — CRUD for WebsiteLeadForm
      domain.ts          — CRUD for WebsiteDomain
      vehicle-settings.ts — CRUD for VehicleWebsiteSettings
    service/
      site.ts            — initialize site, get/update site config
      page.ts            — get/update pages
      form.ts            — get/update forms
      domain.ts          — allocate/validate subdomain
      vehicle-settings.ts — get/update vehicle website settings
    serialize.ts         — serializers for admin DTOs
    schemas.ts           — Zod schemas for API validation
    types.ts             — TS types for internal use

  websites-publishing/
    service.ts           — assemble + publish snapshot, release history
    serializer.ts        — serialize release records for admin view
    schema.ts            — validate publish request
    snapshot.ts          — snapshot assembly logic

  websites-public/
    service.ts           — resolve site, fetch public inventory, VDP
    serialize.ts         — public-safe serializers (explicit field allowlist)
    schema.ts            — validate public query params

  websites-templates/
    registry.ts          — template key → config shape mapping
    types.ts             — TemplateConfig, TemplateSectionConfig

  websites-leads/
    service.ts           — lead submission, customer match/create, activity
    schema.ts            — form submission Zod schemas

  websites-domains/
    service.ts           — subdomain allocation, host resolution
    schema.ts            — domain validation schemas

  websites-seo/
    service.ts           — SEO metadata from published release
    helpers.ts           — canonical URL, structured data, sitemap feed helpers
```

### Public app

```
apps/websites/
  app/
    page.tsx                      — home page (renders template)
    inventory/page.tsx             — inventory list page
    vehicle/[slug]/page.tsx        — VDP
    contact/page.tsx               — contact page
    api/lead/route.ts              — public lead submission endpoint
    sitemap.ts                     — sitemap.xml generation
    robots.ts                      — robots.txt generation
  components/
    templates/
      premium-default/
        layout.tsx
        home-page.tsx
        inventory-page.tsx
        vdp-page.tsx
        contact-page.tsx
        header.tsx
        footer.tsx
        sections/
          hero.tsx
          featured-inventory.tsx
          finance-cta.tsx
          dealership-info.tsx
          contact-cta.tsx
  lib/
    hostname.ts          — hostname extraction from Next.js headers
    site-resolver.ts     — load + validate published release for request
    public-api.ts        — typed fetch helpers to dealer public endpoints
```

### Shared contracts

```
packages/contracts/src/
  websites.ts           — admin-facing request/response types
  websites-public.ts    — public runtime DTOs (public-safe)
  websites-forms.ts     — lead form submission types + validation
```

---

## L. Step 2 Implementation Plan

Slice order for backend implementation:

1. Prisma models + migration (schema first, always).
2. `packages/contracts` — shared Zod types.
3. `websites-core` module — db + service + schemas + serialize.
4. `websites-publishing` module — snapshot assembly + publish service.
5. `websites-public` module — public query service + public-safe serializers.
6. `websites-templates` module — registry + types only (no React yet).
7. `websites-leads` module — lead ingestion + customer/activity creation.
8. `websites-domains` module — subdomain allocation + host resolution.
9. `websites-seo` module — SEO helpers.
10. Dealer API routes (`/api/websites/*`).
11. Permissions: add `websites.read` / `websites.write` to catalog and role templates.
12. Run `prisma generate`, `prisma migrate dev`, targeted tests.

---

## M. Confirmed Repo Patterns to Mirror

| Pattern | Source location |
|---|---|
| Module `db/*.ts` shape | `modules/vendors/db/vendor.ts` |
| Module `service/*.ts` shape | `modules/vendors/service/vendor.ts` |
| `requireTenantActiveForRead/Write` | `lib/tenant-status.ts` |
| `auditLog` | `lib/audit.ts` |
| `ApiError` | `lib/auth.ts` |
| `guardPermission` | `lib/api/handler.ts` |
| `listPayload` | `lib/api/list-response.ts` |
| `validationErrorResponse` | `lib/api/validate.ts` |
| Route shape | `app/api/vendors/route.ts` |
| Zod schemas | `modules/vendors/schemas.ts` |
| Serializers | `modules/vendors/serialize.ts` |
| Permissions catalog | `lib/constants/permissions.ts` |
| Contracts Zod style | `packages/contracts/src/platform/dealerships.ts` |
| Prisma model shape | `apps/dealer/prisma/schema.prisma` (see `Vehicle`, `Customer`, etc.) |

---

## N. Risks and Honest Gaps

| Risk | Mitigation |
|---|---|
| `apps/websites` is a new Next.js app that must be wired into vercel.json/workspace | Document in Step 2 setup; may need vercel rewrites. |
| Subdomain routing in development requires local DNS override or Next.js hostname middleware. | `apps/websites` reads hostname; local dev uses `HOST` env override. |
| Cross-module call: `websites-leads` needs customer match/create. | Use `customers` module service directly (service-to-service is allowed). |
| JSON snapshot can become large if many vehicles. | Snapshot captures only `isPublished=true` vehicles up to 100 at publish time; paginated public query is secondary path. |
| Template config shape validation at publish time. | `snapshot.ts` validates config against template registry schema before writing. |
| Custom domain DNS/SSL for MVP. | Stored in DB but NOT automated. Manual status updates only. |

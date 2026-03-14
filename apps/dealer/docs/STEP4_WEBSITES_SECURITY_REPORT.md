# Step 4 — Websites Module Security Report

Date: 2026-03-14
Sprint: Websites Module / Dealer Website Platform — STEP 4: Security & QA

---

## 1. Public Tenant Resolution Model

### Problem Identified

Prior to Step 4, the public inventory and vehicle detail routes accepted `dealershipId` directly from the client as a query parameter:

```
GET /api/public/websites/inventory?dealershipId=<uuid>
GET /api/public/websites/vehicle/[slug]?dealershipId=<uuid>
```

This is unsafe because:
- Any party that knows a dealership UUID can enumerate published inventory across tenants
- The browser controls which tenant is selected — violating the principle that tenant resolution must be server-authoritative
- `dealershipId` UUIDs are predictable via the resolve endpoint

### Fix Applied

All public routes now resolve tenant from **hostname only**:

```
GET /api/public/websites/inventory?hostname=acme.dms-platform.com
GET /api/public/websites/vehicle/[slug]?hostname=acme.dms-platform.com
GET /api/public/websites/resolve?hostname=acme.dms-platform.com
POST /api/public/websites/lead  (hostname injected server-side by apps/websites proxy)
```

Resolution chain:
```
hostname → WebsiteDomain (DB lookup) → WebsiteSite → dealershipId (server-only)
```

This chain is enforced in `apps/dealer/modules/websites-domains/service.ts#resolveSiteByHostname`.

### Lead Form Tenant Flow

The `apps/websites/app/api/lead/route.ts` proxy:
1. Receives form data from browser (no `dealershipId` in payload)
2. Resolves `hostname` from the incoming request headers (server-side)
3. Strips any client-supplied `dealershipId` or `siteId` from the payload
4. Injects the server-resolved `hostname` into the forwarded request
5. The dealer API then resolves `hostname → site → dealershipId` internally

The browser **never** controls tenant selection.

---

## 2. Snapshot / Live Model

### Source of Truth

The publish flow is:
1. `POST /api/websites/publish` (authenticated, `websites.write`)
2. `assembleSnapshot(dealershipId, siteId)` builds an immutable `PublishSnapshot` from current DB state
3. A `WebsitePublishRelease` record is created with the snapshot stored as `configSnapshotJson` (JSON column)
4. `WebsiteSite.publishedReleaseId` is updated to point to the new release

**All operations are in a single Prisma `$transaction`** — a crash between snapshot creation and site pointer update cannot leave the site in an inconsistent state. This was fixed in Step 4 (previously two separate DB operations).

### Draft vs Live

- Draft changes (theme, contact, social, page config) update `WebsiteSite.*ConfigJson` columns
- These changes are **never visible to the public runtime** until a new publish is triggered
- `resolveSiteByHostname` requires `site.publishedReleaseId IS NOT NULL` — unpublished sites fail closed
- The public runtime reads only `WebsitePublishRelease.configSnapshotJson` (immutable snapshot)

### Rollback

Rollback to a prior release is **not yet implemented** (listed as future work). The release history is queryable via `/api/websites/publish/releases`.

---

## 3. Private/Public Boundary

| Boundary | Enforcement |
|---|---|
| Private dealer routes (`/api/websites/*`) | `getAuthContext` + `guardPermission` + `ctx.dealershipId` from session |
| Public routes (`/api/public/websites/*`) | No auth; tenant resolved from hostname only |
| Lead proxy (`apps/websites/app/api/lead`) | Strips client tenant ids; injects server hostname |
| Public serializers | Explicit allowlist — no internal UUIDs, cost/margin, or sensitive fields |

---

## 4. RBAC Enforcement

All private dealer website routes require:
- `websites.read` for GET operations
- `websites.write` for POST/PATCH/DELETE operations

Enforcement verified in:
- `apps/dealer/app/api/websites/site/route.ts`
- `apps/dealer/app/api/websites/publish/route.ts`
- `apps/dealer/app/api/websites/pages/[id]/route.ts`
- `apps/dealer/app/api/websites/domains/route.ts`

`guardPermission(ctx, "websites.read/write")` is called on every route before any service call. The `ctx.dealershipId` is always session-derived, never from request body/query.

Nav gating: The "Website" group in `navigation.config.ts` requires `permissions: ["websites.read"]`.

---

## 5. Tenant Isolation Verification

All private service calls:
- Take `dealershipId` from `ctx.dealershipId` (session, never client input)
- Pass to service → DB layer which always includes `WHERE dealershipId = ?`
- Cross-tenant lookups return `NOT_FOUND` (404) via the `ApiError` mechanism

Public service calls:
- Resolved dealershipId comes from DB lookup (hostname → site), not from the request
- `listPublicVehicles` and `getPublicVehicleBySlug` receive dealershipId from the route's hostname resolution, not from query params

---

## 6. Lead Abuse Protection

| Layer | Protection |
|---|---|
| Schema | `_hp: z.string().max(0)` — rejects any non-empty honeypot at parse time |
| Rate limit | `website_lead` type: 5 submissions per minute per IP (in-memory store) |
| Zod validation | Full form validation before any DB access; formType must be a known enum value |
| Tenant safety | Hostname-resolved tenant; no client dealershipId accepted |
| PII | No PII logged in audit metadata; only `formType`, `pagePath`, `vehicleSlug`, UTM data |
| Bot defense | Honeypot is schema-enforced (strict max(0)), not just service-layer ignored |

Known gap: Rate limit store is in-memory (per-process). Production deployments with multiple processes/replicas should upgrade to Redis-backed rate limiting for true global enforcement.

---

## 7. Input/Output Safety

### XSS Risk

- No `dangerouslySetInnerHTML` in `apps/websites` templates (verified via `rg dangerouslySetInnerHTML`)
- All configurable text rendered as React text nodes (automatic escaping)
- SEO metadata (`<title>`, `<meta description>`) rendered via Next.js `generateMetadata` — values are string-typed and HTML-escaped by the framework

### Serializer Safety

- `serializePublicVehicleSummary` and `serializePublicVehicleDetail` use explicit field allowlists
- No internal UUIDs (`id`, `dealershipId`, `vehicleId`) in public DTOs
- No `purchasePriceCents` or cost data exposed
- Full VIN never exposed — only `vinPartial` (last 6 chars)
- Photo references are `fileObjectId` strings only (not signed URLs — resolved client-side via `/api/photo/[id]`)
- Photos capped at 20 per vehicle

### Slug Safety

- Slug generated from `year-make-model-trim-{vin-last-6}` using `[^a-z0-9]` → `-` replacement
- Slug is URL-safe (no spaces or special chars)
- VIN prefix not included — only last 6 chars (privacy-safe)

### Hostname Normalization

`resolveSiteByHostname` normalizes:
- Lowercases
- Strips port (`:3001`)
- Strips trailing dots
- Strips `www.` prefix

---

## 8. Known Remaining Gaps

| Gap | Severity | Status |
|---|---|---|
| In-memory rate limiter (not Redis-backed) | Medium | Noted. Acceptable for MVP; Redis upgrade path exists in `rateLimit.ts` |
| Release rollback not implemented | Low | Future work, documented |
| Custom DNS/SSL automation not implemented | Low | Out of scope for MVP |
| `website_lead` rate limit window is per-process | Medium | Acceptable for MVP; Redis upgrade resolves |
| Lead form: no CAPTCHA (honeypot + rate limit only) | Medium | Accepted for MVP |
| Sitemap includes all published vehicles (no per-page visibility) | Low | Acceptable |

---

## 9. Files Modified in Step 4

### Hardening Fixes

- `apps/dealer/app/api/public/websites/inventory/route.ts` — rewritten to use `hostname` param
- `apps/dealer/app/api/public/websites/vehicle/[slug]/route.ts` — rewritten to use `hostname` param
- `apps/dealer/app/api/public/websites/lead/route.ts` — added rate limiting + hostname resolution
- `apps/dealer/lib/api/rate-limit.ts` — added `website_lead` rate limit type (5/min per IP)
- `apps/dealer/modules/websites-domains/service.ts` — hardened hostname normalization (trailing dots)
- `apps/dealer/modules/websites-publishing/service.ts` — made publish atomic (single `$transaction`)
- `apps/websites/app/api/lead/route.ts` — strips client tenant ids, injects server hostname
- `apps/websites/app/inventory/page.tsx` — passes `hostname` instead of `dealershipId`
- `apps/websites/app/vehicle/[slug]/page.tsx` — passes `hostname` instead of `dealershipId`
- `apps/websites/app/sitemap.ts` — passes `hostname` instead of `dealershipId`
- `apps/websites/templates/premium-default/LeadForm.tsx` — removed `dealershipId` prop
- `apps/websites/app/contact/page.tsx` — removed `dealershipId` prop from `LeadForm`

### Tests Added

- `apps/dealer/modules/websites-public/tests/serialize.test.ts` (24 tests)
- `apps/dealer/modules/websites-public/tests/public-boundary.test.ts` (6 tests, 4 skipped without DB)
- `apps/dealer/modules/websites-leads/tests/lead-abuse.test.ts` (11 tests)
- `apps/dealer/modules/websites-core/tests/hostname-normalization.test.ts` (12 tests)

### Canonical Docs Updated

- `docs/canonical/MODULE_REGISTRY_CANONICAL.md` — websites modules status updated to Implemented
- `docs/canonical/API_SURFACE_CANONICAL.md` — websites public and private routes documented
- `docs/canonical/KNOWN_GAPS_AND_FUTURE_WORK.md` — §15 rewritten to reflect completed state
- `docs/canonical/PROJECT_STATUS_CANONICAL.md` — `apps/websites` marked Implemented, estimate raised to 82%

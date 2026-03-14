# Websites Publishing Model — DMS Dealer Website Platform

**Sprint**: Websites Module MVP  
**Date**: 2026-03-13  
**Status**: Planned

---

## Overview

The publishing model is the boundary between **draft configuration** (mutable, dealer-edited) and **live public state** (immutable, served to the public). The public website reads ONLY published releases. Draft state never goes live automatically.

---

## State Machine

```
NEW DEALERSHIP
     │
     ▼
WebsiteSite (status: DRAFT, publishedReleaseId: null)
     │
     │  [Dealer configures branding, pages, forms, vehicles]
     │
     ▼
WebsiteSite (status: DRAFT, publishedReleaseId: null) ← still draft
     │
     │  [POST /api/websites/publish]
     │
     ▼
WebsitePublishRelease (versionNumber: 1, configSnapshotJson: {...})
     │
     ├─ WebsiteSite.publishedReleaseId → this release
     ├─ WebsiteSite.status → LIVE
     │
     ▼
Public site is now live at subdomain

     │
     │  [Dealer edits branding, pages, forms, vehicles — draft again]
     │  [publishedReleaseId still points to v1 — site stays live at v1]
     │
     │  [POST /api/websites/publish]
     │
     ▼
WebsitePublishRelease (versionNumber: 2, configSnapshotJson: {...})
     │
     ├─ WebsiteSite.publishedReleaseId → v2
     │  (v1 record remains in DB, not deleted)
     │
     ▼
Public site now serves v2
```

---

## Snapshot Assembly

The snapshot is assembled by `modules/websites-publishing/snapshot.ts`.

### Inputs to snapshot assembly

| Source | What is captured |
|---|---|
| `WebsiteSite` | name, subdomain, templateKey, themeConfigJson, contactConfigJson, socialConfigJson |
| `WebsitePage[]` | all pages where `isEnabled = true`, ordered by `sortOrder` |
| `WebsiteLeadForm[]` | all forms where `isEnabled = true` |
| `Dealership` | public fields: displayName, phone, address, city, state, zip |
| `VehicleWebsiteSettings` (+ `Vehicle` join) | vehicles where `isPublished = true`, `vehicle.deletedAt = null` |
| `WebsiteDomain` (primary) | primary hostname for canonical URL generation |
| Template registry | validates `activeTemplateKey` is a known registered key |

### Snapshot assembly steps

```ts
async function assembleSnapshot(dealershipId: string, siteId: string): Promise<PublishSnapshot> {
  // 1. Load site with all relations
  const site = await loadSiteForPublish(dealershipId, siteId);

  // 2. Validate template key is registered
  validateTemplateKey(site.activeTemplateKey);

  // 3. Load and validate JSON config blocks
  const theme    = parseThemeConfig(site.themeConfigJson);
  const contact  = parseContactConfig(site.contactConfigJson);
  const social   = parseSocialConfig(site.socialConfigJson);

  // 4. Load enabled pages (ordered)
  const pages    = await loadEnabledPages(siteId);

  // 5. Load enabled forms
  const forms    = await loadEnabledForms(siteId);

  // 6. Load public dealership info
  const dealer   = await loadPublicDealershipInfo(dealershipId);

  // 7. Load published vehicles (isPublished=true, not deleted, limit 100 at publish time)
  const vehicles = await loadPublishedVehicles(dealershipId);
  const featuredVehicleIds = vehicles
    .filter(v => v.isFeatured)
    .slice(0, 6)
    .map(v => vehicleToSlug(v));

  // 8. Assemble SEO defaults
  const seo = buildSeoDefaults(dealer, site);

  // 9. Return typed snapshot
  return {
    version:          nextVersionNumber,
    publishedAt:      new Date().toISOString(),
    templateKey:      site.activeTemplateKey,
    dealership:       dealer,
    theme,
    social,
    pages:            pages.map(serializePageForSnapshot),
    forms:            forms.map(serializeFormForSnapshot),
    inventory: {
      featuredVehicleIds,
      vehicleCount:   vehicles.length,
    },
    seo,
  };
}
```

### What the snapshot does NOT embed

- Full vehicle data (too large, can go stale). VDP queries use live public reads filtered by `isPublished = true`.
- Photo binary data — only photo URLs are referenced.
- Internal UUIDs for vehicles — slugs only in `featuredVehicleIds`.
- Draft config changes made after the last publish.

---

## Publish Action

### Route

`POST /api/websites/publish`

### Handler flow

```
getAuthContext(request)
  → guardPermission(ctx, "websites.write")
  → requireTenantActiveForWrite(ctx.dealershipId)
  → validate body (optional: publishNote)
  → websites-publishing service:
    → load site, validate site exists and belongs to dealership
    → assemble snapshot
    → compute next versionNumber (MAX(versionNumber) + 1 or 1)
    → prisma.$transaction:
        → create WebsitePublishRelease
        → update WebsiteSite.publishedReleaseId = new release id
        → update WebsiteSite.status = LIVE
    → auditLog (website.published, entity: WebsiteSite, entityId: siteId)
  → return { release: serialized release }
```

### Atomicity

The `WebsitePublishRelease` creation and `WebsiteSite.publishedReleaseId` update are wrapped in a `prisma.$transaction()`. If either step fails, neither is committed. The previous live release (if any) continues to serve the public site.

---

## Preview

`POST /api/websites/preview`

Preview generates the same snapshot but does NOT:
- Create a `WebsitePublishRelease` record.
- Update `WebsiteSite.publishedReleaseId`.
- Audit log a publish action.

Returns the assembled snapshot as JSON for the dealer to inspect. The dealer app can render a preview of what the site will look like after publish. The public `apps/websites` does NOT have a preview mode.

---

## Release History

`GET /api/websites/publish/releases`

Returns a paginated list of `WebsitePublishRelease` records for the current site:

```ts
{
  id: string;
  versionNumber: number;
  publishedAt: string;
  publishedByUserId: string;
  isActive: boolean;  // true when id === site.publishedReleaseId
}
```

Does not return `configSnapshotJson` in the list view (too large). Detail view (`GET /api/websites/publish/releases/[id]`) returns full snapshot for debugging.

---

## Rollback

MVP: Not exposed as a UI action. The service layer supports it by updating `WebsiteSite.publishedReleaseId` to a prior release ID. A future sprint can expose this as a one-click rollback button in the Publish history panel.

Service method exists but is not wired to an API route in MVP:
```ts
async function rollbackToRelease(dealershipId: string, siteId: string, releaseId: string, userId: string): Promise<void>
```

---

## Cache Invalidation

When a new release is published:
1. The dealer app caches nothing — all dealer admin routes are `force-dynamic`.
2. `apps/websites` uses short-TTL caching (60s) on site resolution. A new publish will be reflected within 60 seconds without explicit cache busting.
3. For a faster cutover, a future improvement would be to call a cache-tag revalidation endpoint in `apps/websites` after publish.

---

## Publish Safety Rules

Validated by the service before writing:

1. Site must exist and belong to `ctx.dealershipId`.
2. Tenant must be ACTIVE (not SUSPENDED/CLOSED).
3. Template key must be registered in `websites-templates/registry.ts`.
4. Site must have at least one enabled page (HOME at minimum).
5. Primary domain must be allocated.
6. Snapshot must parse successfully against the PublishSnapshot Zod schema.

If any validation fails → throw `ApiError("VALIDATION_ERROR", ...)` with descriptive message. No partial write.

---

## Audit Requirements

Every publish action is audited via `auditLog`:

```ts
await auditLog({
  dealershipId: ctx.dealershipId,
  actorUserId:  ctx.userId,
  action:       "website.published",
  entity:       "WebsiteSite",
  entityId:     siteId,
  metadata: {
    siteId,
    versionNumber: release.versionNumber,
    releaseId: release.id,
    templateKey: site.activeTemplateKey,
    vehicleCount: snapshot.inventory.vehicleCount,
  },
  ip:        meta?.ip,
  userAgent: meta?.userAgent,
});
```

Metadata must NOT include: user emails, phone numbers, PII fields, or raw snapshot JSON.

---

## Version Numbering

- `versionNumber` starts at 1 for each site.
- Computed at publish time: `SELECT MAX(version_number) FROM website_publish_releases WHERE site_id = $siteId` + 1.
- Wrapped in transaction to avoid race conditions if two publishes happen simultaneously (last-writer-wins on the `publishedReleaseId` update, both releases are valid records).
- MVP does not enforce strict sequential consistency beyond the transaction.

---

## Template Validation at Publish

Before writing the snapshot, `snapshot.ts` calls:

```ts
import { templateRegistry } from "@/modules/websites-templates/registry";

const template = templateRegistry.get(site.activeTemplateKey);
if (!template) {
  throw new ApiError("VALIDATION_ERROR", `Unknown template key: ${site.activeTemplateKey}`);
}
// Optionally: validate sectionsConfigJson against template.sectionSchema
template.validateSnapshot(snapshot);
```

This ensures that the snapshot will be renderable by the registered template. Prevents publishing a snapshot with an invalid or missing template.

---

## Public Site Serving Model

```
apps/websites receives request
  │
  ├─ resolveHostname() → "demo.dms-platform.com"
  ├─ resolvePublishedSite("demo.dms-platform.com")
  │    → WebsiteDomain lookup → siteId
  │    → WebsiteSite lookup → publishedReleaseId
  │    → WebsitePublishRelease load → configSnapshotJson
  │    → parse + validate → PublishedSiteContext
  │
  ├─ IF null → render not-found
  │
  └─ render with template using snapshot config
       ↑
       All page data derives from this snapshot.
       No direct access to WebsiteSite draft fields.
```

**For live inventory queries** (inventory list, VDP):
- `apps/websites` calls `websites-public` service methods (monorepo-internal in MVP, or via dealer public API in production deployment).
- These methods apply: `isPublished = true`, `deletedAt = null`, `siteId` scope.
- They use public-safe serializers — never raw Prisma rows.

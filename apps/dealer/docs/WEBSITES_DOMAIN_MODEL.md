# Websites Domain Model — DMS Dealer Website Platform

**Sprint**: Websites Module MVP  
**Date**: 2026-03-13  
**Status**: Planned

---

## Overview

All Websites models live in `apps/dealer/prisma/schema.prisma` alongside existing dealer domain models.

All models share the standard dealer schema conventions:
- `id String @id @default(uuid()) @db.Uuid`
- `dealershipId String @db.Uuid` (tenant key, always present on root models)
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- `deletedAt DateTime?` (soft delete on appropriate models)
- `deletedBy String?`
- Column names: camelCase fields mapped with `@map("snake_case")` for the DB column
- All UUIDs via `@db.Uuid`

---

## Enums

```prisma
enum WebsiteSiteStatus {
  DRAFT          // No published release yet
  LIVE           // Has an active published release
  PAUSED         // Has releases but site is taken offline by owner
}

enum WebsitePageType {
  HOME
  INVENTORY
  VDP
  CONTACT
  CUSTOM
}

enum WebsiteDomainVerificationStatus {
  PENDING
  VERIFIED
  FAILED
}

enum WebsiteDomainSslStatus {
  PENDING
  PROVISIONED
  FAILED
  NOT_APPLICABLE
}

enum WebsiteLeadFormType {
  CONTACT
  CHECK_AVAILABILITY
  TEST_DRIVE
  GET_EPRICE
  FINANCING
  TRADE_VALUE
}
```

---

## Models

### WebsiteSite

One per dealership. Root entity for all website configuration.

```prisma
model WebsiteSite {
  id                    String             @id @default(uuid()) @db.Uuid
  dealershipId          String             @db.Uuid @map("dealership_id")
  name                  String             @db.VarChar(200)
  status                WebsiteSiteStatus  @default(DRAFT)
  subdomain             String             @db.VarChar(63)
  activeTemplateKey     String             @default("premium-default") @db.VarChar(100) @map("active_template_key")

  // Active published release (nullable until first publish)
  publishedReleaseId    String?            @db.Uuid @map("published_release_id")

  // Draft configuration (JSON) — validated at service boundary, never raw
  themeConfigJson       Json?              @map("theme_config_json")     // colors, logo, fonts
  contactConfigJson     Json?              @map("contact_config_json")   // phone, address, hours
  socialConfigJson      Json?              @map("social_config_json")    // facebook, instagram, etc.

  createdAt             DateTime           @default(now()) @map("created_at")
  updatedAt             DateTime           @updatedAt @map("updated_at")
  deletedAt             DateTime?          @map("deleted_at")
  deletedBy             String?            @map("deleted_by")

  // Relations
  dealership            Dealership         @relation(fields: [dealershipId], references: [id])
  publishedRelease      WebsitePublishRelease? @relation("ActiveRelease", fields: [publishedReleaseId], references: [id])
  pages                 WebsitePage[]
  domains               WebsiteDomain[]
  releases              WebsitePublishRelease[] @relation("SiteReleases")
  forms                 WebsiteLeadForm[]

  @@unique([dealershipId], name: "one_site_per_dealership")
  @@unique([subdomain], name: "unique_subdomain")
  @@index([dealershipId])
  @@index([subdomain])
  @@map("website_sites")
}
```

**Notes:**
- One site per dealership enforced by `@@unique([dealershipId])`.
- Subdomain is globally unique across all tenants.
- `themeConfigJson`, `contactConfigJson`, `socialConfigJson` are draft state only. Published state lives in the snapshot.
- Validated by typed Zod schemas at service boundary (never stored raw from client JSON).

---

### WebsitePage

Configuration for individual pages on the site.

```prisma
model WebsitePage {
  id              String           @id @default(uuid()) @db.Uuid
  siteId          String           @db.Uuid @map("site_id")
  dealershipId    String           @db.Uuid @map("dealership_id")  // denormalized for tenant query scoping
  pageType        WebsitePageType
  title           String           @db.VarChar(200)
  slug            String           @db.VarChar(200)
  isEnabled       Boolean          @default(true) @map("is_enabled")

  // SEO
  seoTitle        String?          @db.VarChar(200) @map("seo_title")
  seoDescription  String?          @db.VarChar(500) @map("seo_description")

  // Layout / sections config (draft state only)
  layoutConfigJson   Json?         @map("layout_config_json")
  sectionsConfigJson Json?         @map("sections_config_json")

  sortOrder       Int              @default(0) @map("sort_order")

  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  // Relations
  site            WebsiteSite      @relation(fields: [siteId], references: [id])

  @@unique([siteId, pageType], name: "unique_page_type_per_site")
  @@unique([siteId, slug], name: "unique_slug_per_site")
  @@index([siteId])
  @@index([dealershipId])
  @@map("website_pages")
}
```

**Notes:**
- Pages are seeded with defaults on site initialization (HOME, INVENTORY, VDP, CONTACT).
- `CUSTOM` page type is reserved for future use; MVP seeder does not create custom pages.
- `slug` for HOME is always `""` (empty, maps to `/`).
- Pages with `isEnabled = false` are omitted from the published snapshot.

---

### WebsiteDomain

Hostnames associated with a site. One primary subdomain plus optional custom domains.

```prisma
model WebsiteDomain {
  id                  String                           @id @default(uuid()) @db.Uuid
  siteId              String                           @db.Uuid @map("site_id")
  dealershipId        String                           @db.Uuid @map("dealership_id")
  hostname            String                           @db.VarChar(253)
  isPrimary           Boolean                          @default(false) @map("is_primary")
  isSubdomain         Boolean                          @default(true) @map("is_subdomain")  // true = platform-managed
  verificationStatus  WebsiteDomainVerificationStatus @default(PENDING) @map("verification_status")
  sslStatus           WebsiteDomainSslStatus          @default(PENDING) @map("ssl_status")

  createdAt           DateTime                         @default(now()) @map("created_at")
  updatedAt           DateTime                         @updatedAt @map("updated_at")

  // Relations
  site                WebsiteSite                      @relation(fields: [siteId], references: [id])

  @@unique([hostname], name: "unique_hostname_globally")
  @@index([siteId])
  @@index([dealershipId])
  @@index([hostname])
  @@map("website_domains")
}
```

**Notes:**
- The platform subdomain (`<subdomain>.dms-platform.com`) is always `verificationStatus = VERIFIED`, `sslStatus = PROVISIONED` when allocated.
- Custom domains start as `PENDING` and must be manually verified in MVP.
- Hostname is globally unique — prevents cross-tenant hostname conflicts.
- `isPrimary` — only one primary domain per site; enforced at service layer (not DB unique, to allow transitions).

---

### WebsitePublishRelease

Immutable versioned snapshot of a site configuration at publish time.

```prisma
model WebsitePublishRelease {
  id                  String      @id @default(uuid()) @db.Uuid
  siteId              String      @db.Uuid @map("site_id")
  dealershipId        String      @db.Uuid @map("dealership_id")
  versionNumber       Int         @map("version_number")

  // Immutable snapshot — written once at publish, never updated
  configSnapshotJson  Json        @map("config_snapshot_json")

  publishedAt         DateTime    @map("published_at")
  publishedByUserId   String      @db.Uuid @map("published_by_user_id")

  createdAt           DateTime    @default(now()) @map("created_at")
  // No updatedAt — this record is immutable after creation

  // Relations
  site                WebsiteSite @relation("SiteReleases", fields: [siteId], references: [id])
  activeSites         WebsiteSite[] @relation("ActiveRelease")

  @@unique([siteId, versionNumber], name: "unique_version_per_site")
  @@index([siteId])
  @@index([dealershipId])
  @@map("website_publish_releases")
}
```

**configSnapshotJson structure (TypeScript shape for reference):**
```ts
type PublishSnapshot = {
  version: number;
  publishedAt: string;           // ISO string
  templateKey: string;           // e.g. "premium-default"
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
    headerBgColor?: string;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  pages: Array<{
    pageType: string;
    title: string;
    slug: string;
    isEnabled: boolean;
    seoTitle?: string;
    seoDescription?: string;
    sections: unknown[];   // template-specific section config
  }>;
  forms: Array<{
    formType: string;
    isEnabled: boolean;
    routingConfig?: unknown;
  }>;
  inventory: {
    featuredVehicleIds: string[];    // vehicle slugs, NOT internal UUIDs
    vehicleCount: number;
  };
  seo: {
    defaultTitle?: string;
    defaultDescription?: string;
    canonicalBase?: string;
  };
};
```

**Notes:**
- `configSnapshotJson` is the ONLY data source for `apps/websites`. It never reads live `WebsiteSite` config.
- Snapshot does NOT embed full vehicle data — too large and staleable. VDP pages perform live queries against `VehicleWebsiteSettings` + `Vehicle` (still public-safe + published filter only).
- `versionNumber` auto-increments per site: `max(versionNumber) + 1`.

---

### WebsiteLeadForm

Per-form configuration controlling which forms are enabled and any routing options.

```prisma
model WebsiteLeadForm {
  id                String              @id @default(uuid()) @db.Uuid
  siteId            String              @db.Uuid @map("site_id")
  dealershipId      String              @db.Uuid @map("dealership_id")
  formType          WebsiteLeadFormType
  isEnabled         Boolean             @default(true) @map("is_enabled")
  routingConfigJson Json?               @map("routing_config_json")  // future: routing to specific users/queues

  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  // Relations
  site              WebsiteSite         @relation(fields: [siteId], references: [id])

  @@unique([siteId, formType], name: "unique_form_type_per_site")
  @@index([siteId])
  @@index([dealershipId])
  @@map("website_lead_forms")
}
```

**Notes:**
- One record per form type per site.
- Seeded on site initialization with all MVP form types enabled by default.

---

### VehicleWebsiteSettings

Per-vehicle public website publication controls. 1:1 with `Vehicle`, created on demand.

```prisma
model VehicleWebsiteSettings {
  id                      String    @id @default(uuid()) @db.Uuid
  dealershipId            String    @db.Uuid @map("dealership_id")
  vehicleId               String    @db.Uuid @map("vehicle_id")

  isPublished             Boolean   @default(false) @map("is_published")
  isFeatured              Boolean   @default(false) @map("is_featured")
  hidePrice               Boolean   @default(false) @map("hide_price")
  customHeadline          String?   @db.VarChar(200) @map("custom_headline")
  customDescription       String?   @db.VarChar(1000) @map("custom_description")
  sortPriority            Int       @default(0) @map("sort_priority")
  primaryPhotoOverrideId  String?   @db.Uuid @map("primary_photo_override_id")

  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  // Relations
  vehicle                 Vehicle   @relation(fields: [vehicleId], references: [id])
  dealership              Dealership @relation(fields: [dealershipId], references: [id])

  @@unique([vehicleId], name: "unique_settings_per_vehicle")
  @@index([dealershipId])
  @@index([dealershipId, isPublished])
  @@index([vehicleId])
  @@map("vehicle_website_settings")
}
```

**Notes:**
- Created with `isPublished = false` when first accessed/updated for a vehicle.
- `primaryPhotoOverrideId` references a `VehiclePhoto.id` — no separate asset model needed for MVP.
- The composite index on `[dealershipId, isPublished]` supports efficient public inventory queries.
- No `deletedAt` — vehicle soft-delete on the `Vehicle` model is the source of truth for existence.

---

## Dealership Model Additions

Add relations to `Dealership`:
```prisma
// In Dealership model
websiteSites        WebsiteSite[]
vehicleWebsiteSettings VehicleWebsiteSettings[]
```

## Vehicle Model Additions

Add relation to `Vehicle`:
```prisma
// In Vehicle model
websiteSettings     VehicleWebsiteSettings?
```

---

## Index Strategy Summary

| Model | Key Indexes |
|---|---|
| WebsiteSite | `[dealershipId]`, `[subdomain]`, unique `[dealershipId]`, unique `[subdomain]` |
| WebsitePage | `[siteId]`, `[dealershipId]`, unique `[siteId, pageType]`, unique `[siteId, slug]` |
| WebsiteDomain | `[siteId]`, `[dealershipId]`, `[hostname]`, unique `[hostname]` |
| WebsitePublishRelease | `[siteId]`, `[dealershipId]`, unique `[siteId, versionNumber]` |
| WebsiteLeadForm | `[siteId]`, `[dealershipId]`, unique `[siteId, formType]` |
| VehicleWebsiteSettings | `[dealershipId]`, `[vehicleId]`, `[dealershipId, isPublished]`, unique `[vehicleId]` |

---

## Migration Notes

- Migration file: `apps/dealer/prisma/migrations/<timestamp>_add_websites_module/migration.sql`
- Use `prisma migrate dev --name add_websites_module` during development.
- All `CREATE TABLE` + `CREATE INDEX` in a single migration file.
- The new models reference existing `Dealership` and `Vehicle` models — no circular dependencies.
- `VehicleWebsiteSettings` relation to `Vehicle` requires the `Vehicle` model to declare `websiteSettings VehicleWebsiteSettings?`.

-- Migration: Add Websites Module
-- Sprint: Websites MVP
-- Date: 2026-03-13

-- Enums
CREATE TYPE "WebsiteSiteStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED');
CREATE TYPE "WebsitePageType" AS ENUM ('HOME', 'INVENTORY', 'VDP', 'CONTACT', 'CUSTOM');
CREATE TYPE "WebsiteDomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "WebsiteDomainSslStatus" AS ENUM ('PENDING', 'PROVISIONED', 'FAILED', 'NOT_APPLICABLE');
CREATE TYPE "WebsiteLeadFormType" AS ENUM ('CONTACT', 'CHECK_AVAILABILITY', 'TEST_DRIVE', 'GET_EPRICE', 'FINANCING', 'TRADE_VALUE');

-- WebsiteSite
CREATE TABLE "website_sites" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealership_id"        UUID NOT NULL,
    "name"                 VARCHAR(200) NOT NULL,
    "status"               "WebsiteSiteStatus" NOT NULL DEFAULT 'DRAFT',
    "subdomain"            VARCHAR(63) NOT NULL,
    "active_template_key"  VARCHAR(100) NOT NULL DEFAULT 'premium-default',
    "published_release_id" UUID,
    "theme_config_json"    JSONB,
    "contact_config_json"  JSONB,
    "social_config_json"   JSONB,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,
    "deleted_at"           TIMESTAMP(3),
    "deleted_by"           TEXT,

    CONSTRAINT "website_sites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "one_site_per_dealership" ON "website_sites"("dealership_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "unique_subdomain" ON "website_sites"("subdomain");
CREATE INDEX "website_sites_dealership_id_idx" ON "website_sites"("dealership_id");
CREATE INDEX "website_sites_subdomain_idx" ON "website_sites"("subdomain");

-- WebsitePage
CREATE TABLE "website_pages" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "site_id"              UUID NOT NULL,
    "dealership_id"        UUID NOT NULL,
    "pageType"             "WebsitePageType" NOT NULL,
    "title"                VARCHAR(200) NOT NULL,
    "slug"                 VARCHAR(200) NOT NULL,
    "is_enabled"           BOOLEAN NOT NULL DEFAULT true,
    "seo_title"            VARCHAR(200),
    "seo_description"      VARCHAR(500),
    "layout_config_json"   JSONB,
    "sections_config_json" JSONB,
    "sort_order"           INTEGER NOT NULL DEFAULT 0,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_page_type_per_site" ON "website_pages"("site_id", "pageType");
CREATE UNIQUE INDEX "unique_slug_per_site" ON "website_pages"("site_id", "slug");
CREATE INDEX "website_pages_site_id_idx" ON "website_pages"("site_id");
CREATE INDEX "website_pages_dealership_id_idx" ON "website_pages"("dealership_id");

-- WebsiteDomain
CREATE TABLE "website_domains" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "site_id"              UUID NOT NULL,
    "dealership_id"        UUID NOT NULL,
    "hostname"             VARCHAR(253) NOT NULL,
    "is_primary"           BOOLEAN NOT NULL DEFAULT false,
    "is_subdomain"         BOOLEAN NOT NULL DEFAULT true,
    "verification_status"  "WebsiteDomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "ssl_status"           "WebsiteDomainSslStatus" NOT NULL DEFAULT 'PENDING',
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_hostname_globally" ON "website_domains"("hostname");
CREATE INDEX "website_domains_site_id_idx" ON "website_domains"("site_id");
CREATE INDEX "website_domains_dealership_id_idx" ON "website_domains"("dealership_id");
CREATE INDEX "website_domains_hostname_idx" ON "website_domains"("hostname");

-- WebsitePublishRelease
CREATE TABLE "website_publish_releases" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "site_id"              UUID NOT NULL,
    "dealership_id"        UUID NOT NULL,
    "version_number"       INTEGER NOT NULL,
    "config_snapshot_json" JSONB NOT NULL,
    "published_at"         TIMESTAMP(3) NOT NULL,
    "published_by_user_id" UUID NOT NULL,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_publish_releases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_version_per_site" ON "website_publish_releases"("site_id", "version_number");
CREATE INDEX "website_publish_releases_site_id_idx" ON "website_publish_releases"("site_id");
CREATE INDEX "website_publish_releases_dealership_id_idx" ON "website_publish_releases"("dealership_id");
CREATE INDEX "website_publish_releases_site_id_published_at_idx" ON "website_publish_releases"("site_id", "published_at" DESC);

-- WebsiteLeadForm
CREATE TABLE "website_lead_forms" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "site_id"              UUID NOT NULL,
    "dealership_id"        UUID NOT NULL,
    "formType"             "WebsiteLeadFormType" NOT NULL,
    "is_enabled"           BOOLEAN NOT NULL DEFAULT true,
    "routing_config_json"  JSONB,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_lead_forms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_form_type_per_site" ON "website_lead_forms"("site_id", "formType");
CREATE INDEX "website_lead_forms_site_id_idx" ON "website_lead_forms"("site_id");
CREATE INDEX "website_lead_forms_dealership_id_idx" ON "website_lead_forms"("dealership_id");

-- VehicleWebsiteSettings
CREATE TABLE "vehicle_website_settings" (
    "id"                       UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealership_id"            UUID NOT NULL,
    "vehicle_id"               UUID NOT NULL,
    "is_published"             BOOLEAN NOT NULL DEFAULT false,
    "is_featured"              BOOLEAN NOT NULL DEFAULT false,
    "hide_price"               BOOLEAN NOT NULL DEFAULT false,
    "custom_headline"          VARCHAR(200),
    "custom_description"       VARCHAR(1000),
    "sort_priority"            INTEGER NOT NULL DEFAULT 0,
    "primary_photo_override_id" UUID,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_website_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_settings_per_vehicle" ON "vehicle_website_settings"("vehicle_id");
CREATE INDEX "vehicle_website_settings_dealership_id_idx" ON "vehicle_website_settings"("dealership_id");
CREATE INDEX "vehicle_website_settings_dealership_published_idx" ON "vehicle_website_settings"("dealership_id", "is_published");
CREATE INDEX "vehicle_website_settings_vehicle_id_idx" ON "vehicle_website_settings"("vehicle_id");

-- Foreign Keys
ALTER TABLE "website_sites" ADD CONSTRAINT "website_sites_dealership_id_fkey"
    FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_sites" ADD CONSTRAINT "website_sites_published_release_id_fkey"
    FOREIGN KEY ("published_release_id") REFERENCES "website_publish_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_publish_releases" ADD CONSTRAINT "website_publish_releases_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_lead_forms" ADD CONSTRAINT "website_lead_forms_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_website_settings" ADD CONSTRAINT "vehicle_website_settings_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_website_settings" ADD CONSTRAINT "vehicle_website_settings_dealership_id_fkey"
    FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "website_page_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealership_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "vehicle_id" UUID,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utm_source" VARCHAR(200),
    "utm_medium" VARCHAR(200),
    "utm_campaign" VARCHAR(200),
    "referrer_domain" VARCHAR(253),

    CONSTRAINT "website_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_page_views_dealership_id_idx" ON "website_page_views"("dealership_id");

-- CreateIndex
CREATE INDEX "website_page_views_site_id_idx" ON "website_page_views"("site_id");

-- CreateIndex
CREATE INDEX "website_page_views_site_id_viewed_at_idx" ON "website_page_views"("site_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "website_page_views_dealership_id_viewed_at_idx" ON "website_page_views"("dealership_id", "viewed_at" DESC);

-- AddForeignKey
ALTER TABLE "website_page_views" ADD CONSTRAINT "website_page_views_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_page_views" ADD CONSTRAINT "website_page_views_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

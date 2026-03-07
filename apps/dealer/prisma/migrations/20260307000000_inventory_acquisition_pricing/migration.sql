-- Inventory Acquisition & Pricing (INVENTORY_ACQUISITION_PRICING_SPEC)
-- Enums
CREATE TYPE "VehicleAppraisalSourceType" AS ENUM ('TRADE_IN', 'AUCTION', 'MARKETPLACE', 'STREET');
CREATE TYPE "VehicleAppraisalStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'PURCHASED', 'CONVERTED');
CREATE TYPE "InventorySourceLeadSourceType" AS ENUM ('AUCTION', 'TRADE_IN', 'MARKETPLACE', 'STREET');
CREATE TYPE "InventorySourceLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'LOST');
CREATE TYPE "AuctionProvider" AS ENUM ('COPART', 'IAAI', 'MANHEIM', 'ACV', 'MOCK');
CREATE TYPE "PricingRuleType" AS ENUM ('AGE_BASED', 'MARKET_BASED', 'CLEARANCE');
CREATE TYPE "VehicleListingPlatform" AS ENUM ('WEBSITE', 'AUTOTRADER', 'CARS', 'CARFAX', 'FACEBOOK');
CREATE TYPE "VehicleListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FAILED', 'UNPUBLISHED');

-- VehicleAppraisal
CREATE TABLE "VehicleAppraisal" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vin" VARCHAR(17) NOT NULL,
    "source_type" "VehicleAppraisalSourceType" NOT NULL,
    "vehicle_id" UUID,
    "appraised_by_user_id" UUID,
    "acquisition_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "recon_estimate_cents" BIGINT NOT NULL DEFAULT 0,
    "transport_estimate_cents" BIGINT NOT NULL DEFAULT 0,
    "fees_estimate_cents" BIGINT NOT NULL DEFAULT 0,
    "expected_retail_cents" BIGINT NOT NULL DEFAULT 0,
    "expected_wholesale_cents" BIGINT NOT NULL DEFAULT 0,
    "expected_trade_in_cents" BIGINT NOT NULL DEFAULT 0,
    "expected_profit_cents" BIGINT NOT NULL DEFAULT 0,
    "status" "VehicleAppraisalStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAppraisal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VehicleAppraisal_dealership_id_idx" ON "VehicleAppraisal"("dealership_id");
CREATE INDEX "VehicleAppraisal_dealership_id_status_idx" ON "VehicleAppraisal"("dealership_id", "status");
CREATE INDEX "VehicleAppraisal_dealership_id_created_at_idx" ON "VehicleAppraisal"("dealership_id", "created_at");
CREATE INDEX "VehicleAppraisal_vehicle_id_idx" ON "VehicleAppraisal"("vehicle_id");
ALTER TABLE "VehicleAppraisal" ADD CONSTRAINT "VehicleAppraisal_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleAppraisal" ADD CONSTRAINT "VehicleAppraisal_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleAppraisal" ADD CONSTRAINT "VehicleAppraisal_appraised_by_user_id_fkey" FOREIGN KEY ("appraised_by_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InventorySourceLead
CREATE TABLE "InventorySourceLead" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vin" VARCHAR(17) NOT NULL,
    "source_type" "InventorySourceLeadSourceType" NOT NULL,
    "seller_name" VARCHAR(256),
    "seller_phone" VARCHAR(64),
    "seller_email" VARCHAR(256),
    "asking_price_cents" BIGINT,
    "negotiated_price_cents" BIGINT,
    "status" "InventorySourceLeadStatus" NOT NULL DEFAULT 'NEW',
    "appraisal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySourceLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventorySourceLead_dealership_id_idx" ON "InventorySourceLead"("dealership_id");
CREATE INDEX "InventorySourceLead_dealership_id_status_idx" ON "InventorySourceLead"("dealership_id", "status");
CREATE INDEX "InventorySourceLead_dealership_id_created_at_idx" ON "InventorySourceLead"("dealership_id", "created_at");
CREATE INDEX "InventorySourceLead_appraisal_id_idx" ON "InventorySourceLead"("appraisal_id");
ALTER TABLE "InventorySourceLead" ADD CONSTRAINT "InventorySourceLead_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventorySourceLead" ADD CONSTRAINT "InventorySourceLead_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "VehicleAppraisal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuctionListingCache
CREATE TABLE "AuctionListingCache" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "provider" "AuctionProvider" NOT NULL,
    "auction_lot_id" VARCHAR(128) NOT NULL,
    "vin" VARCHAR(17),
    "year" INTEGER,
    "make" VARCHAR(128),
    "model" VARCHAR(128),
    "mileage" INTEGER,
    "current_bid_cents" BIGINT,
    "buy_now_cents" BIGINT,
    "auction_end_at" TIMESTAMP(3),
    "location" VARCHAR(256),
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionListingCache_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuctionListingCache_dealership_id_idx" ON "AuctionListingCache"("dealership_id");
CREATE INDEX "AuctionListingCache_dealership_id_provider_auction_lot_id_idx" ON "AuctionListingCache"("dealership_id", "provider", "auction_lot_id");
CREATE INDEX "AuctionListingCache_dealership_id_vin_idx" ON "AuctionListingCache"("dealership_id", "vin");
ALTER TABLE "AuctionListingCache" ADD CONSTRAINT "AuctionListingCache_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VehicleMarketValuation
CREATE TABLE "VehicleMarketValuation" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "market_average_cents" INTEGER NOT NULL,
    "market_lowest_cents" INTEGER NOT NULL,
    "market_highest_cents" INTEGER NOT NULL,
    "recommended_retail_cents" INTEGER NOT NULL,
    "recommended_wholesale_cents" INTEGER NOT NULL,
    "price_to_market_percent" DOUBLE PRECISION,
    "market_days_supply" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMarketValuation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VehicleMarketValuation_dealership_id_idx" ON "VehicleMarketValuation"("dealership_id");
CREATE INDEX "VehicleMarketValuation_dealership_id_vehicle_id_idx" ON "VehicleMarketValuation"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleMarketValuation_vehicle_id_idx" ON "VehicleMarketValuation"("vehicle_id");
ALTER TABLE "VehicleMarketValuation" ADD CONSTRAINT "VehicleMarketValuation_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMarketValuation" ADD CONSTRAINT "VehicleMarketValuation_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PricingRule
CREATE TABLE "PricingRule" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "rule_type" "PricingRuleType" NOT NULL,
    "days_in_stock" INTEGER,
    "adjustment_percent" DOUBLE PRECISION,
    "adjustment_cents" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PricingRule_dealership_id_idx" ON "PricingRule"("dealership_id");
CREATE INDEX "PricingRule_dealership_id_enabled_idx" ON "PricingRule"("dealership_id", "enabled");
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VehicleListing
CREATE TABLE "VehicleListing" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "platform" "VehicleListingPlatform" NOT NULL,
    "status" "VehicleListingStatus" NOT NULL DEFAULT 'DRAFT',
    "external_listing_id" VARCHAR(256),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleListing_dealership_id_vehicle_id_platform_key" ON "VehicleListing"("dealership_id", "vehicle_id", "platform");
CREATE INDEX "VehicleListing_dealership_id_idx" ON "VehicleListing"("dealership_id");
CREATE INDEX "VehicleListing_dealership_id_vehicle_id_idx" ON "VehicleListing"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleListing_dealership_id_platform_status_idx" ON "VehicleListing"("dealership_id", "platform", "status");
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

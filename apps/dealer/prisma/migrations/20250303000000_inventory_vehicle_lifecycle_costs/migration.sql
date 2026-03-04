-- Inventory hardening: VehicleStatus (add HOLD, REPAIR, ARCHIVED; remove PENDING), cost BigInt cents, VIN unique per dealership
-- Step 1: Add new enum values
ALTER TYPE "VehicleStatus" ADD VALUE IF NOT EXISTS 'HOLD';
ALTER TYPE "VehicleStatus" ADD VALUE IF NOT EXISTS 'REPAIR';
ALTER TYPE "VehicleStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Step 2: Migrate PENDING -> AVAILABLE
UPDATE "Vehicle" SET status = 'AVAILABLE' WHERE status = 'PENDING';

-- Step 3: New enum type without PENDING (Postgres cannot drop enum value directly)
CREATE TYPE "VehicleStatus_new" AS ENUM ('AVAILABLE', 'HOLD', 'SOLD', 'WHOLESALE', 'REPAIR', 'ARCHIVED');
ALTER TABLE "Vehicle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Vehicle" ALTER COLUMN "status" TYPE "VehicleStatus_new" USING (status::text::"VehicleStatus_new");
ALTER TABLE "Vehicle" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE'::"VehicleStatus_new";
DROP TYPE "VehicleStatus";
ALTER TYPE "VehicleStatus_new" RENAME TO "VehicleStatus";

-- Step 4: Add new BigInt columns (cents)
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sale_price_cents" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "auction_cost_cents" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "transport_cost_cents" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "recon_cost_cents" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "misc_cost_cents" BIGINT NOT NULL DEFAULT 0;

-- Step 5: Migrate Decimal data to cents (only if old columns still exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Vehicle' AND column_name = 'list_price') THEN
    UPDATE "Vehicle" SET
      sale_price_cents = (ROUND(COALESCE("list_price", 0)::numeric * 100))::BIGINT,
      auction_cost_cents = (ROUND(COALESCE("purchase_price", 0)::numeric * 100))::BIGINT,
      recon_cost_cents = (ROUND(COALESCE("reconditioning_cost", 0)::numeric * 100))::BIGINT,
      misc_cost_cents = (ROUND(COALESCE("other_costs", 0)::numeric * 100))::BIGINT;
  END IF;
END $$;

-- Step 6: Drop old Decimal columns
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "purchase_price";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "reconditioning_cost";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "other_costs";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "list_price";

-- Step 7: VIN unique per dealership (PostgreSQL allows multiple NULLs in UNIQUE)
DROP INDEX IF EXISTS "Vehicle_dealership_id_vin_idx";
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_dealership_id_vin_key" UNIQUE ("dealership_id", "vin");

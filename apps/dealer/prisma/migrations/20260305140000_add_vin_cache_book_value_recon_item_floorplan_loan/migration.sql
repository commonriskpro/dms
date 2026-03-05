-- Inventory Depth Slices D–G: VinDecodeCache, VehicleBookValue, ReconItem, FloorplanLoan
-- Slice D: VIN decode cache (per dealership + VIN, no vehicle)
CREATE TABLE "VinDecodeCache" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vin" VARCHAR(17) NOT NULL,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "body_style" TEXT,
    "engine" TEXT,
    "fuel_type" TEXT,
    "drive_type" TEXT,
    "transmission" TEXT,
    "decoded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(32) NOT NULL,
    "raw_json" JSONB,

    CONSTRAINT "VinDecodeCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VinDecodeCache_dealership_id_vin_key" ON "VinDecodeCache"("dealership_id", "vin");
CREATE INDEX "VinDecodeCache_dealership_id_idx" ON "VinDecodeCache"("dealership_id");
CREATE INDEX "VinDecodeCache_dealership_id_decoded_at_idx" ON "VinDecodeCache"("dealership_id", "decoded_at");

ALTER TABLE "VinDecodeCache" ADD CONSTRAINT "VinDecodeCache_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slice E: Manual book values (retail/trade/wholesale/auction)
CREATE TABLE "VehicleBookValue" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "retail_cents" INTEGER,
    "trade_in_cents" INTEGER,
    "wholesale_cents" INTEGER,
    "auction_cents" INTEGER,
    "source" VARCHAR(32) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleBookValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleBookValue_dealership_id_vehicle_id_key" ON "VehicleBookValue"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleBookValue_dealership_id_idx" ON "VehicleBookValue"("dealership_id");
CREATE INDEX "VehicleBookValue_dealership_id_vehicle_id_idx" ON "VehicleBookValue"("dealership_id", "vehicle_id");

ALTER TABLE "VehicleBookValue" ADD CONSTRAINT "VehicleBookValue_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleBookValue" ADD CONSTRAINT "VehicleBookValue_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slice F: ReconItem (standalone recon line items with status)
CREATE TYPE "ReconItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "ReconItem" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "description" VARCHAR(256) NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "status" "ReconItemStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" UUID,

    CONSTRAINT "ReconItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconItem_dealership_id_idx" ON "ReconItem"("dealership_id");
CREATE INDEX "ReconItem_dealership_id_vehicle_id_idx" ON "ReconItem"("dealership_id", "vehicle_id");
CREATE INDEX "ReconItem_dealership_id_vehicle_id_status_idx" ON "ReconItem"("dealership_id", "vehicle_id", "status");

ALTER TABLE "ReconItem" ADD CONSTRAINT "ReconItem_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconItem" ADD CONSTRAINT "ReconItem_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slice G: FloorplanLoan (lender as string, status)
CREATE TYPE "FloorplanLoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'SOLD');

CREATE TABLE "FloorplanLoan" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "lender" VARCHAR(128) NOT NULL,
    "principal_cents" INTEGER NOT NULL,
    "interest_bps" INTEGER,
    "start_date" DATE NOT NULL,
    "curtailment_date" DATE,
    "status" "FloorplanLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FloorplanLoan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FloorplanLoan_dealership_id_idx" ON "FloorplanLoan"("dealership_id");
CREATE INDEX "FloorplanLoan_dealership_id_vehicle_id_idx" ON "FloorplanLoan"("dealership_id", "vehicle_id");
CREATE INDEX "FloorplanLoan_dealership_id_vehicle_id_status_idx" ON "FloorplanLoan"("dealership_id", "vehicle_id", "status");

ALTER TABLE "FloorplanLoan" ADD CONSTRAINT "FloorplanLoan_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FloorplanLoan" ADD CONSTRAINT "FloorplanLoan_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

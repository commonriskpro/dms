-- Slice D: VehicleVinDecode
CREATE TABLE "VehicleVinDecode" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "decoded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vin" VARCHAR(17) NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "trim" TEXT,
    "body_style" TEXT,
    "engine" TEXT,
    "drivetrain" TEXT,
    "transmission" TEXT,
    "fuel_type" TEXT,
    "manufactured_in" TEXT,
    "raw_json" JSONB,

    CONSTRAINT "VehicleVinDecode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleVinDecode_dealership_id_idx" ON "VehicleVinDecode"("dealership_id");
CREATE INDEX "VehicleVinDecode_dealership_id_vehicle_id_idx" ON "VehicleVinDecode"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleVinDecode_vehicle_id_idx" ON "VehicleVinDecode"("vehicle_id");
CREATE INDEX "VehicleVinDecode_vehicle_id_decoded_at_idx" ON "VehicleVinDecode"("vehicle_id", "decoded_at" DESC);

ALTER TABLE "VehicleVinDecode" ADD CONSTRAINT "VehicleVinDecode_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleVinDecode" ADD CONSTRAINT "VehicleVinDecode_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slice E: VehicleValuation
CREATE TABLE "VehicleValuation" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "value_cents" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condition" TEXT,
    "odometer" INTEGER,

    CONSTRAINT "VehicleValuation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleValuation_dealership_id_idx" ON "VehicleValuation"("dealership_id");
CREATE INDEX "VehicleValuation_dealership_id_vehicle_id_idx" ON "VehicleValuation"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleValuation_vehicle_id_idx" ON "VehicleValuation"("vehicle_id");
CREATE INDEX "VehicleValuation_vehicle_id_captured_at_idx" ON "VehicleValuation"("vehicle_id", "captured_at" DESC);

ALTER TABLE "VehicleValuation" ADD CONSTRAINT "VehicleValuation_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleValuation" ADD CONSTRAINT "VehicleValuation_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slice F: VehicleReconStatus enum, VehicleRecon, VehicleReconLineItem
CREATE TYPE "VehicleReconStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

CREATE TABLE "VehicleRecon" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "status" "VehicleReconStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleRecon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleRecon_vehicle_id_key" ON "VehicleRecon"("vehicle_id");
CREATE INDEX "VehicleRecon_dealership_id_idx" ON "VehicleRecon"("dealership_id");
CREATE INDEX "VehicleRecon_dealership_id_vehicle_id_idx" ON "VehicleRecon"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleRecon_vehicle_id_idx" ON "VehicleRecon"("vehicle_id");
CREATE INDEX "VehicleRecon_dealership_id_status_idx" ON "VehicleRecon"("dealership_id", "status");

ALTER TABLE "VehicleRecon" ADD CONSTRAINT "VehicleRecon_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleRecon" ADD CONSTRAINT "VehicleRecon_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VehicleReconLineItem" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "recon_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "category" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleReconLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleReconLineItem_dealership_id_idx" ON "VehicleReconLineItem"("dealership_id");
CREATE INDEX "VehicleReconLineItem_recon_id_idx" ON "VehicleReconLineItem"("recon_id");

ALTER TABLE "VehicleReconLineItem" ADD CONSTRAINT "VehicleReconLineItem_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleReconLineItem" ADD CONSTRAINT "VehicleReconLineItem_recon_id_fkey" FOREIGN KEY ("recon_id") REFERENCES "VehicleRecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slice G: VehicleFloorplan, VehicleFloorplanCurtailment
CREATE TABLE "VehicleFloorplan" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "principal_cents" INTEGER NOT NULL,
    "apr_bps" INTEGER,
    "start_date" TIMESTAMP(3) NOT NULL,
    "next_curtailment_due_date" TIMESTAMP(3),
    "payoff_quote_cents" INTEGER,
    "payoff_quote_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleFloorplan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleFloorplan_vehicle_id_key" ON "VehicleFloorplan"("vehicle_id");
CREATE INDEX "VehicleFloorplan_dealership_id_idx" ON "VehicleFloorplan"("dealership_id");
CREATE INDEX "VehicleFloorplan_dealership_id_vehicle_id_idx" ON "VehicleFloorplan"("dealership_id", "vehicle_id");
CREATE INDEX "VehicleFloorplan_vehicle_id_idx" ON "VehicleFloorplan"("vehicle_id");
CREATE INDEX "VehicleFloorplan_lender_id_idx" ON "VehicleFloorplan"("lender_id");
CREATE INDEX "VehicleFloorplan_dealership_id_next_curtailment_due_date_idx" ON "VehicleFloorplan"("dealership_id", "next_curtailment_due_date");
CREATE INDEX "VehicleFloorplan_dealership_id_payoff_quote_expires_at_idx" ON "VehicleFloorplan"("dealership_id", "payoff_quote_expires_at");

ALTER TABLE "VehicleFloorplan" ADD CONSTRAINT "VehicleFloorplan_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleFloorplan" ADD CONSTRAINT "VehicleFloorplan_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleFloorplan" ADD CONSTRAINT "VehicleFloorplan_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "Lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "VehicleFloorplanCurtailment" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "floorplan_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleFloorplanCurtailment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleFloorplanCurtailment_dealership_id_idx" ON "VehicleFloorplanCurtailment"("dealership_id");
CREATE INDEX "VehicleFloorplanCurtailment_floorplan_id_idx" ON "VehicleFloorplanCurtailment"("floorplan_id");

ALTER TABLE "VehicleFloorplanCurtailment" ADD CONSTRAINT "VehicleFloorplanCurtailment_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleFloorplanCurtailment" ADD CONSTRAINT "VehicleFloorplanCurtailment_floorplan_id_fkey" FOREIGN KEY ("floorplan_id") REFERENCES "VehicleFloorplan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

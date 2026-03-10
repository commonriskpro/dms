CREATE TYPE "InventorySummaryScope" AS ENUM ('OVERVIEW', 'INTELLIGENCE');

CREATE TABLE "InventorySummarySnapshot" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "scope" "InventorySummaryScope" NOT NULL,
  "user_id" UUID NOT NULL,
  "has_pipeline" BOOLEAN NOT NULL DEFAULT false,
  "snapshot_json" JSONB NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySummarySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventorySummarySnapshot_dealership_scope_user_pipeline_key"
  ON "InventorySummarySnapshot" ("dealership_id", "scope", "user_id", "has_pipeline");

CREATE INDEX "InventorySummarySnapshot_dealership_scope_updated_idx"
  ON "InventorySummarySnapshot" ("dealership_id", "scope", "updated_at");

ALTER TABLE "InventorySummarySnapshot"
  ADD CONSTRAINT "InventorySummarySnapshot_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventorySummarySnapshot"
  ADD CONSTRAINT "InventorySummarySnapshot_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

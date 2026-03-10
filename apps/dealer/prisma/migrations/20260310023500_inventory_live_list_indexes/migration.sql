CREATE INDEX IF NOT EXISTS "Vehicle_dealership_id_deleted_at_created_at_desc_idx"
  ON "Vehicle" ("dealership_id", "deleted_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "Vehicle_dealership_id_deleted_at_updated_at_desc_idx"
  ON "Vehicle" ("dealership_id", "deleted_at", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "Vehicle_dealership_id_deleted_at_sale_price_cents_desc_idx"
  ON "Vehicle" ("dealership_id", "deleted_at", "sale_price_cents" DESC);

CREATE INDEX IF NOT EXISTS "Vehicle_dealership_id_deleted_at_mileage_asc_idx"
  ON "Vehicle" ("dealership_id", "deleted_at", "mileage" ASC);

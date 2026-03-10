CREATE INDEX IF NOT EXISTS "Vehicle_dealership_id_status_deleted_at_sale_price_cents_desc_idx"
  ON "Vehicle" ("dealership_id", "status", "deleted_at", "sale_price_cents" DESC);

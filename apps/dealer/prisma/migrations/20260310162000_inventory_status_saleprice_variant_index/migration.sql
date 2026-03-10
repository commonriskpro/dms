CREATE INDEX IF NOT EXISTS "veh_did_status_del_price_desc_idx"
  ON "Vehicle" ("dealership_id", "status", "deleted_at", "sale_price_cents" DESC);

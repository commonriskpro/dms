CREATE INDEX IF NOT EXISTS "isig_active_lookup_idx"
  ON "intelligence_signals" (
    "dealership_id",
    "domain",
    "code",
    "resolved_at",
    "deleted_at",
    "entity_type",
    "entity_id"
  );

-- Narrow index-support optimization for dashboard acquisition refresh:
-- supports inventory_source_lead NEW-status count by dealership.
CREATE INDEX "inv_src_lead_new_did_idx"
ON "InventorySourceLead" ("dealership_id")
WHERE "status" = 'NEW';

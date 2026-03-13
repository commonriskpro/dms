CREATE INDEX "cust_did_del_created_desc_idx"
ON "Customer" ("dealership_id", "deleted_at", "created_at" DESC);

CREATE INDEX "cust_did_del_updated_desc_idx"
ON "Customer" ("dealership_id", "deleted_at", "updated_at" DESC);

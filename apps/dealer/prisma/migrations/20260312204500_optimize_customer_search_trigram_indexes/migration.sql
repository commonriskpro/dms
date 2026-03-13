CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "cust_name_trgm_idx"
ON "Customer"
USING GIN ("name" gin_trgm_ops)
WHERE "deleted_at" IS NULL;

CREATE INDEX "cust_phone_value_trgm_idx"
ON "CustomerPhone"
USING GIN ("value" gin_trgm_ops);

CREATE INDEX "cust_email_value_trgm_idx"
ON "CustomerEmail"
USING GIN ("value" gin_trgm_ops);

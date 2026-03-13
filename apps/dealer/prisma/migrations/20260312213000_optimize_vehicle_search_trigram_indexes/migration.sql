CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "veh_make_trgm_idx"
ON "Vehicle"
USING GIN ("make" gin_trgm_ops);

CREATE INDEX "veh_model_trgm_idx"
ON "Vehicle"
USING GIN ("model" gin_trgm_ops);

CREATE INDEX "veh_stock_number_trgm_idx"
ON "Vehicle"
USING GIN ("stock_number" gin_trgm_ops);

CREATE INDEX "veh_vin_trgm_idx"
ON "Vehicle"
USING GIN ("vin" gin_trgm_ops);

CREATE TABLE "customer_last_activity_summary" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "last_activity_at" TIMESTAMP(3) NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_last_activity_summary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_last_activity_summary_dealership_customer_key"
  ON "customer_last_activity_summary" ("dealership_id", "customer_id");

CREATE UNIQUE INDEX "customer_last_activity_summary_customer_id_key"
  ON "customer_last_activity_summary" ("customer_id");

CREATE INDEX "customer_last_activity_summary_dealership_idx"
  ON "customer_last_activity_summary" ("dealership_id");

CREATE INDEX "customer_last_activity_summary_dealership_last_activity_idx"
  ON "customer_last_activity_summary" ("dealership_id", "last_activity_at");

CREATE INDEX "customer_last_activity_summary_customer_idx"
  ON "customer_last_activity_summary" ("customer_id");

ALTER TABLE "customer_last_activity_summary"
  ADD CONSTRAINT "customer_last_activity_summary_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_last_activity_summary"
  ADD CONSTRAINT "customer_last_activity_summary_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

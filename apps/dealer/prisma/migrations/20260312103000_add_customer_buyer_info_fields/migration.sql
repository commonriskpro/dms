ALTER TABLE "Customer"
ADD COLUMN "gender" VARCHAR(32),
ADD COLUMN "dob" DATE,
ADD COLUMN "ssn_encrypted" TEXT,
ADD COLUMN "lead_type" VARCHAR(64),
ADD COLUMN "bdc_rep_id" UUID,
ADD COLUMN "id_type" VARCHAR(64),
ADD COLUMN "id_state" VARCHAR(32),
ADD COLUMN "id_number" VARCHAR(128),
ADD COLUMN "id_issued_date" DATE,
ADD COLUMN "id_expiration_date" DATE,
ADD COLUMN "cash_down_cents" BIGINT,
ADD COLUMN "is_in_showroom" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Customer_dealership_id_lead_type_idx"
ON "Customer"("dealership_id", "lead_type");

CREATE INDEX "Customer_dealership_id_bdc_rep_id_idx"
ON "Customer"("dealership_id", "bdc_rep_id");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_bdc_rep_id_fkey"
FOREIGN KEY ("bdc_rep_id") REFERENCES "Profile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Vehicle"
ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "Vehicle_dealership_id_is_draft_idx"
ON "Vehicle"("dealership_id", "is_draft");

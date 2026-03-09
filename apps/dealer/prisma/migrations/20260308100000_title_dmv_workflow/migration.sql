-- TitleStatus enum, DealTitle, DealDmvChecklistItem
CREATE TYPE "TitleStatus" AS ENUM (
  'NOT_STARTED',
  'TITLE_PENDING',
  'TITLE_SENT',
  'TITLE_RECEIVED',
  'TITLE_COMPLETED',
  'ISSUE_HOLD'
);

CREATE TABLE "DealTitle" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "title_status" "TitleStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "title_number" VARCHAR(128),
    "lienholder_name" VARCHAR(256),
    "lien_released_at" TIMESTAMP(3),
    "sent_to_dmv_at" TIMESTAMP(3),
    "received_from_dmv_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealTitle_deal_id_key" ON "DealTitle"("deal_id");
CREATE INDEX "DealTitle_dealership_id_idx" ON "DealTitle"("dealership_id");
CREATE INDEX "DealTitle_dealership_id_title_status_idx" ON "DealTitle"("dealership_id", "title_status");
CREATE INDEX "DealTitle_dealership_id_created_at_idx" ON "DealTitle"("dealership_id", "created_at");

CREATE TABLE "DealDmvChecklistItem" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "label" VARCHAR(256) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealDmvChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealDmvChecklistItem_dealership_id_idx" ON "DealDmvChecklistItem"("dealership_id");
CREATE INDEX "DealDmvChecklistItem_dealership_id_deal_id_idx" ON "DealDmvChecklistItem"("dealership_id", "deal_id");

ALTER TABLE "DealTitle" ADD CONSTRAINT "DealTitle_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealTitle" ADD CONSTRAINT "DealTitle_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDmvChecklistItem" ADD CONSTRAINT "DealDmvChecklistItem_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDmvChecklistItem" ADD CONSTRAINT "DealDmvChecklistItem_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

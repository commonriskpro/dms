-- CreateTable DealershipOnboardingState (one per dealership; lazy-created on first read)
CREATE TABLE "DealershipOnboardingState" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "completed_steps" JSONB NOT NULL DEFAULT '[]',
    "skipped_steps" JSONB NOT NULL DEFAULT '[]',
    "inventory_path_chosen" VARCHAR(32),
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealershipOnboardingState_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one onboarding state per dealership
CREATE UNIQUE INDEX "DealershipOnboardingState_dealership_id_key" ON "DealershipOnboardingState"("dealership_id");

-- Index for queries by dealership and by completion
CREATE INDEX "DealershipOnboardingState_dealership_id_idx" ON "DealershipOnboardingState"("dealership_id");
CREATE INDEX "DealershipOnboardingState_is_complete_idx" ON "DealershipOnboardingState"("is_complete");

-- FK to Dealership (Cascade delete when dealership is deleted)
ALTER TABLE "DealershipOnboardingState" ADD CONSTRAINT "DealershipOnboardingState_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

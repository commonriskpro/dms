-- CreateTable
CREATE TABLE "dealer_job_runs" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "dead_letter" INTEGER NOT NULL DEFAULT 0,
    "skipped_reason" VARCHAR(500),
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "dealer_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dealer_job_runs_dealership_id_started_at_idx" ON "dealer_job_runs"("dealership_id", "started_at");

-- AddForeignKey
ALTER TABLE "dealer_job_runs" ADD CONSTRAINT "dealer_job_runs_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "dealer_rate_limit_stats_daily" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "route_key" VARCHAR(500) NOT NULL,
    "allowed_count" INTEGER NOT NULL,
    "blocked_count" INTEGER NOT NULL,
    "unique_ip_count_approx" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_rate_limit_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_job_runs_daily" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "dealership_id" UUID NOT NULL,
    "total_runs" INTEGER NOT NULL,
    "skipped_runs" INTEGER NOT NULL,
    "processed_runs" INTEGER NOT NULL,
    "failed_runs" INTEGER NOT NULL,
    "avg_duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_job_runs_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_rate_limit_stats_daily_day_route_key_key" ON "dealer_rate_limit_stats_daily"("day", "route_key");

-- CreateIndex
CREATE INDEX "dealer_rate_limit_stats_daily_day_idx" ON "dealer_rate_limit_stats_daily"("day");

-- CreateIndex
CREATE INDEX "dealer_rate_limit_stats_daily_route_key_idx" ON "dealer_rate_limit_stats_daily"("route_key");

-- CreateIndex
CREATE INDEX "dealer_rate_limit_stats_daily_day_route_key_idx" ON "dealer_rate_limit_stats_daily"("day", "route_key");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_job_runs_daily_day_dealership_id_key" ON "dealer_job_runs_daily"("day", "dealership_id");

-- CreateIndex
CREATE INDEX "dealer_job_runs_daily_day_idx" ON "dealer_job_runs_daily"("day");

-- CreateIndex
CREATE INDEX "dealer_job_runs_daily_dealership_id_idx" ON "dealer_job_runs_daily"("dealership_id");

-- CreateIndex
CREATE INDEX "dealer_job_runs_daily_day_dealership_id_idx" ON "dealer_job_runs_daily"("day", "dealership_id");

-- AddForeignKey
ALTER TABLE "dealer_job_runs_daily" ADD CONSTRAINT "dealer_job_runs_daily_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

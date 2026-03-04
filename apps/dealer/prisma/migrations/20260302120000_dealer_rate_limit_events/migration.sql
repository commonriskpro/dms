-- CreateTable
CREATE TABLE "dealer_rate_limit_events" (
    "id" UUID NOT NULL,
    "route_key" VARCHAR(500) NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dealer_rate_limit_events_route_key_created_at_idx" ON "dealer_rate_limit_events"("route_key", "created_at");

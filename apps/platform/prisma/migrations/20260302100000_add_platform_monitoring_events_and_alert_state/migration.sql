-- CreateEnum
CREATE TYPE "PlatformMonitoringEventType" AS ENUM ('DEALER_HEALTH_FAIL', 'DEALER_HEALTH_RECOVER');

-- CreateEnum
CREATE TYPE "PlatformAlertStatus" AS ENUM ('OK', 'FAIL');

-- CreateTable
CREATE TABLE "platform_monitoring_events" (
    "id" UUID NOT NULL,
    "type" "PlatformMonitoringEventType" NOT NULL,
    "platform_dealership_id" UUID,
    "dealer_base_url" VARCHAR(2048) NOT NULL,
    "upstream_status" INTEGER NOT NULL,
    "request_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_monitoring_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_alert_state" (
    "id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "last_status" "PlatformAlertStatus" NOT NULL,
    "last_change_at" TIMESTAMP(3) NOT NULL,
    "consecutive_fails" INTEGER NOT NULL DEFAULT 0,
    "last_alert_sent_at" TIMESTAMP(3),

    CONSTRAINT "platform_alert_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_monitoring_events_type_created_at_idx" ON "platform_monitoring_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "platform_monitoring_events_created_at_idx" ON "platform_monitoring_events"("created_at");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "platform_alert_state_key_key" ON "platform_alert_state"("key");

-- CreateEnum
CREATE TYPE "IntelligenceSignalDomain" AS ENUM (
  'INVENTORY',
  'CRM',
  'DEALS',
  'OPERATIONS',
  'ACQUISITION'
);

-- CreateEnum
CREATE TYPE "IntelligenceSignalSeverity" AS ENUM (
  'INFO',
  'SUCCESS',
  'WARNING',
  'DANGER'
);

-- CreateTable
CREATE TABLE "intelligence_signals" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "domain" "IntelligenceSignalDomain" NOT NULL,
    "code" VARCHAR(128) NOT NULL,
    "severity" "IntelligenceSignalSeverity" NOT NULL DEFAULT 'INFO',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "entity_type" VARCHAR(64),
    "entity_id" UUID,
    "action_label" VARCHAR(120),
    "action_href" VARCHAR(512),
    "metadata" JSONB,
    "happened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "intelligence_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intelligence_signals_dealership_id_idx" ON "intelligence_signals"("dealership_id");

-- CreateIndex
CREATE INDEX "intelligence_signals_dealership_id_domain_severity_idx" ON "intelligence_signals"("dealership_id", "domain", "severity");

-- CreateIndex
CREATE INDEX "intelligence_signals_dealership_id_resolved_at_happened_at_idx" ON "intelligence_signals"("dealership_id", "resolved_at", "happened_at");

-- CreateIndex
CREATE INDEX "intelligence_signals_dealership_id_code_created_at_idx" ON "intelligence_signals"("dealership_id", "code", "created_at");

-- CreateIndex
CREATE INDEX "intelligence_signals_dealership_id_deleted_at_idx" ON "intelligence_signals"("dealership_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_signals_active_dedupe_idx"
ON "intelligence_signals" (
  "dealership_id",
  "domain",
  "code",
  COALESCE("entity_type", ''),
  COALESCE("entity_id"::text, '')
)
WHERE "resolved_at" IS NULL AND "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "intelligence_signals"
ADD CONSTRAINT "intelligence_signals_dealership_id_fkey"
FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

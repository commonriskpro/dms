-- CreateEnum
CREATE TYPE "SavedFilterVisibility" AS ENUM ('PERSONAL', 'SHARED');

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "visibility" "SavedFilterVisibility" NOT NULL,
    "owner_user_id" UUID,
    "definition_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "visibility" "SavedFilterVisibility" NOT NULL,
    "owner_user_id" UUID,
    "state_json" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedFilter_dealership_id_idx" ON "SavedFilter"("dealership_id");

-- CreateIndex
CREATE INDEX "SavedFilter_dealership_id_visibility_idx" ON "SavedFilter"("dealership_id", "visibility");

-- CreateIndex
CREATE INDEX "SavedFilter_dealership_id_owner_user_id_idx" ON "SavedFilter"("dealership_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "SavedSearch_dealership_id_idx" ON "SavedSearch"("dealership_id");

-- CreateIndex
CREATE INDEX "SavedSearch_dealership_id_visibility_idx" ON "SavedSearch"("dealership_id", "visibility");

-- CreateIndex
CREATE INDEX "SavedSearch_dealership_id_owner_user_id_idx" ON "SavedSearch"("dealership_id", "owner_user_id");

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

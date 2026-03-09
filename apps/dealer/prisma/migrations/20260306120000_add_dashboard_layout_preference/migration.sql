-- CreateTable
CREATE TABLE "DashboardLayoutPreference" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "layout_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardLayoutPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardLayoutPreference_dealership_id_user_id_key" ON "DashboardLayoutPreference"("dealership_id", "user_id");

-- CreateIndex
CREATE INDEX "DashboardLayoutPreference_dealership_id_idx" ON "DashboardLayoutPreference"("dealership_id");

-- CreateIndex
CREATE INDEX "DashboardLayoutPreference_user_id_idx" ON "DashboardLayoutPreference"("user_id");

-- AddForeignKey
ALTER TABLE "DashboardLayoutPreference" ADD CONSTRAINT "DashboardLayoutPreference_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardLayoutPreference" ADD CONSTRAINT "DashboardLayoutPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

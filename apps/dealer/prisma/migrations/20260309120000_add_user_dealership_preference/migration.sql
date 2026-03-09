-- CreateTable
CREATE TABLE "user_dealership_preference" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "value" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_dealership_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_dealership_preference_dealership_id_user_id_key_key" ON "user_dealership_preference"("dealership_id", "user_id", "key");

-- CreateIndex
CREATE INDEX "user_dealership_preference_dealership_id_idx" ON "user_dealership_preference"("dealership_id");

-- CreateIndex
CREATE INDEX "user_dealership_preference_user_id_idx" ON "user_dealership_preference"("user_id");

-- AddForeignKey
ALTER TABLE "user_dealership_preference" ADD CONSTRAINT "user_dealership_preference_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dealership_preference" ADD CONSTRAINT "user_dealership_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

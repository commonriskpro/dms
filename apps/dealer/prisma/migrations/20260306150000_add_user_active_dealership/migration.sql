-- CreateTable
CREATE TABLE "UserActiveDealership" (
    "user_id" UUID NOT NULL,
    "active_dealership_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActiveDealership_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "UserActiveDealership_active_dealership_id_idx" ON "UserActiveDealership"("active_dealership_id");

-- AddForeignKey
ALTER TABLE "UserActiveDealership" ADD CONSTRAINT "UserActiveDealership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActiveDealership" ADD CONSTRAINT "UserActiveDealership_active_dealership_id_fkey" FOREIGN KEY ("active_dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

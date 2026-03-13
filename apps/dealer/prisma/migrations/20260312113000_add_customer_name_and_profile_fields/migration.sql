ALTER TABLE "Customer"
ADD COLUMN "customer_class" VARCHAR(32),
ADD COLUMN "first_name" VARCHAR(128),
ADD COLUMN "middle_name" VARCHAR(128),
ADD COLUMN "last_name" VARCHAR(128),
ADD COLUMN "name_suffix" VARCHAR(64),
ADD COLUMN "county" VARCHAR(128),
ADD COLUMN "is_active_military" BOOLEAN NOT NULL DEFAULT false;

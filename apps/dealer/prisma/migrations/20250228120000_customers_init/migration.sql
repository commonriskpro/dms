-- Customers module (docs/design/customers-spec.md)
-- CustomerStatus enum, Customer, CustomerPhone, CustomerEmail, CustomerNote, CustomerTask, CustomerActivity

CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'SOLD', 'INACTIVE');

CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lead_source" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'LEAD',
    "assigned_to" UUID,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerPhone" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "kind" TEXT,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPhone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerEmail" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "kind" TEXT,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerNote" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerTask" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "CustomerTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerActivity" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "activity_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_dealership_id_idx" ON "Customer"("dealership_id");
CREATE INDEX "Customer_dealership_id_status_idx" ON "Customer"("dealership_id", "status");
CREATE INDEX "Customer_dealership_id_created_at_idx" ON "Customer"("dealership_id", "created_at");
CREATE INDEX "Customer_dealership_id_lead_source_idx" ON "Customer"("dealership_id", "lead_source");
CREATE INDEX "Customer_dealership_id_assigned_to_idx" ON "Customer"("dealership_id", "assigned_to");
CREATE INDEX "Customer_dealership_id_deleted_at_idx" ON "Customer"("dealership_id", "deleted_at");

CREATE INDEX "CustomerPhone_dealership_id_idx" ON "CustomerPhone"("dealership_id");
CREATE INDEX "CustomerPhone_customer_id_idx" ON "CustomerPhone"("customer_id");
CREATE INDEX "CustomerPhone_dealership_id_value_idx" ON "CustomerPhone"("dealership_id", "value");

CREATE INDEX "CustomerEmail_dealership_id_idx" ON "CustomerEmail"("dealership_id");
CREATE INDEX "CustomerEmail_customer_id_idx" ON "CustomerEmail"("customer_id");
CREATE INDEX "CustomerEmail_dealership_id_value_idx" ON "CustomerEmail"("dealership_id", "value");

CREATE INDEX "CustomerNote_dealership_id_idx" ON "CustomerNote"("dealership_id");
CREATE INDEX "CustomerNote_customer_id_idx" ON "CustomerNote"("customer_id");
CREATE INDEX "CustomerNote_customer_id_created_at_idx" ON "CustomerNote"("customer_id", "created_at");
CREATE INDEX "CustomerNote_dealership_id_customer_id_idx" ON "CustomerNote"("dealership_id", "customer_id");

CREATE INDEX "CustomerTask_dealership_id_idx" ON "CustomerTask"("dealership_id");
CREATE INDEX "CustomerTask_customer_id_idx" ON "CustomerTask"("customer_id");
CREATE INDEX "CustomerTask_customer_id_created_at_idx" ON "CustomerTask"("customer_id", "created_at");
CREATE INDEX "CustomerTask_dealership_id_completed_at_idx" ON "CustomerTask"("dealership_id", "completed_at");
CREATE INDEX "CustomerTask_dealership_id_customer_id_idx" ON "CustomerTask"("dealership_id", "customer_id");

CREATE INDEX "CustomerActivity_dealership_id_idx" ON "CustomerActivity"("dealership_id");
CREATE INDEX "CustomerActivity_dealership_id_customer_id_created_at_idx" ON "CustomerActivity"("dealership_id", "customer_id", "created_at");
CREATE INDEX "CustomerActivity_customer_id_created_at_idx" ON "CustomerActivity"("customer_id", "created_at");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerEmail" ADD CONSTRAINT "CustomerEmail_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerEmail" ADD CONSTRAINT "CustomerEmail_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

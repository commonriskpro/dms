-- PlatformAccount, PlatformDealership platformAccountId + slug, PlatformSubscription
CREATE TYPE "PlatformAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "platform_accounts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "PlatformAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_accounts_status_idx" ON "platform_accounts"("status");

CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED');

ALTER TABLE "platform_dealerships" ADD COLUMN "platform_account_id" UUID;
ALTER TABLE "platform_dealerships" ADD COLUMN "slug" VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_dealerships_slug_key" ON "platform_dealerships"("slug");
CREATE INDEX IF NOT EXISTS "platform_dealerships_platform_account_id_idx" ON "platform_dealerships"("platform_account_id");

ALTER TABLE "platform_dealerships" ADD CONSTRAINT "platform_dealerships_platform_account_id_fkey"
  FOREIGN KEY ("platform_account_id") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "platform_subscriptions" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "billing_status" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_provider" VARCHAR(64),
    "billing_customer_id" VARCHAR(255),
    "billing_subscription_id" VARCHAR(255),
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_subscriptions_dealership_id_key" ON "platform_subscriptions"("dealership_id");
CREATE INDEX "platform_subscriptions_billing_status_idx" ON "platform_subscriptions"("billing_status");

ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "platform_dealerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

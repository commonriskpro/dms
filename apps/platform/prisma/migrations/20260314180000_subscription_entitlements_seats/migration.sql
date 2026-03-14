-- Add SUSPENDED to BillingStatus; add maxSeats and entitlements to platform_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SUSPENDED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BillingStatus')) THEN
    ALTER TYPE "BillingStatus" ADD VALUE 'SUSPENDED';
  END IF;
END
$$;

ALTER TABLE "platform_subscriptions" ADD COLUMN IF NOT EXISTS "max_seats" INTEGER;
ALTER TABLE "platform_subscriptions" ADD COLUMN IF NOT EXISTS "entitlements" JSONB;

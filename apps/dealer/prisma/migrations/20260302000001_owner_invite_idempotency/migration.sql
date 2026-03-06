-- Owner invite idempotency for platform-triggered internal API
CREATE TABLE "OwnerInviteIdempotency" (
    "idempotency_key" VARCHAR(255) NOT NULL,
    "dealer_dealership_id" UUID NOT NULL,
    "invite_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerInviteIdempotency_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "OwnerInviteIdempotency_dealer_dealership_id_idx" ON "OwnerInviteIdempotency"("dealer_dealership_id");

ALTER TABLE "OwnerInviteIdempotency" ADD CONSTRAINT "OwnerInviteIdempotency_dealer_dealership_id_fkey" FOREIGN KEY ("dealer_dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

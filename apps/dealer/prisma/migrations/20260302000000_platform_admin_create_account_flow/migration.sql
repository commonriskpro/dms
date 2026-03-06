-- Platform Admin Create Account Flow: DealershipInvite, PendingApproval, optional inviteId on Membership
-- See docs/design/platform-admin-spec.md §3.1

-- CreateEnum
CREATE TYPE "DealershipInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DealershipInvite" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "DealershipInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "token" TEXT,

    CONSTRAINT "DealershipInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingApproval" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealershipInvite_dealership_id_idx" ON "DealershipInvite"("dealership_id");

-- CreateIndex
CREATE INDEX "DealershipInvite_email_idx" ON "DealershipInvite"("email");

-- CreateIndex
CREATE INDEX "DealershipInvite_dealership_id_email_idx" ON "DealershipInvite"("dealership_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "DealershipInvite_token_key" ON "DealershipInvite"("token");

-- CreateIndex
CREATE INDEX "DealershipInvite_expires_at_idx" ON "DealershipInvite"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "PendingApproval_user_id_key" ON "PendingApproval"("user_id");

-- CreateIndex
CREATE INDEX "PendingApproval_user_id_idx" ON "PendingApproval"("user_id");

-- CreateIndex
CREATE INDEX "PendingApproval_created_at_idx" ON "PendingApproval"("created_at");

-- AddForeignKey
ALTER TABLE "DealershipInvite" ADD CONSTRAINT "DealershipInvite_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealershipInvite" ADD CONSTRAINT "DealershipInvite_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealershipInvite" ADD CONSTRAINT "DealershipInvite_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingApproval" ADD CONSTRAINT "PendingApproval_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (optional: invite_id on Membership for traceability)
ALTER TABLE "Membership" ADD COLUMN "invite_id" UUID;

-- CreateIndex
CREATE INDEX "Membership_invite_id_idx" ON "Membership"("invite_id");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "DealershipInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add acceptedByUserId to DealershipInvite for audit/traceability (who accepted).
ALTER TABLE "DealershipInvite" ADD COLUMN "accepted_by_user_id" UUID;

CREATE INDEX "DealershipInvite_accepted_by_user_id_idx" ON "DealershipInvite"("accepted_by_user_id");

ALTER TABLE "DealershipInvite" ADD CONSTRAINT "DealershipInvite_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

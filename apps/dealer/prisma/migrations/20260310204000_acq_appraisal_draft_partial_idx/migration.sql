-- Final narrow dashboard acquisition query-path optimization:
-- supports VehicleAppraisal DRAFT-status count by dealership.
CREATE INDEX "veh_appr_draft_did_idx"
ON "VehicleAppraisal" ("dealership_id")
WHERE "status" = 'DRAFT';

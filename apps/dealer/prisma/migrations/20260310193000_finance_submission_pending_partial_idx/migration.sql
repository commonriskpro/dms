CREATE INDEX IF NOT EXISTS "fin_sub_pending_sub_dec_did_idx"
  ON "FinanceSubmission" ("dealership_id")
  WHERE "funding_status" = 'PENDING'
    AND "status" IN ('SUBMITTED', 'DECISIONED');

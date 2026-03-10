CREATE INDEX IF NOT EXISTS "fin_sub_did_status_fund_idx"
  ON "FinanceSubmission" ("dealership_id", "status", "funding_status");

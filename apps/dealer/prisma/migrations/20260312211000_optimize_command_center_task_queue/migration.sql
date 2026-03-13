CREATE INDEX IF NOT EXISTS "cust_task_due_queue_idx"
  ON "CustomerTask" ("dealership_id", "deleted_at", "completed_at", "due_at" ASC, "created_at" DESC);

CREATE INDEX IF NOT EXISTS "cust_task_due_queue_by_creator_idx"
  ON "CustomerTask" ("dealership_id", "created_by", "deleted_at", "completed_at", "due_at" ASC, "created_at" DESC);

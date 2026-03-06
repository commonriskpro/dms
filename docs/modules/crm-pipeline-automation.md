# CRM Pipeline + Follow-up Automation — Module

Module: pipelines, stages, opportunities, automation rules, job queue, follow-up sequences. See `docs/design/crm-pipeline-automation-spec.md` for full spec.

## Security guarantees and operational notes

### Tenant isolation

- All CRM routes use `ctx.dealershipId` (or `auth.dealershipId`) from auth/session only. **No route accepts `dealershipId` in body or query** for privileged behavior.
- Cross-tenant access (e.g. Dealer A requesting Dealer B’s pipeline, opportunity, rule, sequence, or job by ID) returns **404 NOT_FOUND**, not 403. List endpoints return only the authenticated dealership’s data (empty when scoped to another tenant’s IDs).

### RBAC

- **crm.read** is required for all GET (pipelines, stages, opportunities, activity, automation rules, sequence templates/steps/instances, jobs list/get).
- **crm.write** is required for all POST/PATCH/DELETE (create/update/delete pipelines, stages, opportunities, rules, sequences, start/pause/stop instances).
- **Job worker (POST /api/crm/jobs/run):** requires **crm.write**. Runs pending jobs for the authenticated dealership only. No client-supplied dealership.
- **Cron (GET /api/crm/jobs/run):** requires **CRON_SECRET** in `Authorization: Bearer <secret>`. Runs the worker for **all** dealerships (for server-to-server cron). No query or body parameters; dealership is never accepted from client.

### Atomic job claim

- Job claiming is **atomic**: a single `UPDATE ... WHERE status = 'pending' AND run_at <= now() ... FOR UPDATE SKIP LOCKED` (or equivalent) ensures only one worker can claim a given job.
- **Stuck jobs:** Before each claim pass, the worker calls `reclaimStuckRunningJobs(dealershipId, now)`. Jobs in `running` longer than the configured timeout (e.g. 5 minutes) are set back to `pending` so they can be retried.
- Running two workers concurrently on the same dealership does **not** duplicate execution: only one worker gets each job.

### Replay safety and idempotency

- **AutomationRun:** Uniqueness is on `(dealershipId, entityType, entityId, eventKey, ruleId)` (or equivalent). The same event + rule for the same entity does not create a second run; duplicate triggers result in a single execution.
- **Event key canonicalization:** Trigger event names are canonicalized (e.g. `customer.task.completed` and `customer.task_completed` map to one canonical key) so slight variations cannot bypass idempotency.
- **Delayed automation jobs:** Each delayed job payload includes `runId`. The worker calls `tryTransitionAutomationRunToRunning(dealershipId, runId)` before executing. Only one transition from `scheduled` → `running` succeeds; retries or a second claim see the run already running/completed and skip execution (no duplicate actions).

### Loop guard

- **Per-entity, per-minute cap:** The automation engine refuses to start new runs when the number of AutomationRuns for the same `(dealershipId, entityType, entityId)` in the last minute exceeds a limit (e.g. 5). This bounds runaway chains.
- **Depth and origin:** Event payloads can carry `origin: 'automation'`, `originRuleId`, and `depth`. Events from automation that would re-trigger the same rule are skipped; depth above a max (e.g. 3) is ignored.
- No Redis is required; guards use the DB (AutomationRun count, status, and optional depth in job payload).

### Sequence stop conditions

- Before executing a sequence step job, the worker re-checks:
  - **SequenceInstance** status is `active` or `paused`.
  - If the instance is tied to an **Opportunity**, that opportunity’s status is not `WON` or `LOST`.
- If the instance is stopped or the opportunity is closed, the step job **no-ops**: the step is marked **skipped** (e.g. “Opportunity closed” or “Instance not active”) and no side effects (e.g. create task, send email) are performed.
- Delayed step jobs that run after the opportunity is WON/LOST or the instance is stopped do not create tasks or send messages.

### Cron protection

- **POST /api/crm/jobs/run** is for per-dealership execution with user context: requires auth + **crm.write**; runs only for `ctx.dealershipId`.
- **GET /api/crm/jobs/run** is for cron: requires valid **CRON_SECRET**; runs the worker for all dealerships. There is no endpoint that accepts a dealership ID from the client to run another tenant’s jobs.

### No PII in audit

- Audit metadata for CRM (pipelines, stages, opportunities, rules, sequences, jobs) contains only **IDs and changed fields** (e.g. pipelineId, stageId, opportunityId, ruleId, templateId, instanceId, jobId, queueType, retryCount, errorCode, fromStageId, toStageId, fromStatus, toStatus).
- **No email, phone, address, or message content** (e.g. send_email / send_sms body) is stored in audit.

## Quality

- Integration tests are **skip-safe** when `TEST_DATABASE_URL` is not set (`describe.skipIf(!hasDb)`).
- Tests cover: tenant isolation (cross-tenant NOT_FOUND, list own only), RBAC (crm.read / crm.write), atomic job claim (concurrent workers → single execution), sequence stop (WON before delayed step → step skipped), idempotency (same event → one run), validation abuse (limit, offset, enums, max lengths).

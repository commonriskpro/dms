# Worker Bridge Migration Plan

Date: March 10, 2026

Update (March 10, 2026):
- `analytics` direct execution: complete.
- `alerts` direct execution: complete.
- `vinDecode` direct execution: complete (default), with rollback mode to bridge.

## 1. Recommended Direction

Recommendation: `GO` for phased, selective migration to direct shared-service execution for specific worker jobs.

Scope of recommended migration:
- Phase-in direct execution for `analytics` and `alerts` first.
- Keep `crmExecution` bridged initially.
- Reassess `vinDecode` and `bulkImport` after first migration results.

Non-goal in this plan:
- no all-at-once removal of internal worker job endpoints.

## 2. Guardrails (Must Preserve)

- BullMQ remains the execution engine.
- Postgres remains durable workflow state source of truth.
- Tenant isolation checks remain explicit in business service paths.
- Existing retry/failure semantics remain intact.
- `DealerJobRun` telemetry continuity is preserved for migrated jobs.

## 3. Target End-State Shape

For migrated job types:
- Worker handler calls shared execution function directly (in-process), not `POST /api/internal/jobs/*`.
- Shared function still uses dealer service modules and writes equivalent run tracking.

For non-migrated job types:
- Worker continues calling dealer internal endpoints.

## 4. Required Refactor Before First Migration

Create a shared execution surface for worker-callable functions (example location options):
- `packages/worker-executors` (preferred)
- or a dealer module promoted to package-level with no Next route dependencies

Extraction requirements:
- expose pure execution functions for `analytics` and `alerts`
- include a shared tracked-run helper equivalent to `runTrackedInternalJob(...)`
- avoid importing Next route-specific objects (`NextRequest`, route helpers)

## 5. Phased Plan

## Phase 0 - Baseline and Invariants
Targets:
- freeze baseline metrics for bridge path (`worker-bridge`, `worker-burst`, relevant app latency).
- record semantic invariants for analytics/alerts outputs.

Success criteria:
- baseline artifacts linked in migration PR docs.

## Phase 1 - Shared Executor Extraction (No Behavior Change)
Targets:
- extract analytics/alerts execution + tracked run recording into shared runtime-safe module.
- keep existing internal HTTP routes using same extracted logic.

Risk: Medium
Rollback: keep route-only path and revert worker-side usage toggle.

Success criteria:
- internal endpoints still pass existing behavior checks.
- no DB schema changes required.

## Phase 2 - Worker Analytics Direct Execution
Targets:
- switch `analytics.worker.ts` from `postDealerInternalJob(...)` to direct shared executor call.
- keep endpoint intact as compatibility path.

Risk: Medium
Success criteria:
- analytics results and run tracking parity with bridged path.
- worker retry/failure behavior unchanged at BullMQ level.

## Phase 3 - Worker Alerts Direct Execution
Targets:
- switch `alerts.worker.ts` similarly.

Risk: Medium
Success criteria:
- alert-check semantics unchanged.
- run tracking parity preserved.

## Phase 4 - Measurement and Decision Gate
Targets:
- compare before/after on:
  - worker execution latency
  - failure rates
  - run tracking completeness
- decide whether to proceed with `vinDecode` and/or `bulkImport`.

Decision criteria:
- clear measurable benefit without semantics regressions.

## Phase 5 - Optional Next Candidates
Potential next migrations:
- `vinDecode` first (lower risk)
- `bulkImport` only if profiling proves bridge hop is material versus DB processing

## Deferred for later:
- `crmExecution` direct execution (requires separate deep-risk plan)

## 6. Why CRM Should Be Deferred

`crmExecution` currently calls `runJobWorker(...)`, which owns:
- lifecycle gate (`tenant_not_active`)
- stuck-job reclaim
- pending job claim
- retry/backoff/dead-letter transitions
- audit + run logs

Changing this path together with bridge removal would couple two risky changes.
Recommendation: isolate CRM runner evolution from bridge-removal pilot.

## 7. Test Strategy

For each migrated job family:

1. Unit tests
- worker handler tests for direct executor path
- shared executor tests for semantic parity

2. Integration tests
- run against local Redis + DB
- verify `DealerJobRun` rows and result payload parity

3. Performance checks
- run perf bridge scenarios and worker burst scenarios before/after
- confirm expected reduction in worker bridge latency for migrated jobs

4. Safety checks
- verify tenant isolation still enforced by underlying services (`requireTenantActiveForWrite` etc.)

## 8. Rollback Strategy

Rollback mechanism:
- keep HTTP endpoint path operational until migration is proven
- use feature-flag/config switch in worker handler to toggle between:
  - direct executor
  - `postDealerInternalJob(...)`

Rollback trigger examples:
- run tracking mismatch
- semantic divergence in analytics/alerts outputs
- unexpected retry/failure behavior

## 9. Success Criteria

Technical:
- migrated jobs no longer require worker->dealer internal HTTP for execution.
- Postgres durable state + telemetry remain complete and correct.
- no increase in failed/dead-letter rates.

Performance:
- measurable latency reduction on migrated job execution path.
- no regression to inventory/report/dashboard read paths from migration side effects.

Operational:
- clear observability retained (structured logs + job run metrics).

## 10. Recommended First Migration Candidate

`analytics` direct execution.

Reason:
- strongest combination of low semantic risk + likely measurable bridge-overhead reduction.

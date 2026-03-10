# Legacy Migration Plan

This plan converts the legacy findings from [LEGACY_SYSTEMS_AUDIT.md](./LEGACY_SYSTEMS_AUDIT.md) into a conservative, phased migration path.

Hard constraints for this plan:
- no speculative deletions
- data/runtime-impacting changes must be migration-gated
- compatibility layers are removed only after explicit verification

Supporting inventory:
- [LEGACY_SYSTEMS_MATRIX.md](./LEGACY_SYSTEMS_MATRIX.md)

## 1. Migration Strategy Overview

Guiding rule:
- remove dead/stale artifacts early
- defer runtime/data-impacting removals until production usage and data state are proven

Priority order:
1. rule-source cleanup and documentation trust
2. residual dealer-side platform compatibility cleanup
3. async execution convergence planning/execution
4. compatibility cleanup with migration gates

## 2. Phase Plan

## Phase 0 - Document and Confirm

Goal:
- freeze decisions needed before risky migration work.

Targets:
- confirm the post-cutover disposition for dealer invite/support bridge dependencies used by `apps/platform`
- confirm whether dashboard v1 endpoint must remain:
  - [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts)
- confirm CRM async migration design under the fixed target architecture:
  - DB worker [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)
  - BullMQ worker [`apps/worker/src`](../../apps/worker/src)

Risk:
- High if skipped; later phases can break ops or runtime assumptions.

Dependencies:
- product/ops owner decisions on specific compatibility windows and migration order.

Rollback concerns:
- N/A (decision/documentation phase).

Success criteria:
- explicit keep/remove disposition for dealer invite/support bridge paths
- explicit CRM async convergence approach documented

## Phase 1 - Safe Docs and Tooling Cleanup (No Behavior Change)

Goal:
- stop legacy docs/tooling from shaping new work.

Targets:
- align stale agent guidance with canonical stack:
  - [`agent_spec.md`](../../agent_spec.md)
- reconcile canonical-doc drift:
  - [`MODULE_REGISTRY_CANONICAL.md`](./MODULE_REGISTRY_CANONICAL.md)
  - [`KNOWN_GAPS_AND_FUTURE_WORK.md`](./KNOWN_GAPS_AND_FUTURE_WORK.md)
  - any canonical references still asserting obsolete branch/runtime assumptions
- optionally add/strengthen superseded notices in legacy docs that still look active first.

Risk:
- Low.

Dependencies:
- none beyond Phase 0 decisions for exact migration wording.

Rollback concerns:
- docs-only rollback is trivial.

Success criteria:
- no known canonical doc statement conflicts with current code for audited legacy targets
- `agent_spec.md` no longer prescribes superseded queue/test stack

## Phase 2 - Safe Code Cleanup (No Intended Behavior Change)

Goal:
- remove dead/stale code and stale tooling artifacts.

Targets:
- remove stale tooling artifacts after grep verification:
  - [`dms-package.json`](../../dms-package.json)
  - [`scripts/vitest-to-jest.js`](../../scripts/vitest-to-jest.js)
- remove or archive stale customer UI implementations after import/test verification:
  - [`apps/dealer/modules/customers/ui/CustomersPage.tsx`](../../apps/dealer/modules/customers/ui/CustomersPage.tsx)
  - [`apps/dealer/modules/customers/ui/CustomersListPage.tsx`](../../apps/dealer/modules/customers/ui/CustomersListPage.tsx)
  - [`apps/dealer/modules/customers/ui/ListPage.tsx`](../../apps/dealer/modules/customers/ui/ListPage.tsx)
- remove unused deprecated wrapper in deals service if no runtime references remain:
  - [`updateDealDesk` in `deal-desk.ts`](../../apps/dealer/modules/deals/service/deal-desk.ts)
- optionally remove deprecated mobile proxy export if all imports are migrated:
  - [`apps/mobile/src/auth/supabase.ts`](../../apps/mobile/src/auth/supabase.ts)

Risk:
- Low to Medium (mostly compile/test risk).

Dependencies:
- grep + typecheck + targeted tests proving no live references.

Rollback concerns:
- straightforward revert if imports/tests break.

Success criteria:
- removed files/symbols have zero runtime import references
- focused tests and build pass for touched apps

## Phase 3 - Data Migration and Compatibility Cleanup

Goal:
- complete migration-bound cleanup while preserving correctness in live environments.

Targets:
- RBAC compatibility cleanup validation in each environment:
  - run/verify [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts)
  - verify stale role/override permission rows are remediated
- vehicle-photo legacy cleanup validation:
  - backfill/cleanup scripts under [`apps/dealer/scripts`](../../apps/dealer/scripts)
  - verify no legacy-only file rows are still needed
- inventory alias deprecation planning:
  - audit consumer usage of alias keys before removing aliases from:
    - [`apps/dealer/modules/inventory/api-response.ts`](../../apps/dealer/modules/inventory/api-response.ts)
    - [`apps/dealer/modules/inventory/ui/types.ts`](../../apps/dealer/modules/inventory/ui/types.ts)
    - [`apps/dealer/app/api/inventory/aging/route.ts`](../../apps/dealer/app/api/inventory/aging/route.ts)
- Redis/worker fallback policy verification:
  - decide whether no-Redis fallbacks remain supported for target env classes
- dealer bridge boundary verification:
  - confirm only invite/support bridge paths remain after the control-plane cutover

Risk:
- High (live data + client compatibility).

Dependencies:
- environment access + migration runbooks
- explicit client compatibility confirmation.

Rollback concerns:
- must preserve backup/restore path for role/permission data updates
- keep rollback script strategy for failed migrations

Success criteria:
- all target environments report clean RBAC/legacy-photo verification checks
- documented inventory alias consumer inventory and approved removal timeline
- explicit worker fallback policy documented
- explicit compatibility policy documented for the remaining dealer invite/support bridge paths

## Phase 4 - Remove Deprecated Runtime Paths

Goal:
- remove superseded runtime paths once Phase 3 validations are complete.

Targets:
- retire dashboard v1 route/service if no consumer remains:
  - [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts)
  - [`apps/dealer/modules/dashboard/service/dashboard.ts`](../../apps/dealer/modules/dashboard/service/dashboard.ts)
- consolidate VIN decode architecture (remove mock-backed decode path if approved):
  - [`apps/dealer/modules/inventory/service/vin-decode.ts`](../../apps/dealer/modules/inventory/service/vin-decode.ts)
  - [`apps/dealer/app/api/inventory/[id]/vin/decode/route.ts`](../../apps/dealer/app/api/inventory/[id]/vin/decode/route.ts)
- retire residual dealer-side invite/support bridge paths if they are ever proven unnecessary:
  - any invite/support compatibility paths proven unnecessary
- retire DB-runner execution as the default async pattern once BullMQ replacement exists:
  - [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)
  - [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)

Risk:
- High.

Dependencies:
- confirmed cutover design from Phase 0
- migration completion from Phase 3
- communication to operators/users.

Rollback concerns:
- need reversible rollout (feature flags or branch rollback)
- keep short-term compatibility fallback window where practical.

Success criteria:
- deprecated endpoints/surfaces removed or hard-deprecated with no production regressions
- monitoring shows no meaningful traffic to removed paths

## Phase 5 - Post-Migration Verification and Closure

Goal:
- prove legacy cleanup is complete and prevent regressions.

Targets:
- re-run legacy grep/audit checks for removed targets
- update canonical status docs to reflect final post-migration state
- retire migration-only scripts only when all environments are verified clean

Risk:
- Medium if skipped (legacy reintroduction risk).

Dependencies:
- completion evidence from Phases 2-4.

Rollback concerns:
- low; this is verification/documentation.

Success criteria:
- canonical docs contain no known stale legacy claims for migrated targets
- migration-only artifacts clearly marked retained vs retired
- open issues list is only intentional residual legacy

## 3. Highest-Risk Migration Tracks

1. Dealer invite/support bridge minimization after the completed control-plane cutover.
2. Async execution convergence from dealer DB-runner execution to BullMQ execution.
3. Inventory and dashboard compatibility path removals (`/api/dashboard` v1, legacy alias fields, VIN split path).
4. Live-environment RBAC and photo-legacy cleanup verification.

## 4. Safest Near-Term Wins

These can start first with minimal risk:
1. Phase 1 docs/tooling drift cleanup.
2. Phase 2 stale artifact removals (`dms-package.json`, vitest migration helper, unused wrappers/components after verification).
3. Reduce `agent_spec.md` to an explicitly superseded reference and rely on `.cursorrules`.

## 5. Rollback and Recovery Principles

For migration-bearing phases (3 and 4):
- snapshot/backup before destructive data cleanup
- perform changes environment-by-environment
- keep compatibility scripts available until verification is complete
- monitor error rates and access-denied anomalies immediately after rollout
- prefer reversible rollout sequencing over one-shot removal

## 6. Recommended First Migration Phase

Start with:
- `Phase 0` immediately (platform-surface strategy, async convergence design, dashboard-v1 consumer check)
- then execute `Phase 1` and low-risk parts of `Phase 2` in the same sprint

Reason:
- this sequence reduces active operational/documentation legacy risk without touching high-risk runtime behavior.

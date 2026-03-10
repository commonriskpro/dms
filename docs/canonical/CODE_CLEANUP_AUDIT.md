# Code Cleanup Audit (Canonical)

Last updated: March 10, 2026

## Scope
- Repository-level dead/unused code detection and cleanup readiness.
- Non-behavioral refactors only in this pass.
- Performance-preserving requirement maintained.

## Current Size Snapshot
- Workspace files (`rg --files`): `2476`
- TS/JS files (all, including generated/local build outputs): `53842`

## What Was Added In This Audit Pass
- Repeatable dead-code audit command:
  - `npm run audit:dead-code`
  - Script: [`scripts/code-health/run-dead-code-audit.mjs`](/Users/saturno/Downloads/dms/scripts/code-health/run-dead-code-audit.mjs)
- Outputs are written to:
  - `artifacts/code-health/<timestamp>/`
  - `artifacts/code-health/latest-summary.md`
  - `artifacts/code-health/latest-summary.json`

## Baseline Findings (Tool-Assisted)
From `ts-prune` + repo-specific filters:
- Dealer: high volume, many likely false positives in UI export barrels and framework-owned exports.
- Platform: low actionable candidate count.
- Worker: medium count, but includes cross-app references and type/export noise.

This confirms cleanup opportunity is real, but broad deletion must be staged and reference-verified.

## Verified Safe Refactor Completed In This Pass
Performance script duplication was reduced by extracting shared resolution helpers:
- Added in [`apps/dealer/scripts/performance/_utils.ts`](/Users/saturno/Downloads/dms/apps/dealer/scripts/performance/_utils.ts):
  - `resolveDealershipContext`
  - `resolveScenarioUserId`
- Reused in:
  - [`apps/dealer/scripts/performance/run-reports-scenario.ts`](/Users/saturno/Downloads/dms/apps/dealer/scripts/performance/run-reports-scenario.ts)
  - [`apps/dealer/scripts/performance/run-inventory-scenario.ts`](/Users/saturno/Downloads/dms/apps/dealer/scripts/performance/run-inventory-scenario.ts)
  - [`apps/dealer/scripts/performance/run-dashboard-scenario.ts`](/Users/saturno/Downloads/dms/apps/dealer/scripts/performance/run-dashboard-scenario.ts)
  - [`apps/dealer/scripts/performance/run-worker-burst-scenario.ts`](/Users/saturno/Downloads/dms/apps/dealer/scripts/performance/run-worker-burst-scenario.ts)

Result:
- Less duplicated lookup logic.
- Fixed previous perf-context drift risk from inconsistent user/dealership resolution paths.

## Validation Run
- Executed: `npm run perf:all -- --seed none`
- Result: command completed successfully, no regression in scenario execution.
- Latest artifacts:
  - `/Users/saturno/Downloads/dms/artifacts/perf/2026-03-10T19-37-43-674Z/summary.md`

## Key Cleanup Risks Identified
- `ts-prune` on Next.js projects reports many framework-owned exports (`default`, route handlers, metadata, dynamic).
- Export barrel files in UI systems may appear unused even when imported indirectly.
- Large generated trees (`.next/*`) can pollute audit output if not ignored.

## Recommended Next Batch Targets (Low Risk)
1. Platform low-count candidates from audit (reference-verify each before removal).
2. Dealer utility exports with explicit zero-import proof (non-route, non-type-only).
3. Script/test-only helpers with no runtime consumers.

## Not Done In This Pass
- No mass deletion.
- No broad module reshaping.
- No runtime behavior changes.

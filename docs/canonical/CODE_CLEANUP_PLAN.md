# Code Cleanup Plan (Canonical)

Last updated: March 10, 2026

## Goal
Reduce dead/unused code and duplication without performance regressions or accidental feature breakage.

## Principles
- Code-backed verification before deletion.
- Measure behavior/performance before and after significant cleanup batches.
- Prefer small, reversible batches.
- Avoid deleting framework-owned exports or generated artifacts based on static tool output alone.

## Phase 0 — Tooling Baseline (Completed)
- Added repeatable audit command: `npm run audit:dead-code`
- Added artifact outputs for traceability.
- Consolidated duplicated perf-script context lookup logic.

## Phase 1 — Safe, Low-Risk Removals
- Target: platform candidates with low dependency surface.
- Method:
  1. verify zero references via `rg`
  2. remove export/function
  3. run focused build/tests for touched app
- Exit criteria:
  - platform build passes
  - no API/runtime behavior changes

## Phase 2 — Dealer Service/Utility Pruning
- Target: dealer helper exports and dormant wrappers (not routes/pages).
- Method:
  1. classify candidate as runtime/service/test/docs
  2. remove only zero-reference runtime-safe candidates
  3. run `perf:all` and focused dealer checks
- Exit criteria:
  - no route breakage
  - no perf regression

## Phase 3 — UI Barrel and Component Cleanup
- Target: unused UI exports and duplicate component surfaces.
- Method:
  1. map import graph for UI barrels
  2. remove dead exports first, then dead files
  3. verify app build and critical pages
- Exit criteria:
  - no design/runtime regressions
  - reduced export surface

## Phase 4 — Structural Consolidation
- Target: duplicated domain helpers and parallel utility layers.
- Method:
  1. consolidate into canonical shared helpers
  2. preserve API contracts
  3. run focused tests + perf smoke
- Exit criteria:
  - smaller code surface with equal behavior

## Ongoing Validation Gate (every phase)
- `npm run perf:all -- --seed none`
- app-level build checks for touched apps
- targeted tests around modified modules

## Success Metrics
- reduced file/export count in audited modules
- fewer dead-code findings in `audit:dead-code` outputs
- no increase in perf hotspot metrics
- no behavior regressions in touched routes/modules

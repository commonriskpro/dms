# SQL Optimization Checklist

Use with `docs/canonical/SQL_OPTIMIZATION_PLAYBOOK.md`.

## Pre-Change

- Confirm hotspot path and owning file/module.
- Classify path:
  - live row read
  - aggregate/summary
  - derived metadata
  - workflow/history/audit
- Capture baseline with repeated runs (recommended `5x` minimum when noisy).
- Record p50/p95/avg/max/spread.
- Confirm tenant scoping (`dealershipId`) and soft-delete predicates (`deletedAt`) in query shape.
- Capture EXPLAIN for dominant query variant(s).

## Change Design

- Keep scope to one dominant cost.
- Choose one primary tactic:
  - narrow select/include
  - separate summary from live list
  - index support change
  - SQL aggregation pushdown
  - batching/N+1 fix
  - snapshot/precompute
- Ensure no live-list correctness dependency on async worker completion.
- Avoid combining unrelated optimizations in one sprint.

## Validation

- Re-run same repeated measurement set with same seed/state.
- Compare mean p50/p95/avg and spread before/after.
- Confirm behavior parity (API shape and business semantics).
- Run focused tests for changed module paths.
- Re-check EXPLAIN on changed query.

## Decision

- Keep if directional gains are repeatable and behavior is preserved.
- Revert if regressive or gains are inside noise floor with extra complexity.
- If mixed signal, document clearly and prefer low-risk retention only when justified.

## Documentation

- Update canonical perf/optimization docs with:
  - before/after repeated-run table
  - exact files changed
  - query-plan notes
  - retained vs reverted decision
- Link artifacts in `docs/canonical/INDEX.md`.

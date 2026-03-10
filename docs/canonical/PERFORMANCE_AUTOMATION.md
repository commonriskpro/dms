# Performance Automation (Canonical)

Last updated: March 10, 2026

## Purpose
Provide one-command, repeatable performance runs that:
- optionally seed realistic performance data
- execute all core scenarios in a stable order
- capture logs and structured outputs
- generate machine-readable and human-readable summaries

Canonical command:
- `npm run perf:all`

## What `perf:all` Does
`perf:all` runs a repo-level orchestrator at:
- `scripts/performance/run-all.ts`

Lifecycle:
1. Preflight
2. Optional seed
3. Scenario execution (ordered)
4. Artifact capture
5. Summary generation

Default scenario order:
1. reports
2. inventory
3. dashboard
4. worker-burst
5. worker-bridge
6. platform-bridge

## Commands

Primary:
- `npm run perf:all`

Convenience seed variants:
- `npm run perf:all:small`
- `npm run perf:all:medium`
- `npm run perf:all:large`

Bridge + local Redis convenience profile:
- `npm run perf:all:local-redis:deployed-bridge`

## Supported Flags

Pass flags after `--`:
- `--seed none|small|medium|large`
- `--dealership-slug <slug>`
- `--dealership-id <uuid>`
- `--iterations <n>`
- `--warmup <n>`
- `--artifacts-dir <path>`
- `--continue-on-error true|false`
- `--mutation-bursts <n>`
- `--worker-burst-size <n>`
- `--worker-burst-bursts <n>`
- `--worker-bridge-iterations <n>`
- `--platform-bridge-iterations <n>`
- `--scenario-timeout-ms <n>`
- `--bridge-url <url>`
- `--redis-url <url>`

Example:
```bash
npm run perf:all -- \
  --seed medium \
  --dealership-slug demo \
  --iterations 12 \
  --warmup 2 \
  --continue-on-error true
```

Example (force local Redis + deployed bridge target without editing env files):
```bash
npm run perf:all -- \
  --seed medium \
  --bridge-url https://dms-gold.vercel.app \
  --redis-url redis://127.0.0.1:6379
```

Default orchestration values (if not overridden):
- seed: `none`
- dealership slug: `demo`
- iterations: `12`
- warmup: `2`
- continue-on-error: `true`
- worker burst size/bursts: `20` / `2`
- scenario timeout: `600000` (10 minutes per scenario)

## Artifact Structure

Each run writes to:
- `artifacts/perf/<timestamp>/`

Generated files:
- `metadata.json`
- `summary.json`
- `summary.md`
- `preflight.log`
- `seed.log` (when seed step runs)
- `reports.log`
- `inventory.log`
- `dashboard.log`
- `worker-burst.log`
- `worker-bridge.log`
- `platform-bridge.log`

When parseable structured JSON is found in scenario output:
- `reports.json`
- `inventory.json`
- `dashboard.json`
- `worker-burst.json`
- `worker-bridge.json`
- `platform-bridge.json`

## Failure Policy

Default behavior:
- `--continue-on-error true`
- continue running remaining scenarios
- preserve logs for all steps
- mark overall run failed in `summary.json`/`summary.md` if any scenario failed
- emit heartbeat progress logs while long scenarios run
- fail a scenario if it exceeds `--scenario-timeout-ms`

Strict mode:
- `--continue-on-error false`
- stop on first failing scenario
- still write run artifacts and summaries for completed steps

## Preflight and Safety

Preflight includes:
- Node/npm/git summary
- selected options/scenarios
- basic env file checks (`.env.local`, `.env.platform-admin`)

Safety defaults:
- default seed is `none` (no data mutation)
- no destructive wipe is performed by orchestrator
- any seed behavior is delegated to existing safe seed tooling

## Reading Outputs

### `summary.md`
Human-first report:
- run metadata
- seed status
- scenario pass/fail table
- metric highlights
- warnings
- next actions

### `summary.json`
Machine-readable run record:
- run status
- scenario status/duration/exit codes
- relative artifact file paths
- metric summaries
- options used
- explicit `skipped` scenario status and reason when local bridge prerequisites are unavailable

### `metadata.json`
Execution identity details:
- run id
- artifact path
- git branch/commit
- Node/npm
- options

## Common Failure Modes

1. Schema/query drift in local DB
- Example observed: dashboard raw SQL failing on missing column in local environment.
- Action: run expected migrations/seed and retry.

2. Missing bridge env configuration
- Worker/platform bridge scenarios depend on internal bridge env vars.
- Action: verify `.env.local` and `.env.platform-admin`.

3. Dealer internal bridge target unreachable in local environment
- Bridge scripts now use a safe local fallback URL (`http://localhost:3000`) when `DEALER_INTERNAL_API_URL` is not set.
- If that target is unreachable, bridge scenarios are marked `skipped` with a clear reason (not hard-failed).
- Action: run a reachable dealer app/internal endpoint target before expecting bridge latency metrics.

3. Missing dealership id for worker bridge
- Orchestrator attempts auto-resolution from reports output.
- If unavailable, pass `--dealership-id` explicitly.

## Codex Usage Pattern

Recommended future Codex workflow:
1. Run `npm run perf:all -- --seed medium --dealership-slug demo`.
2. Read latest `artifacts/perf/<timestamp>/summary.json`.
3. Compare with previous run for p95/avg regressions.
4. Open focused optimization tasks only for regressed scenarios.

## Human Usage Pattern

For repeatable local checks:
1. Use the same seed tier and iteration/warmup values each run.
2. Keep run artifacts under `artifacts/perf/`.
3. Compare `summary.json` across timestamps before and after optimization changes.

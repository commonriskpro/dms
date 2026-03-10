# Architecture Decisions Canonical

This file records the current fixed architecture decisions for the repository as of March 9, 2026.

These decisions are no longer open questions. Future code, docs, migrations, and agent guidance should align to them.

## 1. Final Decisions

### A. Deploy Branch

Decision:
- `main` is the canonical deploy branch.
- `IOSAPP` is an experimental branch only and is not a deployment source of truth.

Why:
- The current deploy workflow in [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) already runs on push to `main`.
- Canonical deploy behavior needs one stable branch of truth for migrations and release discipline.

Implications:
- Docs and runbooks should treat `main` as deployment-sensitive.
- Any branch/process language implying `master` or `IOSAPP` deployment authority is obsolete.

### B. Rule Source

Decision:
- [`.cursorrules`](../../.cursorrules) is the canonical agent/development rule source.
- [`agent_spec.md`](../../agent_spec.md) is obsolete.

Why:
- `.cursorrules` matches the current stack and repo conventions:
  - Node `24.x`
  - Jest-only testing guidance
  - BullMQ/Redis as the active queue implementation
- `agent_spec.md` still prescribes superseded guidance such as `pg-boss` and Vitest.

Implications:
- Future agent/tooling guidance should be updated in `.cursorrules`, not `agent_spec.md`.
- `agent_spec.md` should only remain as a clearly marked superseded reference until removed.

### C. Platform Control Plane

Decision:
- [`apps/platform`](../../apps/platform) is the canonical platform control plane.
- Platform-related surfaces inside [`apps/dealer`](../../apps/dealer) are legacy, transitional, or compatibility-only unless explicitly justified.

Why:
- `apps/platform` already contains the dedicated platform auth model, platform UI shell, platform APIs, and platform reporting/monitoring surfaces.
- Dealer-hosted platform routes and pages duplicate control-plane concerns and create long-term architectural ambiguity.

Implications:
- New platform/admin/operator functionality should be built in `apps/platform`.
- Dealer-hosted platform pages and APIs should be treated as migration targets, not growth targets.
- Dealer-side compatibility should stay limited to dealer-owned invite/support bridge behavior that `apps/platform` still calls.

### D. Async Architecture

Decision:
- BullMQ is the canonical execution system for background work.
- Postgres is the canonical durable source of truth for workflow state, auditability, and user-visible status.

Why:
- The worker app in [`apps/worker`](../../apps/worker) is now a real BullMQ executor for bulk import, analytics, alerts, and VIN follow-up.
- Dealer-side business state and status are already persisted in Postgres models such as:
  - `BulkImportJob`
  - `DealerJobRun`
  - `DealerJobRunsDaily`
  - `AutomationRun`
  - `Job`
- This split keeps execution operationally decoupled while preserving dealer-side durability, tenancy, and auditability in Postgres.

Implications:
- Future async features should queue execution through BullMQ rather than inventing new DB-polling runners.
- Postgres-backed models remain the business source of truth even when execution is moved behind BullMQ.
- Existing DB-runner execution paths should be treated as legacy execution patterns to migrate where appropriate, not as the template for new work.

## 2. What Is Now Clearly Legacy

Because of the decisions above, these are now explicitly legacy or transitional:
- branch ambiguity between `main`, `master`, and `IOSAPP`
- `agent_spec.md` as an active rule source
- dealer-hosted platform control-plane growth under `apps/dealer/app/platform` and `apps/dealer/app/api/platform`
- DB-polling/job-runner execution as the default async execution pattern
- any future design that treats BullMQ and Postgres as competing async backends instead of execution plus durable state

## 3. Guardrails for Contributors and Agents

Use these as hard rules:
- Treat `main` as the only deployment-sensitive branch in docs, plans, and release assumptions.
- Read [`.cursorrules`](../../.cursorrules) before applying repo rules; do not treat [`agent_spec.md`](../../agent_spec.md) as authoritative.
- Build new platform/admin/operator surfaces in [`apps/platform`](../../apps/platform), not in dealer pages or dealer `/api/platform/*` routes.
- Use BullMQ for background execution. Persist workflow state, progress, audit rows, and user-visible status in Postgres.
- Do not introduce new DB-execution runners unless there is a narrowly justified exception and an explicit architecture decision documenting it.

## 4. Immediate Planning Consequences

These decisions create two active migration tracks:
1. residual dealer-side compatibility cleanup after the completed platform cutover
2. async execution convergence toward BullMQ execution with Postgres durability

See:
- [PLATFORM_SURFACE_MIGRATION_PLAN.md](./PLATFORM_SURFACE_MIGRATION_PLAN.md)
- [ASYNC_CONVERGENCE_PLAN.md](./ASYNC_CONVERGENCE_PLAN.md)

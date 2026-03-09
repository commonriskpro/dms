# Intelligence Signal Engine Spec

## Purpose

Create a tenant-scoped signal system that unifies actionable intelligence for dashboard widgets and job-driven refresh.

## Scope

- New module: `apps/dealer/modules/intelligence/`
- New API:
  - `GET /api/intelligence/signals`
  - `POST /api/intelligence/jobs/run`
  - `GET /api/intelligence/jobs/run` (cron fan-out)
- New UI primitives:
  - `apps/dealer/components/ui-system/signals/SignalCard.tsx`
  - `apps/dealer/components/ui-system/signals/SignalList.tsx`
  - `apps/dealer/components/ui-system/signals/SignalSeverityBadge.tsx`

## Domain Taxonomy

- `inventory`
- `crm`
- `deals`
- `operations`
- `acquisition`

## Canonical Signal Model

Each signal represents a current or historical condition.

- `id`: UUID
- `dealershipId`: tenant key
- `domain`: domain taxonomy value
- `code`: machine-readable signal code (example: `inventory.recon_queue`)
- `severity`: `info | success | warning | danger`
- `title`: short user-facing label
- `description`: optional detail text
- `entityType`: optional logical type (`Vehicle`, `Customer`, `Deal`, etc.)
- `entityId`: optional entity UUID (string)
- `actionLabel`: optional CTA label
- `actionHref`: optional CTA route
- `metadata`: optional JSON payload for non-PII context
- `happenedAt`: event time for sorting
- `resolvedAt`: nullable resolution marker
- `createdAt`, `updatedAt`
- `deletedAt` (soft delete per repo model rules)

## Lifecycle

- `active`: `resolvedAt IS NULL` and `deletedAt IS NULL`
- `resolved`: `resolvedAt IS NOT NULL`
- `soft-deleted`: `deletedAt IS NOT NULL` (excluded from API lists)

Generation behavior:

- If a condition is true, keep/create one active signal.
- If a condition is false, resolve previously active signal(s) for that code/domain/key.

## Explicit Dedupe Rule

Active uniqueness is explicit:

- one active signal per `(dealershipId, domain, code, entityType, entityId)` where `resolvedAt IS NULL` and `deletedAt IS NULL`.

Implementation:

- database-level partial unique index over that key for active rows
- service-level guard: find active existing row first, then update existing row instead of inserting duplicate

Resolved signals remain historical and are not part of active uniqueness.

## Initial Signals

### Inventory

- `inventory.recon_queue`
  - trigger: vehicles in `REPAIR` status > 0
  - severity: `warning`
  - action: `/inventory`
- `inventory.aged_90d`
  - trigger: vehicles older than 90 days > 0
  - severity: `danger`
  - action: `/inventory?alertType=STALE`

### CRM

- `crm.followup_overdue`
  - trigger: open customer tasks with `dueAt < now` > 0
  - severity: `warning`
  - action: `/customers`
- `crm.new_prospects`
  - trigger: open opportunities > 0
  - severity: `info`
  - action: `/crm/opportunities`

### Deals

- `deals.contracts_to_review`
  - trigger: deals in `CONTRACTED` > 0
  - severity: `warning`
  - action: `/deals`
- `deals.funding_pending`
  - trigger: finance submissions with pending funding > 0
  - severity: `danger`
  - action: `/deals`

### Operations

- `operations.title_issue_hold`
  - trigger: `DealTitle.titleStatus = ISSUE_HOLD` count > 0
  - severity: `danger`
  - action: `/deals`
- `operations.title_pending`
  - trigger: title statuses pending (not completed) > 0
  - severity: `warning`
  - action: `/deals`

### Acquisition

- `acquisition.appraisal_draft`
  - trigger: appraisals in `DRAFT` > 0
  - severity: `info`
  - action: `/inventory/acquisition`
- `acquisition.source_lead_new`
  - trigger: source leads in `NEW` > 0
  - severity: `warning`
  - action: `/inventory/acquisition`

## API Contracts

### GET `/api/intelligence/signals`

Query:

- `domain?`: one of taxonomy values
- `severity?`: one of `info | success | warning | danger`
- `limit?`: default 25, max 100
- `offset?`: default 0
- `includeResolved?`: optional boolean (default `false`)

Behavior:

- returns tenant-scoped, permission-gated list
- default lists active signals only (`resolvedAt IS NULL`)
- sorted by `happenedAt DESC`, then `createdAt DESC`

Response:

- `{ data: SignalDTO[], meta: { total, limit, offset } }`

### POST `/api/intelligence/jobs/run`

- Authenticated tenant/manual run.
- Runs generation for caller dealership only.
- No client dealership override.
- Returns per-domain counters:
  - `created`
  - `updated`
  - `resolved`
  - `unchanged`

### GET `/api/intelligence/jobs/run`

- Cron mode for all dealerships.
- Requires `Authorization: Bearer <CRON_SECRET>`.
- Ignores request query/body for dealership selection.
- Fan-out with bounded concurrency.

## RBAC Mapping

Reuse existing permissions (no new permission keys):

- `inventory` -> `inventory.read`
- `crm` -> `crm.read` OR `customers.read`
- `deals` -> `deals.read`
- `operations` -> `deals.read`
- `acquisition` -> `inventory.acquisition.read` (fallback `inventory.read`)
- job run (manual) -> `inventory.read` OR `crm.read` OR `deals.read`

## Tenant Isolation Rules

- All reads and writes include `dealershipId` from auth context.
- Never accept `dealershipId` from body/query.
- Cross-tenant entity references are treated as missing/not found.

## Security and Data Handling

- Do not persist restricted PII in `metadata`.
- No SSN, DOB, income, card, tokens, raw auth payloads.
- Do not expose stack traces in API responses.

## UI Integration Rules

- Dashboard widgets consume `GET /api/intelligence/signals?domain=<domain>`.
- Rendering uses `apps/dealer/components/ui-system/signals/` primitives.
- Widgets must support loading, empty, and error states.

## Testing Requirements

- Unit tests for dedupe/resolve lifecycle.
- Route tests for:
  - validation and pagination
  - RBAC denial paths
  - cron secret enforcement
  - tenant fan-out behavior


# Dashboard VFinal Security-QA

## Scope

Step 4 security/QA pass for Dashboard VFinal composition and widgets:

- KPI row (including Health / Ops Score)
- row-2 workbench + pipeline
- row-3 inventory summary, messaging/acquisition, activity/tasks
- dashboard signal/action link behavior

No route/API contract rewrites and no RBAC model changes were introduced.

## Verification checklist (requested areas)

## 1) KPI and lower-stack widgets do not surface unauthorized data

Validated:

- KPI cards are gated by existing permissions:
  - Inventory KPI -> `inventory.read`
  - Leads KPI -> `crm.read`
  - Active Deals KPI -> `deals.read`
  - Gross/BHPH KPI -> `lenders.read`
- Lower-stack cards are shown only when related permissions are present.
- Where a block remains visible for composition continuity, it uses safe “unavailable” copy rather than domain data.

Hardening applied:

- row-2 left workbench now requires `inventory.read` for visibility; otherwise a non-data unavailable state is shown.

## 2) Inventory/acquisition widgets use permission-gated visibility (not only fetch suppression)

Validated:

- Inventory workbench is now visibility-gated by `inventory.read`.
- Acquisition panel is now visibility-gated by acquisition/inventory read permission (`inventory.acquisition.read` or `inventory.read`), not merely fetch-gated.

Hardening applied:

- `DashboardExecutiveClient` now conditionally renders `InventoryWorkbenchCard` and `AcquisitionInsightsCard` based on permission checks.

## 3) Activity and messaging blocks do not expose cross-tenant or over-broad content

Validated:

- Messaging panel remains backed by already-scoped dashboard data (`getDashboardV3Data` dealership scope).
- Activity panel now requires both CRM and Deals read permissions before rendering deal-derived activity summaries.
- Tenant scoping remains server-enforced through existing auth context + dealership-scoped service queries.

Hardening applied:

- Activity card render gate tightened to `canCrm && canDeals`.

## 4) Deal pipeline and workbench blocks respect existing route/action permissions

Validated:

- Deal Pipeline panel visibility tied to `deals.read`.
- Workbench quick action buttons still rely on existing write permission checks:
  - add vehicle -> `inventory.write`
  - add lead -> `customers.write`
  - start deal -> `deals.write`
- Links route to existing guarded pages/routes; no permission bypass was introduced.

## 5) Health / Ops Score does not mix unauthorized domains

Validated:

- Health score aggregation now explicitly counts only domains the user is authorized to view:
  - inventory signal severities included only with `inventory.read`
  - deal signal severities included only with `deals.read`
  - operations notices included only with `lenders.read`

Hardening applied:

- Aggregation logic in `DashboardExecutiveClient` updated to permission-guard each domain contribution.

## 6) Signal/action links do not bypass existing guards

Validated:

- Dashboard links are UI affordances only; destination routes retain existing server-side RBAC/tenant checks.
- No new direct data endpoints or bypass handlers were introduced in this pass.
- Signal-derived links continue to use existing app routes under existing guards.

## Test and sanity status

- Focused dashboard tests pass after hardening:
  - `app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`
  - `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx`
- Result: all targeted suites and tests passing.

## Residual risk notes

1. Dashboard remains a mixed server + client refresh model; permission checks are now explicit at render boundaries for affected blocks.
2. Link-level authorization remains route-enforced (correct pattern), but UX can still navigate to guarded pages and receive access denial where appropriate.

## Conclusion

Dashboard VFinal now satisfies the Step 4 security-QA requirements for permission-gated visibility, tenant-safe data boundaries, and safe aggregation/link behavior without changing backend security contracts.

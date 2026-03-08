# UI Reconstruction Roadmap

Purpose: phased implementation order for enterprise UI reconstruction with minimal risk and no breaking refactors.

## Phase 1 - Layout Foundation

Scope:
- Sidebar architecture
- Global header
- Search/command entry
- Shared page shell

Deliverables:
- Implement `PageShell`, `PageHeader`, `FilterBar`, `ContextRail`.
- Align sidebar to `UI_NAVIGATION_ARCHITECTURE.md`.
- Standardize status badges and shared spacing/tokens.

Validation:
- Works across `/dashboard`, `/inventory`, `/deals`, `/customers` without route changes.
- No regression to existing auth/permission-gated visibility.

## Phase 2 - Core Workflows

Scope:
- Dashboard
- Inventory
- CRM
- Deals

Deliverables:
- Dashboard widget standardization.
- Inventory table/detail shell alignment.
- CRM board/table/detail shell alignment.
- Deal workspace section alignment.

Validation:
- Core APIs untouched; only presentation composition changes.
- Existing module services continue to back all interactions.

## Phase 3 - Operations

Scope:
- Title
- DMV
- Delivery
- Funding

Deliverables:
- Shared `QueueTable` pattern across queue pages.
- Unified queue filters, status chips, and action affordances.
- Consistent operational context rails.

Validation:
- Queue actions preserve current endpoints and permissions.
- No change to state transition business rules.

## Phase 4 - Finance

Scope:
- Floorplan
- Accounting

Deliverables:
- Floorplan visual surfaces in inventory/deal contexts.
- Accounting page shell consistency for accounts/transactions/expenses.
- Finance/compliance panels standardized in deal workspace.

Validation:
- Money display remains tokenized and formatting-safe.
- Finance write paths preserve lock/business rules.

## Phase 5 - Reports

Scope:
- Analytics
- Intelligence dashboards

Deliverables:
- Reports hub consistency.
- Specialized report page layout unification.
- Export action standardization.

Validation:
- Report filters and export URLs remain backward-compatible.

## Phase 6 - Admin

Scope:
- Users
- Permissions
- Settings

Deliverables:
- Unified admin shell for users/roles/audit/dealership/settings/files.
- Consistent form/table patterns for role and membership management.

Validation:
- RBAC and permission checks unchanged.
- Admin APIs consumed with existing contracts.

## Cross-Phase Workstreams

- Accessibility:
  - keyboard nav, focus management, aria semantics.
- Performance:
  - server-first rendering, progressive hydration, list virtualization where needed.
- QA:
  - page-by-page visual regression checks.
  - permission matrix smoke checks per nav domain.

## Rollout Strategy

- Incremental by route group, not by full app rewrite.
- Keep old and new shells swappable behind local feature flags when needed.
- Stabilize each phase before starting the next.

## Exit Criteria

- Every primary domain in navigation has a consistent shell and reusable patterns.
- Every backend capability from `SYSTEM_MASTER_MAP` has an intentional UI entry.
- No route breaks, no module boundary violations, and no API contract changes.

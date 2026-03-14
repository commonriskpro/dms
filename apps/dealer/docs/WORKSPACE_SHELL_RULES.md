# Workspace Shell Rules

Purpose: define how the dealer app presents itself as a set of **workspaces** (Sales, Inventory, Manager, Admin) plus **daily work** (CRM, Deals, Queues, Reports, etc.) so the experience is consistent and role-based.

## 1. Role-based landing (home)

When a user hits `/` after login, redirect by role (first match wins):

| Role intent | Condition | Destination |
|-------------|-----------|-------------|
| **Admin/Setup** | Has any admin permission and no Sales/Inventory | First admin route they have access to: Dealership → Users → Roles → Audit → Dealership |
| **Sales workspace** | Has `crm.read` or `deals.read` or `customers.read` | `/sales` |
| **Inventory workspace** | Has `inventory.read` | `/inventory` |
| **Manager workspace** | Has `dashboard.read` or `reports.read` | `/dashboard` |
| **Fallback** | `documents.read` only | `/files` |
| **Default** | Otherwise | `/dashboard` |

Implementation: `apps/dealer/app/page.tsx`. Permission gating is unchanged; only the destination order and grouping are role-oriented.

## 2. Navigation structure

- **Workspaces** (sidebar group): Sales, Inventory, Manager (dashboard), Admin. These are the main landing surfaces.
- **Daily work** (sidebar group): CRM, Customers, Deals, Title & DMV, Delivery & Funding, Tasks, Reports, Intelligence, Website, Integrations. These are task/queue/module entry points.

Rules:

- Sidebar uses `APP_NAV_GROUPS` in `navigation.config.ts`. No one-off links outside this config.
- Permission arrays on each item control visibility; no bypass.
- Admin is an expandable item with children: Dealership, Users & Roles, Audit.
- Command bar (TopCommandBar) stays global: search, quick create, theme, notifications, user. No workspace-specific command bar; workspaces use in-page quick actions.

## 3. Shared workspace page pattern

Every workspace (and any new one) should follow the same layout slots so the shell is predictable:

| Slot | Purpose | Primitives |
|------|---------|------------|
| **Page header** | Title, description, breadcrumbs, meta (counts/status), primary/secondary actions | `PageHeader` from `@/components/ui-system/layout` or `@/components/ui/page-shell` |
| **Summary strip** | KPI row or key metrics at a glance | Custom content; use `KpiCard` / widget tokens from ui-system |
| **Quick actions** | 1–3 primary actions (e.g. Add vehicle, New deal) | Buttons/links; optional when header actions are enough |
| **Quick filters** | Search, faceted filters, view toggles; URL as source of truth | `layoutTokens.filterBar` or custom bar using same token |
| **Main canvas** | Primary content (grid, table, board, widgets) | Page content; use `PageShell` or `WorkspacePageLayout` |
| **Context rail** | Optional right column: exceptions, next actions, related | `PageShell` `rail` prop or `WorkspacePageLayout` `rail`; use `layoutTokens.contextRail` for surface |

Implementation options:

- **Option A**: Compose manually with `PageShell`, `PageHeader`, and layout tokens (current Sales/Inventory pattern).
- **Option B**: Use `WorkspacePageLayout` from `@/components/ui-system/layout` and pass slots (header, summaryStrip, quickFilters, rail, children). Use for new workspaces or refactors.

Both are valid. New workspaces should prefer Option B for consistency.

## 4. App shell (unchanged)

- **Layout**: `AppShell` in `(app)/layout.tsx` only. No AppShell elsewhere.
- **Main content area**: Banners (support, unverified email, suspended) → Topbar (TopCommandBar) → scrollable main with `px-4 py-4 lg:px-6 lg:py-5`.
- **Sidebar**: Collapsible; width from `AppShell`. Navigation from `APP_NAV_GROUPS`.

Command bar and shell are not workspace-specific; they stay global and align to the workspace model by virtue of role-based home and workspace-first nav.

## 5. Do not

- Redesign from scratch or remove existing capability.
- Add one-off page patterns that future workspaces cannot reuse.
- Put workspace-specific UI in the global command bar or shell (use in-page quick actions and filters).
- Bypass permission checks on nav or landing.
- Introduce new nav groups or links outside `navigation.config.ts` without updating this doc.

## 6. References

- Role-based redirect: `apps/dealer/app/page.tsx`
- Nav config: `apps/dealer/components/ui-system/navigation/navigation.config.ts`
- Layout primitives: `apps/dealer/components/ui-system/layout/` (PageShell, PageHeader, WorkspacePageLayout)
- Tokens: `apps/dealer/lib/ui/tokens.ts` (layoutTokens, navTokens)
- Page layout standard: `docs/UI_PAGE_LAYOUT_STANDARD.md`

# CTA Normalization Audit — Sprint Summary

## 1. Current CTA Map

| Workspace | Primary job | Main action type | Primary CTA (current) | Secondary / quick actions |
|-----------|-------------|------------------|------------------------|----------------------------|
| **Sales** | Intake + commercial action | create | New opportunity | Add lead, New deal; Command center, Pipeline, Inbox, Customers, Deals |
| **Customers (overview)** | Relationship + follow-up | create | Add lead (header) + **Create customer** (board) | Open List; Sales, Command center, Deals |
| **Customers (list)** | List execution | create | Add lead | Open Overview; Sales, Command center, Deals |
| **Inventory (overview)** | Intake + ops | create | Add vehicle | Open List; Aging, Pricing, Import |
| **Inventory (list)** | List execution | create | Add vehicle | Open Overview; Aging, Pricing |
| **Deals (board)** | Structure / close | create | New deal | Sales, Customers, Command center, Pipeline |
| **CRM Command center** | Queue / resolve | review/resolve | (none) | Sales, Customers, Pipeline, Inbox, Deals |
| **Operations** | Queue health | review | View queue (cards) | — |
| **Websites** | Configure | configure/review/publish | Visit site (when LIVE) | — |
| **TopCommandBar** | Quick create | create | Add Vehicle, Add Lead, New Deal | — |

## 2. CTA Inconsistencies

1. **Customers workspace — lead vs customer language drift**
   - Header uses **"Add lead"**; the Command Board section uses **"Create customer"** for the same action (link to `/customers/new`). Same intent, two labels.
   - Filter bar and table card use **"New Customer"** while list/overview headers use **"Add lead"**.

2. **Deals — case inconsistency**
   - Page header: **"New deal"** (sentence case).
   - DealBoardKpiStrip and DealBoardFilterBar: **"New Deal"** (title case). Should match header.

3. **Inventory — case and wording**
   - Workspace headers: **"Add vehicle"** (sentence case).
   - InventoryQuickActionsCard: **"+ Add Vehicle"** (title case).
   - VehicleInventoryTable: **"Add Vehicle"** (title case).
   - QuickActionsCard also uses **"+ Add Lead"** and **"Start Deal"**; **"Add lead"** and **"New deal"** align with other workspaces.

4. **Open List / Open Overview**
   - Consistent: from overview → "Open List"; from list → "Open Overview". No change.

## 3. Highest-Value Normalization Changes

1. **Customers**: Use a single creation label in the workspace. Standardize on **"Add lead"** for all workspace-level creation CTAs (header, Command Board, filter bar, table card). Keep form submit as **"Create Customer"** on the create page.
2. **Deals**: Use **"New deal"** everywhere (KpiStrip, FilterBar) to match header.
3. **Inventory**: Use **"Add vehicle"** (sentence case) in QuickActionsCard and VehicleInventoryTable; **"Add lead"** and **"New deal"** in QuickActionsCard for consistency with Sales/Deals.
4. **CRM / Operations / Websites**: No CTA changes; primary actions already match queue/configure/review paradigm.

## 4. CTA Rules Applied (from sprint spec)

- **Sales**: Remain intake + commercial; strong creation CTAs — no change.
- **Customers**: One clear primary creation CTA; avoid lead vs customer drift — standardize on "Add lead" for workspace, "Create Customer" for form submit.
- **Inventory**: Strong intake CTA kept; secondary actions (Aging, Pricing, Open List) already surfaced — only case/wording fixes.
- **Deals**: Strong local "New deal" CTA; reduce reliance on top bar only — already present; case normalization only.
- **CRM / Operations**: Queue/review/resolve — no generic create in header; already correct.
- **Websites**: Configure/review/publish — no "create website"; already correct.

## 5. Files Changed (and applied)

| File | Change |
|------|--------|
| `apps/dealer/modules/customers/ui/CustomersPageClient.tsx` | Command Board CTA "Create customer" → "Add lead" |
| `apps/dealer/modules/customers/ui/components/CustomersFilterSearchBar.tsx` | "New Customer" → "Add lead" |
| `apps/dealer/modules/customers/ui/components/CustomersTableCard.tsx` | "New Customer" → "Add lead" |
| `apps/dealer/modules/deals/ui/board/DealBoardKpiStrip.tsx` | "New Deal" → "New deal" |
| `apps/dealer/modules/deals/ui/board/DealBoardFilterBar.tsx` | "New Deal" → "New deal" |
| `apps/dealer/modules/inventory/ui/components/InventoryQuickActionsCard.tsx` | "+ Add Vehicle" → "Add vehicle"; "+ Add Lead" → "Add lead"; "Start Deal" → "New deal" |
| `apps/dealer/modules/inventory/ui/components/VehicleInventoryTable.tsx` | "Add Vehicle" → "Add vehicle" |

## 6. Tests / Commands Run

- `npx jest modules/customers modules/inventory/ui/components/InventoryQuickActionsCard` — **132 tests passed.** (Deals board has no dedicated CTA text tests; manual check.)
- TopCommandBar tests not run to completion (Jest OOM in env); TopCommandBar labels were **not** changed per sprint (keep quick-create as-is).
- Lint: no new issues on changed files.

## 7. Final CTA Normalization Summary

After implementation:

- **Customers**: Single workspace creation label **"Add lead"** (header, board, filter, table). Form submit remains **"Create Customer"**.
- **Deals**: **"New deal"** used consistently in header, KpiStrip, and FilterBar.
- **Inventory**: **"Add vehicle"** (sentence case) in all workspace/list surfaces; **"Add lead"** and **"New deal"** in InventoryQuickActionsCard.
- **Sales, CRM, Operations, Websites, TopCommandBar**: Unchanged; already aligned with rules.

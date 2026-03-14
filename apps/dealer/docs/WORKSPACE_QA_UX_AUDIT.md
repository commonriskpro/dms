# Workspace QA + Consistency + Flow Polish — UX Audit

**Branch:** ui-remix  
**Sprint:** Product-UX hardening (no backend/redesign).  
**Date:** 2025-03-14

---

## 1. UX AUDIT SUMMARY

### Areas inspected

- **Landing:** `apps/dealer/app/page.tsx` — role-based redirect (Admin → Sales → Inventory → Manager → fallback).
- **Navigation:** `navigation.config.ts` — Workspaces (Sales, Inventory, Manager, Admin) + Daily work (CRM, Customers, Deals, Operations, Reports, Intelligence, Websites, Integrations).
- **Workspaces:** Sales, Inventory (overview/list), Customers (overview/list), CRM Command Center, Deals pipeline, Manager dashboard, Websites, Operations.

### Per-workspace evaluation (A–F)

| Workspace   | Orientation | Hierarchy | Primary action | Context | Speed | Consistency |
|------------|-------------|-----------|----------------|--------|-------|-------------|
| Sales      | Good        | Good      | Good           | Good   | Good  | Minor copy drift |
| Inventory  | Good        | Good      | Good           | Good   | Good  | Strong (Overview/List) |
| Customers  | Good        | Good      | Good           | Good   | Good  | Strong (Overview/List) |
| CRM        | Good        | Good      | Good           | Good   | Good  | "Command center" vs "Live follow-up queue" |
| Deals      | Good        | Good      | Good           | Good   | Good  | Cross-links present |
| Manager    | Good        | Good      | Good           | Good   | Good  | Preset labels consistent |
| Websites   | Good        | Good      | Good           | Good   | Good  | Empty state platform-only |
| Operations | Good        | Good      | Good           | Good   | Good  | No-access copy clear |

---

## 2. TOP FRICTION POINTS (ranked)

1. **Commercial journey clarity** — Sales, CRM, Customers, Deals feel like four separate homes; the narrative "Lead → contact → opportunity → deal" appears in places but is not consistently reinforced with cross-links and one-line purpose copy.
2. **Language drift** — "Command center" (nav) vs "Live follow-up queue" (CRM page title); "Add lead" vs "Create customer" in Customers; "Open List" vs "Open Overview" vs "List" vs "Overview" wording inconsistent.
3. **Overview vs List** — Inventory and Customers have explicit toggles; Deals has no Overview/List split (correct); CRM uses "Command Center" as one view. Need consistent subtitle pattern: "Overview — [purpose]. List — [purpose]."
4. **Empty / first-run** — Sales shows "My sales" with "No CRM or customer data" (good); Websites "Website not provisioned" is platform-only (no dealer first action); Operations no-access is clear; Customers list empty state has CTA; Inventory overview/list empty could be more guided.
5. **Primary CTA placement** — Most workspaces put primary CTA in header; quick-action rows sometimes duplicate (e.g. "Add lead" in header and in row). Standardize: one primary in header, secondary in quick-actions.
6. **Nav grouping** — "Daily work" contains CRM, Customers, Deals, Operations; "Workspaces" has Sales, Inventory, Manager, Admin. Sales is the commercial home but CRM/Customers/Deals sit in Daily work; naming doesn’t signal "one journey."

---

## 3. CONSISTENCY ISSUES (grouped)

- **Page titles:** "Vehicle inventory" / "Live inventory list" vs "Customers" / "Live follow-up queue" — mix of short title vs long. Standardize to: **Workspace name** + optional "· Overview" or "· List" in eyebrow.
- **Subtitles:** Some use "Overview — …" others use full sentence. Standardize: one short line for orientation + optional second for next step.
- **Action buttons:** "Add lead" vs "Add vehicle" vs "New opportunity" vs "New deal" — keep domain terms but use consistent pattern: "[Add|New] [entity]."
- **Empty states:** Mix of "No X yet" / "Add your first…" / "Get started." Prefer: title "No [entity] yet", description one sentence, single CTA "Add [entity]" or "New [entity]."
- **Quick-actions row:** "Open List" / "Open Overview" vs "Command center" / "Pipeline" — use "Open List" and "Open Overview" where Overview/List exists; keep "Command center" / "Pipeline" / "Deals" / "Sales" as destination names.

---

## 4. HIGH-VALUE IMPROVEMENTS (shortlist for this sprint)

1. **Commercial journey (top priority):** Add one-line purpose under each of Sales, CRM, Customers, Deals that references the same journey; add/align cross-links (Sales → CRM, Customers, Deals; CRM → Sales, Customers, Deals; etc.).
2. **Standardize workspace page language:** Shared pattern for title/eyebrow, subtitle, and "Overview" / "List" where applicable; align action button labels.
3. **Overview/List:** Keep Inventory and Customers as-is; ensure Inventory List and Customers List headers and quick-actions use "Open Overview" consistently; add one-line "why Overview vs List" in subtitles where guidance exists.
4. **Empty states:** Improve Sales empty (already has CTA); add concise first-step copy for Websites (dealer-facing); ensure Customers and Inventory empty states use same pattern (title + description + CTA).
5. **Power-user speed:** Keep quick-actions row in every main workspace; ensure "Open List" / "Open Overview" and primary create (Add vehicle, Add lead, New deal, New opportunity) are above the fold and consistent.
6. **Consistency pass:** One pass on spacing, CTA placement, and microcopy so all workspaces feel like one system.

---

## 5. FILES TO CHANGE (planned)

- `apps/dealer/components/sales/SalesHubClient.tsx` — commercial copy, cross-links, empty state.
- `apps/dealer/components/ui-system/navigation/navigation.config.ts` — optional sublabel/tooltip (if supported); else rely on page copy.
- `apps/dealer/modules/inventory/ui/InventoryPageContentV2.tsx` — title/description alignment, quick-actions.
- `apps/dealer/modules/inventory/ui/InventoryListContent.tsx` — title/description, quick-actions.
- `apps/dealer/modules/customers/ui/CustomersPageClient.tsx` — title/description, commercial copy, quick-actions.
- `apps/dealer/modules/customers/ui/CustomersListContent.tsx` — title/description, empty state copy.
- `apps/dealer/modules/crm-pipeline-automation/ui/CrmCommandCenterPage.tsx` — title/description, commercial copy, quick-actions.
- `apps/dealer/modules/deals/ui/board/DealPipelineBoard.tsx` — description, quick-actions.
- `apps/dealer/modules/deals/ui/OperationsOverviewPage.tsx` — description, empty/no-access copy.
- `apps/dealer/modules/websites-core/ui/WebsiteOverviewPage.tsx` — description, empty state (dealer-first message).
- `apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx` — optional subtitle tweak for "Manager" workspace.

---

## 6. CHANGES APPLIED (sprint implementation)

### Commercial journey (Sales, CRM, Customers, Deals)

- **Sales (`SalesHubClient.tsx`):** Description set to "Your commercial home: what needs attention now… Lead → contact → opportunity → deal." Empty state title "Sales workspace", clearer copy and Dashboard + Open Deals CTAs. Quick-actions: added Customers link; "Deals in motion" strip now "Deals — structure, contract, title, funding" with Open Deals / New deal.
- **CRM (`CrmCommandCenterPage.tsx`):** Description references "Use Sales for your day view; Deals when ready to structure and close." Quick-actions: added Customers (gated by `customers.read`).
- **Deals (`DealPipelineBoard.tsx`):** Description set to "Structure, contract, title, delivery, funding. The deal stage of the journey… For follow-up and pipeline, use Sales or CRM." Actions: added "New deal" primary (when `deals.write`) and Customers link (gated by `customers.read`).
- **Customers (`CustomersPageClient.tsx`, `CustomersListContent.tsx`):** Overview description references journey and "Use List for search and table; Sales or CRM for your day queue." Quick-actions row: Sales, Command center (gated), Deals (gated), Open List. List page: same journey quick-actions (Sales, Command center, Deals gated).

### Standardized language and Overview/List

- **Inventory:** Overview description "Overview — what needs attention and what to do next. Use List for filters, sort, and execution." List description "List — filter, sort, and act. Use Overview for exceptions and decision context."
- **Operations:** Description "Queue health and where to intervene… Part of the deal flow after structure and contract." No-access copy includes links to Deals and CRM.

### Empty states and first-run

- **Sales:** Empty state clarified with "This is your home for the full journey…" and Dashboard + Open Deals CTAs.
- **Customers list:** Empty state description "Add your first lead to start the journey: lead → contact → opportunity → deal." Filter-empty copy "Clear filters or change status to see more."
- **Inventory list:** Filter-empty copy "Clear filters or change status to see more."
- **Websites:** Empty state title "No website yet", copy "Contact your platform administrator… Once it's set up, you'll configure theme, pages, and publish from here."

### Tests

- **Sales page test:** Updated expectations to new copy ("Your commercial home: what needs attention now", "No CRM or customer data for your role yet").

### Files touched

- `apps/dealer/components/sales/SalesHubClient.tsx`
- `apps/dealer/modules/crm-pipeline-automation/ui/CrmCommandCenterPage.tsx`
- `apps/dealer/modules/deals/ui/board/DealPipelineBoard.tsx`
- `apps/dealer/modules/customers/ui/CustomersPageClient.tsx`
- `apps/dealer/modules/customers/ui/CustomersListContent.tsx`
- `apps/dealer/modules/inventory/ui/InventoryPageContentV2.tsx`
- `apps/dealer/modules/inventory/ui/InventoryListContent.tsx`
- `apps/dealer/modules/deals/ui/OperationsOverviewPage.tsx`
- `apps/dealer/modules/websites-core/ui/WebsiteOverviewPage.tsx`
- `apps/dealer/app/(app)/sales/__tests__/page.test.tsx`

---

## 7. UNRESOLVED UX FOLLOW-UPS

- Role-based landing for mixed-role users: consider "last workspace" or preference (out of scope for this sprint).
- Nav grouping: "Daily work" vs "Workspaces" could later be relabeled to signal one commercial journey (copy-only, no structural change).
- Manager dashboard: optional subtitle alignment with "Health, risk, and attention" (left as-is).

---

*End of audit and sprint summary.*

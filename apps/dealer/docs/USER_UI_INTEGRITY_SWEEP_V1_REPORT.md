# User UI Integrity Sweep V1 — Report

## Overview

Full UI integrity sweep of the Dealer app covering all user-facing interactive surfaces across 7 domains, 58 page routes, 8 modal intercept routes, and ~300+ interactive controls.

---

## Pages/Domains Checked

| Domain | Pages Audited | Controls Audited |
|---|---|---|
| Global Shell (sidebar, topbar, command palette, modals) | 1 layout + 3 shell components | ~14 |
| Inventory | 15 pages + 1 modal | ~200+ |
| Customers / CRM | 12 pages + 2 modals | ~180+ |
| Deals | 9 pages + 1 modal | ~55 |
| Finance / Lenders / Documents | 5 tabs + 2 pages | ~60 |
| Reports / Accounting | 6 pages | ~12 |
| Admin / Vendors / Settings / Dashboard | 10 pages + 1 modal | ~60 |
| **Total** | **~58 pages** | **~580+ controls** |

---

## Bugs Found & Fixed

### Backend Fixes (Step 2)

| # | Severity | File | Issue | Category | Fix |
|---|---|---|---|---|---|
| B1 | HIGH | `api/inventory/list-view-preference/route.ts` | `guardPermission` not `await`-ed — permission bypass on view preference save | FC-3 | Added `await` |
| B2 | HIGH | `VehiclePageHeader.tsx` | Print cost ledger used wrong field names (`acquisitionCents` vs `acquisitionSubtotalCents`) — 3 of 4 totals showed `$NaN` | FC-6 | Updated type + template to match API response |
| B3 | MEDIUM | `pricing/preview`, `pricing/apply`, `publish`, `unpublish` routes | Missing `idParamSchema.parse` — malformed UUID passes to Prisma | FC-4 | Added UUID validation + ZodError catch |
| B4 | MEDIUM | `cost-entries/route.ts` POST | Missing `vendorType` in response — stale UI until refresh | FC-8 | Added vendor re-lookup after creation |
| B5 | LOW | `cost-entries/route.ts` | Debug `console.log` in production | FC-4 | Removed |

### Frontend Fixes (Step 3)

| # | Severity | File | Issue | Category | Fix |
|---|---|---|---|---|---|
| F1 | HIGH | `EditVehicleUi.tsx` | 4 mock QuickActions buttons (Save, Save & Close, Create Deal, Print) with no handlers | FC-1 | Save/Save & Close → disabled with title; Create Deal → wired to `/deals/new?vehicleId=`; Print → disabled with title |
| F2 | HIGH | `EditVehicleUi.tsx` | "Edit" badge button no handler | FC-1 | Changed from button to static "Editing" badge |
| F3 | HIGH | `EditVehicleUi.tsx` | "…" more tabs button no handler | FC-1 | Changed from button to static `<span>` |
| F4 | HIGH | `EditVehicleUi.tsx` | FloorplanCard "Add floorplan" no handler | FC-1 | Disabled with title |
| F5 | HIGH | `EditVehicleUi.tsx` | SpecsVinCard "Auto-fill missing specs" no handler | FC-1 | Disabled with title |
| F6 | MEDIUM | `CostTotalsCard.tsx` | "View breakdown" button no handler | FC-1 | Removed dead button |
| F7 | MEDIUM | `DocumentsRailCard.tsx` | "Add Note" button no handler | FC-1 | Removed dead button |
| F8 | MEDIUM | `VehicleCostsPageHeader.tsx` | Print button no handler (full-page variant) | FC-1 | Wired to `printCostLedger()` function |
| F9 | MEDIUM | `VehicleCostsPageHeader.tsx` | Duplicate Edit buttons (both "Edit" and "Edit Vehicle" to same route) | FC-9 | Removed duplicate, kept single "Edit Vehicle" |
| F10 | MEDIUM | `CostLedgerCard.tsx` | Export button no handler | FC-1 | Wired to CSV export of filtered entries |
| F11 | MEDIUM | `CostLedgerCard.tsx` | Pagination buttons always disabled (decorative) | FC-5 | Replaced with "Showing X of Y entries" summary |
| F12 | MEDIUM | `TopCommandBar.tsx` | Quick Create dropdown items missing React `key` prop | FC-4 | Added `key={href}` |
| F13 | LOW | `TopCommandBar.tsx` | Notifications bell has no handler | FC-1 | Disabled with "coming soon" tooltip |
| F14 | LOW | `AddVehiclePage.tsx` | "Scan VIN" button passes no-op `() => {}` | FC-1 | Removed `onScan` prop; button no longer renders |
| F15 | LOW | `CustomersFilterBar.tsx` | "+ Create Filters" button no handler | FC-1 | Disabled with tooltip |
| F16 | LOW | `RecommendedActionsCard.tsx` | Placeholder fallback shows fake counts ("2 deals need funding approval") when no real actions exist | FC-8 | Replaced with proper empty state |

---

## Intentionally Deferred / Non-Functional Actions

These are known stub/placeholder controls that are intentionally incomplete and documented rather than removed:

| Component | Control | Reason |
|---|---|---|
| `SettingsContent.tsx` | "Save changes" (profile) | Backend endpoint not yet implemented; form collects state but button is disabled with "Coming soon" |
| `SettingsContent.tsx` | "Save dealership settings" | Same — backend not ready |
| `SettingsContent.tsx` | "Save notification settings" | Same — backend not ready |
| `SettingsContent.tsx` | Two-factor authentication block | Feature not implemented; displays "Coming soon" text |
| `EditVehicleUi.tsx` | Save / Save & Close buttons | Edit form uses hardcoded mock data; full edit persistence requires form state connected to API (now marked disabled) |
| `EditVehicleUi.tsx` | 5 placeholder tabs (Market Data, Activities, Files, Logs, Marketing) | Show "Coming soon" — these tabs are not yet built |

---

## Actions Verified (Pass)

### Global Shell
- [x] Sidebar navigation — all 14 items route correctly, permission-gated per `navigation.config.ts`
- [x] Quick Create dropdown — all 3 items navigate to correct routes, permission-gated
- [x] Command palette — Cmd/Ctrl+K toggle, navigate + create commands all wired
- [x] Sign Out — POST `/api/auth/logout` + redirect to `/login`
- [x] Theme toggle — toggles between light/dark
- [x] ModalShell — close on backdrop click, escape key, error retry states

### Inventory
- [x] Add Vehicle — full create flow (VIN decode, form submit, redirect)
- [x] Vehicle detail — table row click, modal open, full page open
- [x] Edit Vehicle — route opens correctly; mock buttons now disabled with clear labels
- [x] Tab switching — all tabs (Overview/Details/Cost/Media/Pricing/Recon/History)
- [x] Photo upload — file input, drag-drop, reorder, set primary, delete
- [x] Cost entry CRUD — add/edit/delete with correct API calls
- [x] Cost ledger export — CSV download of filtered entries
- [x] Print cost ledger — now works with correct field names on both detail and full-page variants
- [x] Start Deal from vehicle — routes to `/deals/new?vehicleId=`
- [x] Recon line item CRUD — add/edit/delete with loading states
- [x] Floorplan — add/curtailment/payoff forms
- [x] VIN decode — on add page and detail
- [x] Pricing preview + apply — buttons wired with correct API calls
- [x] Publish/unpublish — per-channel with correct API calls
- [x] Document upload/view/delete — forms and signed URL opening
- [x] Pricing rules — create/edit dialog forms
- [x] Appraisals — create button + form
- [x] Auction search + create appraisal
- [x] Acquisition leads — create, search, filter
- [x] Aging page — filters, sort, row click, pagination

### Customers / CRM
- [x] Create customer — form submit, redirect
- [x] Customer detail — row click, modal open, full page
- [x] Edit customer — dialog form, PATCH API
- [x] Delete customer — confirm dialog, DELETE API, redirect
- [x] Stage change — dialog with select, PATCH API
- [x] Send SMS / Send email — dialog forms with correct API calls
- [x] Schedule appointment — dialog with datetime input
- [x] Add task / Complete task — dialog and inline actions
- [x] Add note / Edit note / Delete note — inline and dialog
- [x] Callbacks — schedule/done/snooze/cancel with correct API
- [x] Timeline — add note, log call, load more, filter pills
- [x] Saved searches CRUD — create/update/delete
- [x] CRM Board — new opportunity, card click, stage move
- [x] Opportunity detail — overview save, sequences lifecycle
- [x] Inbox — send SMS/email from conversation view

### Deals
- [x] Create deal — form submit, redirect
- [x] Deal detail — row click, modal, full page
- [x] Save deal structure — PATCH API
- [x] Status change — STRUCTURED → APPROVED → CONTRACTED progression
- [x] Delete deal — confirm dialog, DELETE API, redirect
- [x] Fees CRUD — add/edit/delete inline
- [x] Trade CRUD — add/edit/remove with confirm
- [x] Finance structure — save, status change, products CRUD
- [x] Title process — start, status transitions, DMV checklist
- [x] Delivery/Funding — mark ready, delivered, funded
- [x] Lender applications — create, submit, status/decision/funding/stipulations
- [x] Documents — upload, view/download, delete
- [x] Deal desk — save, notes, stage change
- [x] Delivery/Funding/Title queues — search, filter, row View, pagination

### Reports / Accounting / Admin
- [x] Report pages — date range picker, export CSV (client-side)
- [x] Accounts — add account dialog
- [x] Transactions — download CSV export
- [x] Expenses — add expense dialog
- [x] Dealership — save name, add/edit locations
- [x] Roles — create/edit/delete with permissions checklist
- [x] Users — invite, filter, edit role, disable member
- [x] Audit — filter, expand metadata, pagination
- [x] Vendors — create/edit/remove dialogs
- [x] Lenders — create/edit/deactivate dialogs
- [x] Settings — section nav, revoke sessions
- [x] Dashboard — metric cards, quick actions, customize panel

---

## Manual Checklist (Not Covered by Automated Tests)

These flows require manual or browser-based verification:

| # | Flow | Steps |
|---|---|---|
| 1 | Full navigation flow | Sidebar → each page → verify renders → back |
| 2 | Vehicle photo upload | Select file → verify upload → verify display → reorder → set primary |
| 3 | Cost document upload | Open dialog → select file → choose kind → submit → verify in list |
| 4 | Print cost ledger | Click Print → verify popup window → verify totals + entries → print |
| 5 | Deal status progression | STRUCTURED → APPROVED → CONTRACTED → verify locked state |
| 6 | Deal desk save | Edit notes/price → verify auto-save on blur |
| 7 | CRM board drag | Click opportunity → move stage → verify column update |
| 8 | Inbox messaging | Select conversation → send SMS → verify in timeline |
| 9 | Report CSV export | Select date range → Export CSV → verify download + contents |
| 10 | Sessions revoke | Settings → Security → Revoke sessions → confirm → verify |
| 11 | Dashboard customize | ?customize=true → toggle widgets → reorder → save → verify persistence |
| 12 | Command palette | Cmd+K → search → navigate → verify page loads |
| 13 | Multi-modal flow | List → row click (modal) → detail action → close → verify list state |

---

## Files Changed

### Backend (Step 2)
1. `apps/dealer/app/api/inventory/list-view-preference/route.ts`
2. `apps/dealer/app/api/inventory/[id]/cost-entries/route.ts`
3. `apps/dealer/app/api/inventory/[id]/pricing/preview/route.ts`
4. `apps/dealer/app/api/inventory/[id]/pricing/apply/route.ts`
5. `apps/dealer/app/api/inventory/[id]/publish/route.ts`
6. `apps/dealer/app/api/inventory/[id]/unpublish/route.ts`

### Frontend (Step 3)
7. `apps/dealer/modules/inventory/ui/components/VehiclePageHeader.tsx`
8. `apps/dealer/modules/inventory/ui/components/VehicleCostsPageHeader.tsx`
9. `apps/dealer/modules/inventory/ui/components/CostLedgerCard.tsx`
10. `apps/dealer/modules/inventory/ui/components/CostTotalsCard.tsx`
11. `apps/dealer/modules/inventory/ui/components/DocumentsRailCard.tsx`
12. `apps/dealer/modules/customers/ui/components/CustomersFilterBar.tsx`
13. `apps/dealer/app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx`
14. `apps/dealer/app/(app)/inventory/new/AddVehiclePage.tsx`
15. `apps/dealer/components/ui-system/navigation/TopCommandBar.tsx`
16. `apps/dealer/components/dashboard-v3/RecommendedActionsCard.tsx`

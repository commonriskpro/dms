# User UI Integrity Sweep V1 — Security QA

## Scope

Review all actions touched by the UI Integrity Sweep (Steps 2–3) for security issues:
- Incorrect permission gating
- Unauthorized action exposure
- Hidden-button vs blocked-route mismatch
- Dangerous destructive action behavior
- Tenant leakage through action handlers
- UI actions exposing data across wrong entities
- XSS / injection vulnerabilities in newly added code

---

## Security Issues Found & Fixed

### S1 — Stored XSS in `printCostLedger` (HIGH)

**Files:** `VehiclePageHeader.tsx`, `VehicleCostsPageHeader.tsx`

**Issue:** The `printCostLedger` function constructs an HTML document using template literals and writes it to a new browser window via `document.write()`. User-controlled data fields — `vehicleTitle`, `vin`, `vendorName`, `memo`, `category` — were interpolated directly into HTML without escaping. If any field contained malicious HTML or script content stored in the database, it would execute in the print window context.

**Risk:** A user with write access to cost entries or vehicle metadata could inject script tags into vendor names or memo fields, which would execute when any user prints the cost ledger.

**Fix:** Added `escapeHtml()` function that escapes `&`, `<`, `>`, `"` characters. All user-controlled values are now sanitized before interpolation into HTML.

### S2 — CSV Injection in cost ledger export (MEDIUM)

**File:** `CostLedgerCard.tsx`

**Issue:** The CSV export function interpolated vendor names and memo fields directly into CSV output. Values beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` can be interpreted as formulas by spreadsheet applications (Excel, Google Sheets), potentially enabling data exfiltration or command execution on the user's machine.

**Risk:** A user with write access to cost entries could craft vendor names or memos that execute as spreadsheet formulas when another user exports and opens the CSV.

**Fix:** Added `sanitizeCsvField()` function that prefixes dangerous starting characters with a single quote (`'`), neutralizing formula interpretation while preserving readability.

---

## Permission Gating Audit

### UI Permission → API Permission Mapping

| Component | UI Check | API Route | API Check | Match |
|---|---|---|---|---|
| VehiclePageHeader | `canWrite` (inventory.write) | Navigation only | N/A | YES |
| VehicleCostsPageHeader | `canWrite` (inventory.write) | Navigation only | N/A | YES |
| CostLedgerCard | `canWrite` (inventory.write) | POST cost-entries | `guardPermission(ctx, "inventory.write")` | YES |
| CostLedgerCard | `canWrite` (inventory.write) | PATCH cost-entries/[id] | `guardPermission(ctx, "inventory.write")` | YES |
| CostLedgerCard | `canWrite` (inventory.write) | DELETE cost-entries/[id] | `guardPermission(ctx, "inventory.write")` | YES |
| DocumentsRailCard | `canUploadDocument` (inventory.write + documents.write) | POST cost-documents | `guardPermission(ctx, "inventory.write")` + `guardPermission(ctx, "documents.write")` | YES |
| DocumentsRailCard | `canWriteDocs` (documents.write) | DELETE cost-documents/[id] | `guardPermission(ctx, "inventory.write")` + `guardPermission(ctx, "documents.write")` | YES |
| DocumentsRailCard | `canListDocuments` (inventory.read + documents.read) | N/A (data passed from parent) | Parent enforces reads | YES |
| CostsTabContent | `hasPermission("inventory.read")` → null render | GET cost, cost-entries | `guardPermission(ctx, "inventory.read")` | YES |
| CostsTabContent | `hasPermission("inventory.write")` → add/edit/delete | POST/PATCH/DELETE cost-entries | `guardPermission(ctx, "inventory.write")` | YES |
| TopCommandBar | `hasPermission("inventory.write")` → Add Vehicle | POST /api/inventory | `guardPermission(ctx, "inventory.write")` | YES |
| TopCommandBar | `hasPermission("customers.write")` → Add Lead | POST /api/customers | `guardPermission(ctx, "customers.write")` | YES |
| TopCommandBar | `hasPermission("deals.write")` → New Deal | POST /api/deals | `guardPermission(ctx, "deals.write")` | YES |
| EditVehicleUi | `hasPermission("inventory.write")` | Delegated to child components | Verified in children | YES |
| AddVehiclePage | `hasPermission("inventory.write")` → blocks page | POST /api/inventory | `guardPermission(ctx, "inventory.write")` | YES |
| RecommendedActionsCard | None (navigation only) | N/A | Destination pages enforce own gates | N/A |
| CustomersFilterBar | None (display only) | N/A | No mutations | N/A |
| CostTotalsCard | None (display only) | N/A | No mutations | N/A |

**Result:** No hidden-button vs blocked-route mismatches found. All UI permission checks align with backend `guardPermission()` calls.

---

## Destructive Actions Audit

| Action | Component | Confirmation? | API Route | Status |
|---|---|---|---|---|
| Delete cost entry | CostsTabContent → CostLedgerCard | `confirm()` dialog | DELETE cost-entries/[entryId] | SAFE |
| Remove cost document | CostsTabContent → DocumentsRailCard | `confirm()` dialog | DELETE cost-documents/[docId] | SAFE |
| Sign out | TopCommandBar | No confirmation | POST /api/auth/logout | ACCEPTABLE (standard UX) |

**Result:** All destructive mutations go through `confirm()` dialog before API call. Sign out without confirmation is an intentional UX choice, not a security issue.

---

## Tenant Isolation Audit

| Check | Result |
|---|---|
| Client-supplied `dealershipId` in any `apiFetch` call | NOT FOUND — all calls use URL paths with entity IDs only |
| Server-side `dealershipId` extraction | All routes use `ctx.dealershipId` from session |
| Cross-vehicle-id validation on nested routes | DELETE cost-entries/[entryId] verifies `entry.vehicleId === id` |
| Cross-vehicle-id validation on cost documents | DELETE cost-documents/[docId] verifies `doc.vehicleId === id` |
| Tenant scoping on reads | `getCostEntry(ctx.dealershipId, ...)` scopes by dealership |

**Result:** No tenant leakage vectors found. All operations are scoped by `ctx.dealershipId` from server session.

---

## Additional Security Observations

### Advisory (Low Risk, No Action Required)

1. **`PATCH /api/inventory/list-view-preference`** uses `inventory.read` permission instead of `inventory.write`. This is acceptable since it modifies a user-scoped UI preference (column widths, sort order), not business data. The preference is scoped to the authenticated user.

2. **`printCostLedger` fetches data without UI-side permission check.** The button is visible to all users who can access the vehicle detail page. However, the API routes enforce `guardPermission(ctx, "inventory.read")` server-side, so unauthorized data access is blocked. The print button just won't produce output for unpermissioned users.

3. **CSV export in CostLedgerCard has no separate permission check.** The export button is visible to anyone who can see the cost ledger table. Since the data is already rendered in the DOM, there is no privilege escalation — the CSV export simply reformats data the user already has access to.

---

## Files Changed in Security QA

1. `apps/dealer/modules/inventory/ui/components/VehiclePageHeader.tsx` — Added `escapeHtml()` for XSS prevention in print function
2. `apps/dealer/modules/inventory/ui/components/VehicleCostsPageHeader.tsx` — Added `escapeHtml()` for XSS prevention in print function
3. `apps/dealer/modules/inventory/ui/components/CostLedgerCard.tsx` — Added `sanitizeCsvField()` for CSV injection prevention in export

---

## Verdict

**2 security issues found and fixed (S1 XSS, S2 CSV injection). No permission gating mismatches, no tenant leakage, no unprotected mutations, no destructive actions without confirmation.**

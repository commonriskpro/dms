# Deals Depth Sprint — Spec

Single spec for the Deals Depth Sprint: domain model, calculations, RBAC, APIs, UI plan, ModalShell pattern, acceptance criteria, audit, immutability, and rate limits. No application code, tests, or migrations in this document.

---

## 1. Domain model (Prisma)

### Existing models (summary; no schema changes unless noted)

- **Deal**: `id`, `dealershipId`, `customerId`, `vehicleId`, `salePriceCents`, `purchasePriceCents`, `taxRateBps`, `taxCents`, `docFeeCents`, `downPaymentCents`, `totalFeesCents`, `totalDueCents`, `frontGrossCents`, `status`, `notes`, `createdAt`, `updatedAt`, `deletedAt`, `deletedBy`. All money BigInt cents. Relations: fees, trades, history, dealFinance.
- **DealStatus** (enum): `DRAFT`, `STRUCTURED`, `APPROVED`, `CONTRACTED`, `CANCELED`. **Locked state**: `CONTRACTED` is the locked state (no structural edits; see §9). No `SOLD` in this sprint—keep only CONTRACTED as locked. If product later requires a distinct “sold” state, add `SOLD` to the enum and treat it as locked like CONTRACTED.
- **DealFee**: `id`, `dealershipId`, `dealId`, `label`, `amountCents`, `taxable`, `createdAt`. Front-end fees (doc fee is on Deal; custom fees here).
- **DealTrade**: Trade-in (one or multiple per deal). `id`, `dealershipId`, `dealId`, `vehicleDescription`, `allowanceCents`, `payoffCents`, `createdAt`. **Equity**: `equityCents = allowanceCents - payoffCents`; may be negative (negative equity); display behavior when payoff > allowance: show as “Negative equity” or “(Amount)” per UI convention; do not block persistence.
- **DealHistory**: `id`, `dealershipId`, `dealId`, `fromStatus`, `toStatus`, `changedBy`, `createdAt`. Append-only status transition log.
- **DealFinance**: One per deal (1:1). `financingMode` (CASH/FINANCE), `termMonths`, `aprBps`, `cashDownCents`, `amountFinancedCents`, `monthlyPaymentCents`, `totalOfPaymentsCents`, `financeChargeCents`, `productsTotalCents`, `backendGrossCents`, `reserveCents`, `status` (DealFinanceStatus), `lenderName`, `firstPaymentDate`, `notes`, soft delete. No separate “DealFinanceTerms” model; keep existing naming.
- **DealFinanceProduct**: F&I products. `productType` (GAP, VSC, MAINTENANCE, TIRE_WHEEL, OTHER), `name`, `priceCents`, `costCents`, `taxable`, `includedInAmountFinanced`, soft delete.

### Indexes and constraints

- Existing indexes remain: `dealershipId`, `dealershipId + status`, `dealershipId + createdAt`, `dealershipId + customerId`, `dealershipId + vehicleId`, `dealershipId + deletedAt` on Deal; `dealershipId`, `dealershipId + dealId` on DealFee, DealTrade; `dealershipId`, `dealershipId + dealId, createdAt` on DealHistory; etc.
- **Additions**: None required for this sprint unless new query patterns emerge; document any new composite indexes in implementation.

### Audit

- **Critical for audit**: Deal (create/update/delete, status change), DealFee (add/update/delete), DealTrade (add/update/delete), DealHistory (created on status transition), DealFinance (create/update/delete), DealFinanceProduct (add/update/delete). Sensitive reads (e.g. deal detail with financials) may be audit-logged per org policy; document in implementation.

---

## 2. Calculation spec

### Formulas (all money in cents; BigInt)

- **taxableBaseCents** = `salePriceCents + taxableCustomFeesCents` (taxableCustomFeesCents = sum of `DealFee.amountCents` where `taxable === true`).
- **taxCents** = `(taxableBaseCents * taxRateBps + 5000) / 10000` (HALF_UP rounding). Implemented as in `modules/deals/service/calculations.ts` `computeTaxCents`.
- **totalFeesCents** = `docFeeCents + sum(DealFee.amountCents)`.
- **totalDueCents** = `salePriceCents + taxCents + totalFeesCents - downPaymentCents`.
- **frontGrossCents** = `salePriceCents - purchasePriceCents - totalFeesCents` (tax not subtracted from gross).
- **Trade-in equity** (per trade): `equityCents = allowanceCents - payoffCents`. May be negative; no DB column; computed on read for display.
- **F&I products total**: `productsTotalCents` = sum of `DealFinanceProduct.priceCents`. Taxable vs non-taxable: sum by `taxable` for display or tax calculation if needed; backend stores `productsTotalCents` on DealFinance. Amount financed and backend totals: as stored on DealFinance (`amountFinancedCents`, `backendGrossCents`, etc.); may be recomputed from products and terms in service layer—document in implementation whether stored or derived on read.

### Stored vs computed

- **Stored on Deal**: `taxCents`, `totalFeesCents`, `totalDueCents`, `frontGrossCents` (recomputed and persisted when deal/fees/down payment change).
- **Stored on DealFinance**: `amountFinancedCents`, `monthlyPaymentCents`, `totalOfPaymentsCents`, `financeChargeCents`, `productsTotalCents`, `backendGrossCents`, `reserveCents` (persisted when finance or products change).
- **Computed on read**: trade equity per trade (allowanceCents - payoffCents); taxable vs non-taxable product breakdown for display if needed.

### Invariants

- **Non-negative (store/validate)**: `salePriceCents`, `purchasePriceCents`, `docFeeCents`, `downPaymentCents`, `totalFeesCents`, `taxCents`, fee `amountCents`, trade `allowanceCents` and `payoffCents` (each ≥ 0). `totalDueCents` and `frontGrossCents` may be negative by business rule—document; typically disallow negative totalDue at validation if required.
- **Ranges**: `taxRateBps` in [0, 10000] (0–100%); `termMonths` e.g. [1, 84] when present; `aprBps` ≥ 0 when present.
- **Negative equity**: Allowed in data; UI shows as “Negative equity” or equivalent; no blocking validation.

---

## 3. RBAC matrix

| Resource / Action        | Permission   | Roles (typical)     |
|--------------------------|-------------|---------------------|
| List deals, get deal     | `deals.read`  | Admin, Manager, Sales, Viewer |
| Create deal, PATCH deal  | `deals.write`| Admin, Manager, Sales        |
| Status transition       | `deals.write`| Admin, Manager, Sales        |
| Fees CRUD                | `deals.write`| Admin, Manager, Sales        |
| Trade-in CRUD            | `deals.write`| Admin, Manager, Sales        |
| Get finance, list F&I    | `finance.read` | Admin, Manager, Sales, F&I |
| Update finance, F&I CRUD | `finance.write`| Admin, Manager, F&I         |

- **Deal mutations** (structure, status, fees, trades): `deals.write` only; no separate permission.
- **Finance actions** (update finance, add/remove F&I product): `finance.write`. Read of finance/F&I: `finance.read`.
- Least privilege: no admin bypass; every route enforces the permission above.

---

## 4. Tenant isolation

- **dealershipId** comes from auth context only (session / `getAuthContext`). Never from client-supplied body or path (path has `dealId`, not `dealershipId`).
- Every list/get/update/delete is scoped by `dealershipId` from context. Cross-tenant access returns **404 NOT_FOUND** (do not leak existence).

---

## 5. API table

| Method | Path | Purpose | Pagination |
|--------|------|---------|------------|
| GET    | `/api/deals` | List deals (filter, sort) | Yes: limit, offset |
| POST   | `/api/deals` | Create deal | — |
| GET    | `/api/deals/[id]` | Get deal detail (for RSC + API) | — |
| PATCH  | `/api/deals/[id]` | Update deal (e.g. notes, structural fields when not locked) | — |
| DELETE | `/api/deals/[id]` | Soft-delete deal | — |
| PATCH  | `/api/deals/[id]/status` | Status transition (body: toStatus) | — |
| GET    | `/api/deals/[id]/history` | List deal history | Yes: limit, offset |
| GET    | `/api/deals/[id]/fees` | List fees (or inline in deal detail) | Optional / inline |
| POST   | `/api/deals/[id]/fees` | Add fee | — |
| PATCH  | `/api/deals/[id]/fees/[feeId]` | Update fee | — |
| DELETE | `/api/deals/[id]/fees/[feeId]` | Delete fee | — |
| GET    | `/api/deals/[id]/trade` | List trades (or inline in deal detail) | Optional / inline |
| POST   | `/api/deals/[id]/trade` | Add trade-in | — |
| PATCH  | `/api/deals/[id]/trade/[tradeId]` | Update trade-in | — |
| DELETE | `/api/deals/[id]/trade/[tradeId]` | Delete trade-in | — |
| GET    | `/api/deals/[id]/finance` | Get finance by deal id | — |
| PUT    | `/api/deals/[id]/finance` | Create or update finance (cash/finance fields, lender, term, apr, etc.) | — |
| GET    | `/api/deals/[id]/finance/products` | List F&I products | Yes: limit, offset |
| POST   | `/api/deals/[id]/finance/products` | Add F&I product | — |
| PATCH  | `/api/deals/[id]/finance/products/[productId]` | Update F&I product | — |
| DELETE | `/api/deals/[id]/finance/products/[productId]` | Delete (soft) F&I product | — |

- **Zod**: Query (limit, offset, status?, sortBy?, sortOrder?), params (id, feeId, tradeId, productId), body per route (create/update payloads). All list endpoints paginated (limit/offset or cursor); document min/max for limit.
- **Response**: Success `{ data: T }` or `{ data: T[], meta: { total, limit, offset } }`; error `{ error: { code, message, details? } }`.
- **Dealership scoping**: All routes resolve `dealershipId` from auth; never from body. List/get/update/delete scoped by that dealership.

---

## 6. UI plan

- **Deal detail modal** (Option B): Intercepting route `(app)/@modal/(.)deals/[id]/page.tsx` loads deal via `dealService.getDeal` (and related data as needed) in RSC, passes `initialData` to `DealDetailModalClient` → `DealDetailPage`.
- **Direct URL page** `(app)/deals/[id]/page.tsx`: Load initial deal (and related) in RSC and pass to `DealDetailPage`; do not rely on client fetch for first paint (server-first).
- **Layout**: Overview header (deal id, customer, vehicle, status); tabs/panels: **Overview** (structure, fees summary, totals), **Trade-in(s)** (list/add/edit/remove), **Finance** (mode, lender, term, APR, amounts), **F&I products** (list/add/edit/remove), **Totals** (server-computed: front gross, backend, totals). Reuse existing tabs where present (e.g. DealFinanceTab, DealLendersTab, DealDocumentsTab).
- **States**: Error (forbidden, not_found, invalid_id), empty (no trades, no products), skeletons while loading. Confirm dialogs for destructive actions: cancel deal, remove trade, remove F&I product.
- **Server-first**: When `initialData` is provided, client does NOT fetch on mount; use it for initial render and refetch only after mutations or explicit refresh.

---

## 7. ModalShell typing / pattern

- **Standard pattern**: When the modal page has an **error** (forbidden, not_found, invalid_id), pass only `error` to `ModalShell` and **omit** `children` so ModalShell renders `ErrorState` and its default error body. When **success**, pass `children` (main content). This keeps one place for default error UI and satisfies typing (children optional).
- **Alternative** (current in some modals): Pass both `error` and `children` (e.g. `<ModalErrorBody />`) when error; ModalShell ignores children when error is set. Both compile; prefer omitting children on error for consistency and less duplication.
- **Document** in code or UI guide: “Modal error pages: set `error` and omit `children`; success: set `children` only.”

---

## 8. Acceptance criteria and test plan

- **Jest unit**: (1) Calculations: `computeTaxCents`, `computeDealTotals` (HALF_UP, totals, front gross). (2) Transition rules: `isAllowedTransition` for all valid/invalid pairs; CONTRACTED → only CANCELED; CANCELED → none.
- **Jest integration**: API routes with tenant scoping (wrong dealership → 404), RBAC (missing deals.read / deals.write / finance.read / finance.write → 403), Zod validation (invalid body/params → 400). Cover GET deal, PATCH status, fee CRUD, trade CRUD, finance GET/PUT, F&I products CRUD.
- **Rollout order**: Backend slices A→G (e.g. A: deal get/PATCH + status; B: fees; C: trades; D: finance GET/PUT; E: F&I products list/create; F: F&I update/delete; G: history, totals), then frontend (modal + direct page, tabs, confirm dialogs), then Security & QA (tenant isolation, RBAC, audit, rate limits).

---

## 9. Audit and immutability

### Audit

- **Mutations that create audit log entries**: Deal create/update/delete; deal status change (DealHistory + audit); DealFee add/update/delete; DealTrade add/update/delete; DealFinance create/update/delete; DealFinanceProduct add/update/delete. Include entity id, dealership id, user id, action, and relevant payload (e.g. fromStatus/toStatus for status change).

### Immutability (CONTRACTED = locked)

- When deal `status === CONTRACTED`, structural edits are **disallowed** and return **409 CONFLICT**: change to sale price, purchase price, tax rate, doc fee, down payment, fees (add/update/delete), trades (add/update/delete), and finance/F&I structure (unless product explicitly allows post-contract adjustments). **Allowed when CONTRACTED**: update `notes` only (and any other explicitly documented post-lock fields). Status may transition CONTRACTED → CANCELED.
- If `SOLD` is added later, treat like CONTRACTED (locked; notes-only edits allowed).

---

## 10. Rate limits

- **Mutation routes** to rate limit (per user + dealership, per minute or per window): PATCH `/api/deals/[id]/status`, POST/PATCH/DELETE fees, POST/PATCH/DELETE trade, PUT `/api/deals/[id]/finance`, POST/PATCH/DELETE finance products. Use existing rate-limit abstraction (e.g. `deals_mutation` or similar); document limits (e.g. 60 mutations per user+dealership per minute) in implementation.
- **Read-only** (GET deal, list history, list fees, list trades, GET finance, list products): optional lighter limit for abuse prevention; not required for this sprint if not already present.

---

## Summary

- **Domain**: Deal, DealStatus (CONTRACTED = locked), DealFee, DealTrade (trade-in; equity = allowance − payoff), DealHistory, DealFinance, DealFinanceProduct; no SOLD this sprint; indexes as-is unless new patterns added.
- **Calculations**: Stored totals on Deal/DealFinance; formulas and invariants as in §2.
- **RBAC**: deals.read / deals.write for deal/fees/trades/status; finance.read / finance.write for finance and F&I.
- **APIs**: Full route table with pagination and dealership-from-auth only.
- **UI**: Server-first modal and direct page, tabs (Overview, Trade-ins, Finance, F&I, Totals), errors and confirm dialogs.
- **ModalShell**: On error, pass `error` and omit `children`; on success, pass `children`.
- **Tests**: Unit (calculations, transitions); integration (tenant, RBAC, validation). Rollout: backend A→G, frontend, then Security & QA.
- **Audit**: All listed mutations logged; CONTRACTED allows only notes (and CANCELED transition); mutation routes rate limited.

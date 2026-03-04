# SPRINT 7 — Finance Shell Enhancement — SPEC

Spec for Deal Finance tab enhancements: side-by-side payment comparison, product toggles, APR impact visual, live monthly payment recalculation, backend gross visibility. Constraints: BigInt-only calculations, deterministic HALF_UP rounding, CONTRACTED lock enforced, calculation vector tests.

**Context:** Finance-shell exists: DealFinance (term/APR/cash down, amount financed, monthly payment, products, backend gross); calculations in `modules/finance-shell/service/calculations.ts` (BigInt, HALF_UP); CONTRACTED lock in service and UI; products with `includedInAmountFinanced`. Deal Finance tab shows structure form, payment summary (saved values), products table.

**Goal:** Enhance the tab for comparison, toggles, APR impact, live recalc, and explicit backend gross; add calculation vector tests.

---

## 1) SCOPE — Deal Finance tab enhancements

### 1.1 Side-by-side payment comparison

- **Current vs scenario:** Show two columns (or two blocks): **Saved** (persisted finance: amount financed, monthly payment, total of payments, finance charge, products total, backend gross) and **Current** (live-calculated from current form + product toggles: same fields). When form matches saved and no product changes, values match; when user edits term/APR/cash down or toggles product inclusion, **Current** updates immediately (live).
- **Layout:** e.g. "Payment summary" card with two columns: "Saved" | "Current" (or "Scenario"). When deal is CONTRACTED, only one column (Saved) — no live scenario.
- **Purpose:** User sees impact of changes before saving.

### 1.2 Product toggles

- **Included in amount financed:** In the products table, when deal is not CONTRACTED and user has `finance.write`, each product row has a toggle (or checkbox) for **Included in amount financed**. Toggling updates **live** totals only (no PATCH until user saves structure or product). If we support PATCH product for only `includedInAmountFinanced`, toggling can persist immediately; otherwise treat as draft state and persist on "Save" (structure save recalculates from server; product PATCH already supports `includedInAmountFinanced`). **Spec choice:** Product toggle PATCHes immediately (existing API PATCH product with `includedInAmountFinanced`) so backend stays source of truth; live preview still recalculates from local state (products with toggles) so **Current** column updates before refetch.
- **Visibility:** Backend gross recalculates when product inclusion or price/cost changes (backend gross = sum of (priceCents - costCents) for products with cost).

### 1.3 APR impact visual

- **Visual:** Show how monthly payment (and optionally total of payments / finance charge) change with APR. Options: (a) small chart or bar (e.g. payment at current APR vs at ±1% or at 0%); (b) list of 2–3 comparison points (e.g. "At 0% APR: $X.XX/mo" and "At 12% APR: $Y.YY/mo" with current highlighted); (c) slider or dropdown "Compare APR" that shows payment at selected APR alongside current. **Spec:** Simple **APR impact** section: show monthly payment at **current APR**, at **0% APR** (principal/term only), and at one **higher APR** (e.g. current + 3% or fixed 15%) so user sees sensitivity. All values from same deterministic calculation (BigInt, HALF_UP). When CONTRACTED or read-only, show as read-only labels.

### 1.4 Monthly payment recalculates live

- **Behavior:** As user changes Term, APR, Cash down, or product inclusion (toggles), the **Current** payment summary (amount financed, monthly payment, total of payments, finance charge, products total, backend gross) recalculates **immediately** in the UI without saving.
- **Calculation:** Use the **same** formula as backend: BigInt-only, HALF_UP rounding. Implementation: share calculation logic (e.g. `computeFinanceTotals`, `computeAmountFinancedCents`, `computeMonthlyPaymentCents`) between backend and frontend. Backend already has `modules/finance-shell/service/calculations.ts`; ensure it is importable by the client (no Node-only deps) or copy the same logic into a shared `lib` used by both. Single source of truth preferred (import from a shared module).
- **Inputs for live calc:** Base amount = deal total due (must be available to client: either in GET finance response as `baseAmountCents` or from GET deal). Products: list with price and includedInAmountFinanced (from products API or local state after toggles). Term, APR, cash down from form state.

### 1.5 Backend gross visibility

- **Already present:** Payment summary shows "Backend gross" (saved). **Enhancement:** Ensure backend gross is visible in both Saved and Current columns. Backend gross = sum over products of (priceCents - costCents) for products that have costCents; products without cost do not contribute. Live calculation: same formula from current product list and inclusion; when a product is toggled or price/cost edited locally, backend gross in **Current** updates.

### 1.6 CONTRACTED lock

- When deal status is **CONTRACTED:** No edits to structure, no product add/edit/delete, no product inclusion toggles. Payment summary shows **Saved** only (no "Current" column). APR impact section read-only. Backend already returns CONFLICT on PUT/PATCH when deal is CONTRACTED; UI disables all mutation controls and hides or disables live scenario column.

---

## 2) BACKEND / API

### 2.1 GET finance response: baseAmountCents

- Include **baseAmountCents** (deal total due in cents, string) in GET `/api/deals/[id]/finance` response so the client can run live calculation without a separate deal fetch. Backend already has `deal.totalDueCents` when loading finance; add to serialized payload.

### 2.2 Calculations

- All calculations remain in backend with **BigInt**, **HALF_UP** (`roundHalfUpToCents`). No floats. Frontend uses same logic (shared module or re-export) for live preview only; persistence always via backend.

### 2.3 CONTRACTED lock (existing)

- PUT finance, PATCH status, POST/PATCH/DELETE product: when deal.status === CONTRACTED, return **409 CONFLICT**. No new behavior.

---

## 3) CALCULATION VECTOR TESTS

- Add or extend **unit tests** in `modules/finance-shell/service/calculations.test.ts` (or equivalent) with **deterministic vectors**:
  - **Vector 1:** P = $10,000 (1000000 cents), APR = 12% (1200 bps), term = 60 months → monthly payment = 22244 cents, totalOfPayments = 22244 * 60, financeCharge = totalOfPayments - 1000000.
  - **Vector 2:** P = $10,000 (1000000 cents), APR = 0%, term = 60 → monthly = 1000000/60 rounded HALF_UP (16667 cents).
  - **Vector 3:** P = $20,000, APR = 5.99% (599 bps), term = 84 months → assert totalOfPayments = monthlyPayment * 84 and financeCharge = totalOfPayments - amountFinanced.
  - **Vector 4:** Product inclusion: base 1000000, +100000 financed products, 0 cash down → amountFinanced = 1100000; payment and finance charge consistent.
  - **Vector 5:** HALF_UP edge: roundHalfUpToCents(25, 10) = 3; roundHalfUpToCents(24, 10) = 2.
- These tests already exist in calculations.test.ts; add any missing vectors and ensure they are documented as the canonical vectors for regression.

---

## 4) RBAC & TENANT

- No change: `finance.read` / `finance.write`; tenant from auth. CONTRACTED lock is business rule, not permission.

---

## 5) DELIVERABLES CHECKLIST

- [ ] GET finance returns `baseAmountCents` (string) for client-side live calc.
- [ ] Shared calculation used for live preview (BigInt, HALF_UP); same results as backend for same inputs.
- [ ] Payment summary: side-by-side **Saved** | **Current** (when not CONTRACTED); single column when CONTRACTED.
- [ ] Product rows: toggle **Included in amount financed** (PATCH product when not CONTRACTED); **Current** column updates live from local state/refetch.
- [ ] APR impact: show payment at current APR, at 0%, and at one higher APR (e.g. +3% or 15%); read-only when CONTRACTED.
- [ ] Backend gross visible in both Saved and Current; live calc = sum(priceCents - costCents) for products with cost.
- [ ] CONTRACTED: no structure/product edits; no Current column; backend returns CONFLICT on write.
- [ ] Calculation vector tests: at least 3–5 deterministic vectors in calculations.test.ts.

---

Next step: Backend adds baseAmountCents to GET finance response and confirms calculation vector tests; frontend implements comparison, toggles, APR impact, live recalc, and backend gross visibility using shared calculation.

# Customer + Deal Workflow Flow Refinement — Step 6 (QA-Hardening) Final Report

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md`  
**Scope:** Focused tests for touched customer/deal workflow surfaces, responsive/dark-light sanity (documented), changed files, tests run, unrelated failures listed separately.

---

## 1. Summary

- **Workflow refinement test suite:** 4 new test files, 16 tests — **all passing.**
- **Focused coverage:** NextActionZone (null state, Open conversation, signal primary, callback due, risk line), ActiveOpportunityDealCard (no permission, empty APIs, active deal, active opportunity), DealProgressStrip (labels, Pending/Done/1 issue, links), DealNextActionLine (empty, first blocker action, no action).
- **Existing customer UI tests:** customers-ui.test.tsx and lead-action-strip.test.tsx — **passing.**
- **Unrelated failure:** 1 integration test (saved-filters-searches) fails due to `buildCustomersQuery` not a function; not introduced by this sprint.

---

## 2. Changed / Added Files (Step 6)

| File | Change |
|------|--------|
| `modules/customers/ui/components/__tests__/NextActionZone.test.tsx` | **New.** 5 tests: null when no primary/risk, Open conversation when canReadCrm, primary from signal with action, primary from scheduled callback, risk line from warning/danger signal. |
| `modules/customers/ui/components/__tests__/ActiveOpportunityDealCard.test.tsx` | **New.** 4 tests: renders nothing without permissions, loading then empty when APIs return empty, active deal link when deals API returns one, active opportunity link when opportunities return OPEN and no deal. |
| `modules/deals/ui/desk/__tests__/DealProgressStrip.test.tsx` | **New.** 4 tests: Funding/Title/Delivery labels and links, Pending when no data/signals, Done for delivery when DELIVERED, 1 issue when signal code includes funding. |
| `modules/deals/ui/desk/__tests__/DealNextActionLine.test.tsx` | **New.** 3 tests: No blocking actions when empty, first blocker action when present, No blocking actions when first signal has no action. |

---

## 3. Tests Run

### 3.1 Workflow refinement–focused run

**Command:**

```bash
npx jest modules/customers/ui/components/__tests__/NextActionZone.test.tsx \
  modules/customers/ui/components/__tests__/ActiveOpportunityDealCard.test.tsx \
  modules/deals/ui/desk/__tests__/DealProgressStrip.test.tsx \
  modules/deals/ui/desk/__tests__/DealNextActionLine.test.tsx
```

**Result:** 4 suites passed, 16 tests passed.

| Suite | Tests |
|-------|-------|
| NextActionZone.test.tsx | 5 |
| ActiveOpportunityDealCard.test.tsx | 4 |
| DealProgressStrip.test.tsx | 4 |
| DealNextActionLine.test.tsx | 3 |

### 3.2 Customer and deal desk scope

**Command:** `npx jest modules/customers modules/deals/ui/desk`

**Result:** 14 suites run; 13 passed, 1 failed (unrelated — see §6). 139 tests; 137 passed, 2 failed (same unrelated suite).

---

## 4. Responsive and Dark/Light Sanity

**Approach:** Jest-only; no Playwright. Manual sanity documented.

### 4.1 Responsive (touched surfaces)

- **Customer page:** Next-action zone and Active deal or opportunity card sit in the main column; layout uses existing grid (main + 280px rail). At narrow widths the strip and card stack with other cards; no new fixed widths.
- **Deal page:** Blockers strip, progression strip, and next-action line are full-width within the padded content area; they wrap (flex-wrap) and remain readable. Grid below is unchanged (3-column at lg, stacked at smaller).
- **Steps (manual):** Resize to 320px, 768px, 1024px; confirm next-action zone, active deal/opportunity card, blockers strip, and progression strip do not overflow and remain usable.
- **Status:** Documented for manual QA; no automated responsive tests in this repo.

### 4.2 Dark / light

- Touched components use CSS variables only (`--surface`, `--border`, `--text`, `--text-soft`, `--accent`, `--warning-text`, `--warning-surface`, etc.). No hard-coded palette colors.
- **Status:** No theme-specific code; tokens inherit; documented for manual QA if theme toggle exists.

---

## 5. Changed Files (All Steps — Reference)

| Step | Files |
|------|--------|
| **Spec (1)** | `CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md` |
| **Backend (2)** | None (derivation from existing reads only). |
| **Frontend (3)** | NextActionZone.tsx, ActiveOpportunityDealCard.tsx, CustomerDetailContent.tsx, DetailPage.tsx, CustomerDetailModalClient.tsx, DealProgressStrip.tsx, DealNextActionLine.tsx, DealDeskWorkspace.tsx |
| **Security (4)** | `CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SECURITY_QA.md` |
| **Perf (5)** | `CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_PERF_NOTES.md` |
| **QA (6)** | NextActionZone.test.tsx, ActiveOpportunityDealCard.test.tsx, DealProgressStrip.test.tsx, DealNextActionLine.test.tsx, this final report |

---

## 6. Unrelated Failures

- **modules/customers/tests/saved-filters-searches.integration.test.ts:** 2 tests fail with `TypeError: buildCustomersQuery is not a function`. This test imports or expects `buildCustomersQuery` from a module that does not export it (or export was removed/renamed elsewhere). **Not introduced by this sprint;** no workflow refinement code touches saved filters or buildCustomersQuery.

---

## 7. Deliverables Checklist

| Deliverable | Status |
|-------------|--------|
| CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md | Done (Step 1) |
| Customer page workflow refined | Done (Step 3) |
| Deal page workflow refined | Done (Step 3) |
| Shared blocker/action patterns (minimal) | Done (Step 3 — consistent pattern; no new shared component) |
| Timeline/context (no code change) | Documented (Step 3 report) |
| CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_REPORT.md | Done (Step 3) |
| CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SECURITY_QA.md | Done (Step 4) |
| CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_PERF_NOTES.md | Done (Step 5) |
| Focused tests for touched surfaces | Done (Step 6) |
| CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_FINAL_REPORT.md | Done (this document) |

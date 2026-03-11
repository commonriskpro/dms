# Post-Onboarding Stabilization + UX Polish + Next Sprint Readiness — Plan

**Program:** Post-Onboarding Stabilization  
**Step:** 1 — Architect  
**Status:** Plan only; no app code in this step.

**Authoritative references (locked):**

- `apps/dealer/docs/DASHBOARD_VFINAL_FINAL_REPORT.md`
- `apps/dealer/docs/DASHBOARD_VFINAL_POLISH_FINAL_REPORT.md`
- `apps/dealer/docs/WORKFLOW_INTELLIGENCE_DEEPENING_FINAL_REPORT.md`
- `apps/dealer/docs/DEALER_APPLICATION_APPROVAL_V1_FINAL_REPORT.md`
- `apps/dealer/docs/DEALER_ONBOARDING_COMPLETION_FINAL_REPORT.md`
- `apps/dealer/docs/UI_SYSTEM_ARCHITECTURE_V1.md`
- `apps/dealer/docs/UI_COMPONENT_LIBRARY_SPEC.md`
- `apps/dealer/docs/UI_SYSTEM_USAGE.md`

---

## Current repo state (as of plan creation)

**Dealer Jest run (from repo root):**

- **Failed:** 13 test suites, 57 failing tests, 2 snapshot failures (1 suite).
- **Passed:** 190 suites, 1392 tests (excluding skipped).
- **Skipped:** 1 suite, 6 tests.

**Failing suites (grouped below):**

1. `app/(app)/dashboard/__tests__/page.test.tsx`
2. `app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`
3. `app/(app)/dashboard/__tests__/switchDealership-render.test.tsx`
4. `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx`
5. `components/dashboard-v3/__tests__/dashboard-style-policy.test.ts`
6. `components/dashboard-v3/__tests__/dashboard-ui-tokens.test.ts`
7. `modules/dashboard/tests/getDashboardV3Data.test.ts`
8. `modules/dashboard/tests/dashboard.test.ts`
9. `components/app-shell/__tests__/topbar-lifecycle-badge.test.tsx`
10. `modules/inventory/ui/__tests__/inventory-permissions.test.tsx`
11. `modules/inventory/tests/audit.test.ts`
12. `app/api/customers/route.integration.test.ts`
13. `modules/customers/tests/timeline-callbacks-lastvisit.test.ts`

---

# PHASE 1 — Test Debt Cleanup

## 1.1 Failure groups and treatment

### Group A — Dashboard / UI expectation and mock drift

| Suite | Root cause hypothesis | Fix type | Safe in program? | Order |
|-------|------------------------|----------|------------------|--------|
| `dashboard/__tests__/page.test.tsx` | Page or layout expectations / mocks out of date with current dashboard or routing. | Test-only or test + minimal prod if regression. | Yes. | 1 |
| `dashboard/__tests__/dashboard-v3-render.test.tsx` | `useSearchParams` not mocked; DashboardExecutiveClient uses it and test does not provide it. | Test-only: mock `next/navigation` to provide `useSearchParams`. | Yes. | 2 |
| `dashboard/__tests__/switchDealership-render.test.tsx` | getByText expectation no longer matches rendered content (copy or structure changed). | Test-only: update query or text expectation. | Yes. | 3 |
| `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` | Snapshot drift after dashboard polish or component changes. | Test-only: update snapshots after confirming UI is correct, or narrow snapshot scope. | Yes. | 4 |
| `components/dashboard-v3/__tests__/dashboard-style-policy.test.ts` | Assertions on class names or token usage no longer match implementation. | Test-only: align expectations with current tokens/classes. | Yes. | 5 |
| `components/dashboard-v3/__tests__/dashboard-ui-tokens.test.ts` | Same as above; token or structure assertions drifted. | Test-only: align with current UI. | Yes. | 6 |
| `modules/dashboard/tests/getDashboardV3Data.test.ts` | Prisma mock incomplete: `prisma.vehicle.findMany` (or other delegates) not defined in mock. | Test-only: extend mock to include all Prisma delegates used by getDashboardV3Data. | Yes. | 7 |
| `modules/dashboard/tests/dashboard.test.ts` | Service or data shape expectations changed; or mock missing. | Test-only or tiny service fix if test correctly caught a bug. | Yes. | 8 |

**Required order:** Fix in sequence 1–8 so dashboard tests are stable before relying on them.

---

### Group B — App shell / topbar mock and setup

| Suite | Root cause hypothesis | Fix type | Safe in program? | Order |
|-------|------------------------|----------|------------------|--------|
| `components/app-shell/__tests__/topbar-lifecycle-badge.test.tsx` | `hasPermission` is not a function — session or TopCommandBar mock does not provide `hasPermission`. TopCommandBar uses `useSession()` and calls `hasPermission(item.permission)` in useMemo. | Test-only: ensure session mock (or wrapper) provides `hasPermission` as a function. | Yes. | 9 |

**Required order:** After dashboard group so shell tests can assume same mock patterns if shared.

---

### Group C — Inventory test-state or audit failures

| Suite | Root cause hypothesis | Fix type | Safe in program? | Order |
|-------|------------------------|----------|------------------|--------|
| `modules/inventory/ui/__tests__/inventory-permissions.test.tsx` | “Rendered more hooks than during the previous render” in VehicleDetailPage — conditional hook order or early return before hooks. | Code fix: ensure hooks run unconditionally before any early return (same pattern as DetailPage in Workflow Intelligence report). | Yes. | 10 |
| `modules/inventory/tests/audit.test.ts` | ApiError: Max 20 photos per vehicle — test creates more than 20 photos for a vehicle, hitting business rule. | Test-only: cap photo count in test or use a vehicle with fewer photos so assertion can pass. | Yes. | 11 |

**Required order:** Fix hooks first (code); then audit test (test-only).

---

### Group D — Customer / CRM timeline test drift

| Suite | Root cause hypothesis | Fix type | Safe in program? | Order |
|-------|------------------------|----------|------------------|--------|
| `modules/customers/tests/timeline-callbacks-lastvisit.test.ts` | createCallback then listCallbacks returns undefined for created callback — timing, ordering, or list filter/scope. | Test-only or small service fix: ensure list returns the created entity (e.g. correct dealership/entity scope, or wait for persistence). | Yes. | 12 |
| `app/api/customers/route.integration.test.ts` | Integration test failure (likely DB state, ordering, or env). | Test-only or env/seed: stabilize data or expectations. | Yes. | 13 |

**Required order:** 12 then 13; customer tests after inventory so no cross-module dependency.

---

## 1.2 Summary: test debt cleanup

- **Categories:** Dashboard/UI expectation and mock drift (A), app shell/topbar mock (B), inventory hooks and audit (C), customer/timeline and API integration (D).
- **Approach:** Prefer test-only fixes when production behavior is correct; fix production only when tests correctly expose a regression. No large refactors.
- **Order:** A1–A8 → B9 → C10–C11 → D12–D13.

---

# PHASE 2 — Onboarding UX Micro-Polish

## 2.1 Scope (inspection-based)

Surfaces to consider for **small** polish only:

- `/get-started` (page and layout)
- `GetStartedClient` (routing, cards, copy)
- `OnboardingFlowClient` (step rail, progress, “finish later”, error/loading)
- Step components: `DealershipInfoStep`, `TeamSetupStep`, `InventorySetupStep`, `CrmBasicsStep`, `OperationsBasicsStep`, `LaunchStep`
- Success/completion and “what happens next” messaging

## 2.2 Allowed polish

- **Spacing:** Step spacing, card padding, button rhythm.
- **Microcopy:** Step titles, descriptions, button labels, error/empty messages.
- **Progress clarity:** “Step X of 6” and progress bar label/aria; no change to step model.
- **Empty/error/loading:** Clearer messages; no change to lifecycle.
- **Visual density:** Tighter or looser spacing only; no layout redesign.
- **Success/completion:** “You’re all set” and next-action links; stronger completion state.
- **Responsive:** Margin/padding or font-size only; no breakpoint or layout re-architecture.
- **Dark/light:** Token-only tweaks for contrast/readability; no new raw colors.
- **“Finish later”:** Make link/button more visible or copy clearer; no behavior change.
- **“What happens next”:** Clearer post-completion or post–finish-later messaging.

## 2.3 Explicitly forbidden

- Changing onboarding step architecture (still 6 steps, same order and purpose).
- Changing lifecycle/state model (DealershipOnboardingState, GET/PATCH semantics).
- Changing approval/activation flow or get-started routing logic.
- Introducing new required config or heavy new fields.
- Turning onboarding into a large settings app or new domain.

---

# PHASE 3 — Next Product Sprint Readiness

## 3.1 Definition of “ready”

Before starting the next feature sprint, the following must be true:

- **Tests:** Test debt cleanup executed; dealer suite green or clearly green “enough” with remaining failures documented and deferred.
- **Onboarding:** Accepted as complete; micro-polish applied per plan; no open architecture changes.
- **Docs:** This plan and the stabilization report(s) updated; known debt and deferred items listed.
- **Recommendation:** Next feature sprint identified and justified; explicit deferrals listed.

## 3.2 Recommended next feature sprint (to be confirmed in final report)

- **Suggested focus:** To be chosen after stabilization (e.g. inventory bulk import UX, CRM pipeline enhancements, or reporting) based on product priority. Plan does not lock this; Step 6 will recommend one and state why.
- **Explicitly deferred:** Any failure or polish item that is intentionally left for a later sprint, with a short reason.

---

# Slice structure and acceptance criteria

## SLICE A — Test debt audit/spec

**Deliverable:** This plan document, with failure groups, root cause hypotheses, fix type (test-only vs code), safety, and order.

**Acceptance criteria:**

- All 13 failing suites assigned to a group (A–D).
- Each group has root cause hypothesis, fix type, “safe in program” yes, and required order.
- No app code written; plan only.

---

## SLICE B — Test debt cleanup execution

**Deliverable:** Fixes applied so that the failing tests in Phase 1 pass or are explicitly deferred with reason.

**Acceptance criteria:**

- Group A (dashboard) fixes applied in order 1–8; tests run and pass or are skipped/deferred with doc.
- Group B (topbar/shell) fix applied; test passes or deferred with doc.
- Group C (inventory) hooks fix and audit test fix applied; tests pass or deferred with doc.
- Group D (customer/timeline and customers API integration) fixes applied; tests pass or deferred with doc.
- No unrelated production behavior changed except where a test correctly identified a regression.
- Remaining failures, if any, listed in stabilization report with “deferred” and reason.

---

## SLICE C — Onboarding UX micro-polish

**Deliverable:** Small, high-value polish applied to the onboarding flow per Phase 2.

**Acceptance criteria:**

- Only allowed polish (spacing, microcopy, progress clarity, empty/error/loading, completion state, “finish later” affordance, responsive/dark-light token tweaks) applied.
- No step or lifecycle architecture change; no new required config.
- Touched files and changes documented in stabilization report.

---

## SLICE D — Docs / state of repo update

**Deliverable:** Stabilization report(s) and any updates to this plan or referenced docs.

**Acceptance criteria:**

- `POST_ONBOARDING_STABILIZATION_REPORT.md` created (after Step 3) with test fixes and onboarding polish.
- Security QA and perf notes created (Steps 4–5).
- Final report (Step 6) states: stabilization complete or not, prior failures resolved or deferred, onboarding polish complete or not, recommended next sprint, and what remains deferred.

---

## SLICE E — Next sprint recommendation and handoff

**Deliverable:** Clear recommendation for the next product sprint and handoff state.

**Acceptance criteria:**

- Recommended next feature sprint named and justified in final report.
- Explicit list of deferred items and short reason for each.
- Repo confidence stated (e.g. “green enough for next sprint” or “N known deferred failures”).

---

# Step 2 — Backend (completed)

**Scope:** Test/mock/fixture and test-infra only. No schema, route, auth/RBAC, or tenant changes. No production backend code changed.

**Changes made:**

| Area | Change |
|------|--------|
| **getDashboardV3Data.test.ts** | Extended Prisma mock with `vehicle.findMany`, `opportunity.findMany`, `deal.findMany`; in `beforeEach` mock all to `[]`. Updated assertions: 7d deltas expect `0` (trend returns zeros when mock returns empty arrays); 30d deltas remain `null`. Renamed one test to "metric deltas: 7d from trend, 30d null". |
| **audit.test.ts** | Photo-upload test no longer uses shared `ensureTestData()` vehicle (could hit 20-photo limit). Test now creates a dedicated vehicle with `AUDIT-PHOTO-${Date.now()}`, uploads one photo, then asserts audit rows for that vehicle. |
| **timeline-callbacks-lastvisit.test.ts** | "createCallback then listCallbacks returns the callback" now uses a dedicated customer created in-test (`prisma.customer.create`) so the callback list is not polluted by other tests; ensures the created callback is found in the first page. |
| **route.integration.test.ts (customers)** | `beforeAll(ensureTestData)` timeout increased to 15s so DB seed completes (test-infra only). |

**Verification:** All of the following pass: `getDashboardV3Data.test.ts`, `audit.test.ts`, `timeline-callbacks-lastvisit.test.ts`, `dashboard.test.ts`, `app/api/customers/route.integration.test.ts`.

**Handoff for Step 3:** No production backend changes. Proceed with UI/test debt cleanup (dashboard page/render/snapshots/tokens, topbar-lifecycle-badge, inventory permissions) and onboarding micro-polish per plan.

---

# Execution order (steps 2–6)

1. **Step 2 — Backend-engineer:** Only minimal backend or test-infra fixes required by Slice B (e.g. no schema/route/auth changes unless justified). ✅ Done.
2. **Step 3 — Frontend-engineer:** Part 1 = Slice B test debt cleanup (UI/test fixes). Part 2 = Slice C onboarding micro-polish. Update docs; create `POST_ONBOARDING_STABILIZATION_REPORT.md`.
3. **Step 4 — Security-QA:** Review changes; create `POST_ONBOARDING_STABILIZATION_SECURITY_QA.md`; apply only tiny fixes if required.
4. **Step 5 — Performance-pass:** Audit changes; create `POST_ONBOARDING_STABILIZATION_PERF_NOTES.md`; small hardening only if needed.
5. **Step 6 — QA-hardening:** Run tests, sanity checks, document; create `POST_ONBOARDING_STABILIZATION_FINAL_REPORT.md` with completion status, resolved/deferred failures, onboarding polish status, next sprint recommendation, and deferrals.

---

*End of Step 1 — Architect. No app code in this step.*

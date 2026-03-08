# Dealer Onboarding Completion — Final Report (Step 6 — QA Hardening)

**Sprint:** Dealer Onboarding Completion  
**Step:** 6 — QA Hardening  
**Scope:** Focused tests for get-started routing, onboarding flow step navigation, save/skip/complete behavior, dealership info step, launch/completion; lifecycle verification; responsive and dark/light sanity checks; documentation. No redesign; no route/RBAC changes unless a real hardening issue was found.

---

## 1. Changed files

### 1.1 New test files

| File | Purpose |
|------|--------|
| `app/(app)/get-started/__tests__/OnboardingFlowClient.test.tsx` | Step rail, loading/error/redirect, step 2 skip, step 6 finish/finish-later, PATCH skipStep |
| `app/(app)/get-started/steps/__tests__/DealershipInfoStep.test.tsx` | Load dealership name, Save and continue disabled when empty, PATCH + onNext on save |
| `app/(app)/get-started/steps/__tests__/LaunchStep.test.tsx` | "You're all set", next-action links, Go to dashboard / I'll finish later / Back handlers |
| `app/api/onboarding/route.test.ts` | GET returns state for ctx.dealershipId and guards read; PATCH completeStep/skipStep/markComplete/inventoryPathChosen and validation (single action) |

### 1.2 Modified files

| File | Change |
|------|--------|
| `app/(app)/get-started/__tests__/GetStartedClient.test.tsx` | Extended `OnboardingStatus` with `onboardingComplete` and `onboardingCurrentStep`; added test "shows Redirecting to dashboard and calls router.replace when has active dealership and onboarding complete" |

---

## 2. Tests run

All tests below were run with **Jest** (no Vitest/Playwright per project rules).

### 2.1 Onboarding and get-started focused suite

```bash
npx jest "onboarding-status|get-started|onboarding/route" --passWithNoTests
```

**Result:** 6 test suites, 31 tests, all passed.

| Suite | Tests | Status |
|-------|-------|--------|
| `app/api/auth/onboarding-status/route.test.ts` | 5 | Pass |
| `app/(app)/get-started/__tests__/GetStartedClient.test.tsx` | 5 | Pass |
| `app/(app)/get-started/__tests__/OnboardingFlowClient.test.tsx` | 7 | Pass |
| `app/(app)/get-started/steps/__tests__/DealershipInfoStep.test.tsx` | 3 | Pass |
| `app/(app)/get-started/steps/__tests__/LaunchStep.test.tsx` | 4 | Pass |
| `app/api/onboarding/route.test.ts` | 7 | Pass |

### 2.2 Coverage by area

- **Get-started routing states:** GetStartedClient — CASE 1 (select dealership), CASE 2 (pending invite), CASE 3 (no dealership), show onboarding flow when active dealership + incomplete, redirect when active dealership + complete.
- **Onboarding flow step navigation:** OnboardingFlowClient — loading then step rail and step 1; step 2 (Invite later, Back); step 6 (Go to dashboard, I'll finish later); error + Retry; isComplete redirect.
- **Save / skip / complete behavior:** OnboardingFlowClient — skip step triggers PATCH skipStep and updates state; API route — completeStep, skipStep, markComplete, inventoryPathChosen call correct service with ctx.dealershipId; PATCH validation (multiple actions → 400).
- **Dealership info save step:** DealershipInfoStep — loads name from GET /api/admin/dealership; Save and continue disabled when empty; Save and continue calls PATCH then onNext.
- **Launch/completion behavior:** LaunchStep — onFinish / onFinishLater / onBack; OnboardingFlowClient — "I'll finish later" calls router.replace without PATCH; API — markComplete calls markOnboardingComplete.
- **API onboarding:** GET uses ctx.dealershipId and admin.dealership.read; PATCH uses ctx.dealershipId and admin.dealership.write; single-action validation.

---

## 3. Lifecycle verification

| Lifecycle | Verification |
|-----------|--------------|
| **Incomplete onboarding** | GetStartedClient test: has active dealership and !onboardingComplete → onboarding flow is shown (OnboardingFlowClient with initialStep). OnboardingFlowClient test: GET returns non-complete state → step rail and step content render. |
| **Resumed onboarding** | OnboardingFlowClient uses initialStep from server and GET /api/onboarding state; step derived from state.currentStep. API GET returns current step; no test explicitly "resumes" mid-flow (covered by same flow with currentStep > 1 in mocks). |
| **Completed onboarding** | GetStartedClient: has active dealership and onboardingComplete → "Redirecting to dashboard" and router.replace("/dashboard"). OnboardingFlowClient: state.isComplete → "Redirecting to dashboard" and router.replace("/dashboard"). |
| **Finish-later path** | OnboardingFlowClient test: "I'll finish later" calls router.replace("/dashboard") and mockApiFetch call count remains 1 (no PATCH). LaunchStep test: "I'll finish later" calls onFinishLater. |

---

## 4. Responsive sanity checks

Manual checks recommended (no Playwright in scope):

- **/get-started (select dealership / pending invite / no dealership):** Layout readable and usable at 320px, 768px, 1024px; cards and buttons do not overflow; "Link me as Owner" visible.
- **/get-started (onboarding flow):** Step rail ("Step X of 6") and progress bar visible at narrow width; primary CTA (Save and continue, Continue, Go to dashboard) accessible; "I'll finish later" link visible; step content (DealershipInfoStep input, Team/Inventory buttons, Launch links) not clipped.
- **Step 1:** Dealership name input and Save and continue usable on small viewports.
- **Steps 2–6:** Buttons and links stack or wrap acceptably; no horizontal scroll on phone.

*Not run automatically; document for manual QA.*

---

## 5. Dark / light sanity checks

Manual checks recommended:

- **Tokens:** Flow uses CSS variables (`--text`, `--text-soft`, `--accent`, `--panel`, `--border`, `--danger`, etc.). Verify under both light and dark themes (if supported in app): step rail, cards, buttons, links, and error state remain readable and aligned.
- **Progress bar:** Inner bar uses `--accent`; track uses `--muted`. Check contrast in both themes.

*Not run automatically; document for manual QA.*

---

## 6. Unrelated failures (dealer test suite)

Full dealer Jest run (excluding integration/e2e) was executed to capture unrelated failures. The following failures are **not** in the onboarding completion flow and are listed separately.

| Suite / test | Failure type |
|--------------|--------------|
| `app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx` | `useSearchParams` is not a function (mock/setup) |
| `app/(app)/dashboard/__tests__/switchDealership-render.test.tsx` | getByText element not found |
| `modules/dashboard/tests/getDashboardV3Data.test.ts` | `prisma.vehicle.findMany` is not a function (mock) |
| `modules/inventory/ui/__tests__/inventory-permissions.test.tsx` | Rendered more hooks than during the previous render (VehicleDetailPage) |
| `modules/inventory/tests/audit.test.ts` | ApiError: Max 20 photos per vehicle |
| `modules/customers/tests/timeline-callbacks-lastvisit.test.ts` | createCallback then listCallbacks — found undefined |
| Snapshot failures | 2 snapshot failures in 1 suite |

**Onboarding and get-started tests:** All 31 tests in the scoped suites above passed. No changes were made to routes or RBAC for hardening; no redesign.

---

## 7. Summary

- **Added:** 4 new test files and 1 extended test file for get-started routing, onboarding flow (step navigation, save/skip/complete, finish-later), dealership info step, launch step, and GET/PATCH /api/onboarding.
- **Run:** 31 tests across 6 suites, all passing.
- **Lifecycle:** Incomplete, resumed, completed, and finish-later paths verified via unit tests and mocks.
- **Responsive and dark/light:** Documented as manual sanity checks; not automated in this step.
- **Unrelated failures:** Listed in §6; none in onboarding completion scope.

**Conclusion:** QA hardening for the onboarding completion flow is complete. Focused tests cover routing states, step navigation, save/skip/complete, dealership info save, and launch/completion behavior. No redesign or route/RBAC changes were applied.

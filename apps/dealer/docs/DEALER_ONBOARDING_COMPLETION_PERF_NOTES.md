# Dealer Onboarding Completion — Performance Notes

**Sprint:** Dealer Onboarding Completion  
**Step:** 5 — Performance Pass  
**Scope:** Onboarding completion flow only: `/get-started`, GetStartedClient, OnboardingFlowClient, step components, GET/PATCH `/api/onboarding`, onboarding-status integration, dealership info save path, team/inventory step links. No redesign; only small hardening if truly needed.

---

## 1. Step-to-step rerender cost

### 1.1 Single active step

- **OnboardingFlowClient** renders exactly one step at a time via `{ step === 1 && ... }`, `{ step === 2 && ... }`, etc. No list of six components; the previous step unmounts and the next mounts when `step` changes.
- **State updates:** After each PATCH, `setState(res.onboarding)` updates `state`; `step` is derived as `Math.max(1, Math.min(TOTAL_STEPS, state?.currentStep ?? initialStep))`. One state update per action; no cascading updates.
- **Handlers:** `handleBack`, `handleCompleteStep`, `handleSkipStep`, `handleSetInventoryPath`, `handleMarkComplete`, `handleFinishLater` are wrapped in `useCallback` with appropriate deps (`step`, `patch`, `addToast`, `router`). References are stable per step value, so step components do not receive new callbacks on every parent rerender except when `step` or loading state changes.
- **Verdict:** Rerender cost is bounded. One step component in the tree; handlers stable. No change.

### 1.2 Optional micro-optimization (documented only)

- **Step 3** receives `onSkip={() => handleSetInventoryPath("later")}`, which creates a new function reference on every render of OnboardingFlowClient. That can cause InventorySetupStep to rerender when the parent rerenders for unrelated reasons (e.g. toast). Impact is minimal (small component, few children). No code change applied; consider a stable `handleSkipInventoryLater = useCallback(() => handleSetInventoryPath("later"), [handleSetInventoryPath])` if profiling ever shows step 3 as a hot path.

---

## 2. Onboarding-status vs GET /api/onboarding — fetch churn

### 2.1 First load when the flow is shown

- **Server (get-started page):** Fetches `onboarding-status` and `dealerships` in parallel. When the user has an active dealership, **onboarding-status** calls `onboardingService.getOrCreateState(activeDealershipId)` and returns only `onboardingComplete` and `onboardingCurrentStep`. So the server performs one read (or create) of `DealershipOnboardingState` for that dealership.
- **Client:** When `showOnboardingFlow` is true, **OnboardingFlowClient** mounts and in a single `useEffect` runs **GET /api/onboarding**, which calls `getOrCreateState(ctx.dealershipId)` again. So the same dealership’s onboarding state is read (or created) a second time shortly after the first.
- **Assessment:** Two touches to onboarding state on first paint when showing the flow: one server-side (for routing/redirect and initial step), one client-side (for full state: completedSteps, skippedSteps, inventoryPathChosen, etc.). The client cannot avoid the GET: it needs the full state and does not receive it from the server today. Caching GET /api/onboarding (e.g. short-lived in-memory or SWR) was not introduced to avoid scope creep.
- **Verdict:** Acceptable duplicate read on initial flow load. No N+1; no repeated polling. No change.

### 2.2 No redundant refetch after PATCH

- After each PATCH, the client uses the **response body** (`res.onboarding`) to update local state; it does not call GET /api/onboarding again. So step transitions do not double-fetch.
- **Verdict:** Correct. No change.

---

## 3. PATCH /api/onboarding — lightweight updates

### 3.1 Request shape

- **Body:** Exactly one of `currentStep`, `completeStep`, `skipStep`, `inventoryPathChosen`, or `markComplete: true`. Validated by Zod; payload is a few bytes.
- **Verdict:** Minimal request size. No change.

### 3.2 Backend work per PATCH

- **advanceStep / setInventoryPathChosen:** `ensureOnboardingState` (one findUnique or one create) + `updateOnboardingState` (one update by `dealershipId`). Two DB operations, single row.
- **completeStep / skipStep / markOnboardingComplete:** `ensureOnboardingState` + `getOnboardingState` (findUnique) + `updateOnboardingState` (one update). Three DB operations, single row.
- All queries are scoped by `dealershipId` (unique index); no table scans, no N+1.
- **Verdict:** Lightweight. No change.

---

## 4. Step components — no thrash on navigation

### 4.1 DealershipInfoStep (step 1)

- **On mount:** One `useEffect` with empty deps runs **GET /api/admin/dealership** once. Uses a `cancelled` flag so that if the component unmounts before the request completes, `setState` is not called. No repeated fetch on rerender.
- **On “Save and continue”:** One PATCH to /api/admin/dealership (name only), then `onNext()`. No refetch of dealership after save; step advances and the component unmounts.
- **Verdict:** Single fetch on mount; cleanup on unmount. No thrash. No change.

### 4.2 Other steps (2–6)

- **TeamSetupStep, InventorySetupStep, CrmBasicsStep, OperationsBasicsStep, LaunchStep:** No data fetch on mount. They render static copy and buttons/links; no effect that runs on every mount. Navigation to/from these steps only mounts/unmounts the corresponding component.
- **Verdict:** No thrash. No change.

---

## 5. Progress rail / progress bar

### 5.1 Implementation

- **Markup:** A wrapper div with `role="progressbar"` and `aria-valuenow/min/max`, and an inner div whose width is `style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}`. No JS-driven animation; no requestAnimationFrame or intervals.
- **Transition:** `transition-all duration-200` on the inner div so step changes animate smoothly without layout thrash.
- **Verdict:** Stable, cheap rendering. No change.

---

## 6. Redirect to dashboard

### 6.1 When onboarding is complete (GetStartedClient)

- **Server-rendered decision:** `hasActiveDealership && onboardingComplete` from initial props. Client renders “Redirecting to dashboard…” and runs `router.replace("/dashboard")` and `router.refresh()` once in a `useEffect` with deps `[hasActiveDealership, onboardingComplete, router]`. No fetch; no polling.
- **Verdict:** Efficient. No change.

### 6.2 When flow returns isComplete (OnboardingFlowClient)

- After GET /api/onboarding, if `state?.isComplete` is true, the client calls `router.replace("/dashboard")` and `router.refresh()` and returns a short “Redirecting…” message. No extra GET or PATCH.
- **Verdict:** Efficient. No change.

### 6.3 After “Go to dashboard” (Launch step)

- **handleMarkComplete** runs one PATCH with `markComplete: true`, then on success calls `router.replace("/dashboard")` and `router.refresh()`. Single mutation, then navigation; no refetch.
- **Verdict:** Efficient. No change.

---

## 7. “Finish later” — no unnecessary requests

### 7.1 Behavior

- **handleFinishLater** (steps 1–5 and step 6 “I’ll finish later”): Only calls `router.replace("/dashboard")` and `router.refresh()`. No PATCH, no GET, no other API call.
- **Verdict:** No extra network requests. No change.

---

## 8. Get-started page — server fetches

### 8.1 Parallel fetches

- **Page** uses `Promise.all([fetchOnboardingStatus(cookieHeader), fetchDealerships(cookieHeader)])`. Two independent requests in parallel; no waterfall.
- **Verdict:** Acceptable. No change.

### 8.2 No client refetch of onboarding-status on get-started

- GetStartedClient does not refetch onboarding-status after mount. It relies on `initialOnboardingStatus` and `initialDealerships`. So there is no duplicate client call to onboarding-status for the same page load.
- **Verdict:** No redundant churn. No change.

---

## 9. Dealership info save path

### 9.1 Step 1 save

- **DealershipInfoStep** sends a single PATCH to **/api/admin/dealership** with body `{ name: trimmed }`. That route performs one dealership read (for audit) and one update; no list queries, no N+1.
- **Verdict:** Lightweight. No change.

---

## 10. Team / inventory step links

### 10.1 No fetch on link click

- **Team step:** Link to `/admin/users` and buttons “I’ve sent invites — continue” / “Invite later” only navigate or call the existing `onNext` / `onSkip` (which trigger one PATCH each). No extra API calls when clicking the link.
- **Inventory step:** Links to `/inventory/new` and `/inventory/bulk/import` are plain navigation. “Continue” / “Set up later” buttons call `onNext(path)` or `onSkip()`, each one PATCH. No duplicate requests.
- **Verdict:** No unnecessary requests from links or buttons. No change.

---

## 11. Summary

| Area                          | Finding                                                    | Action   |
|-------------------------------|------------------------------------------------------------|----------|
| Step-to-step rerender         | Single step mounted; handlers useCallback; bounded cost   | None     |
| onboarding-status + GET      | Two reads of onboarding state on first flow load; acceptable | None  |
| PATCH after action            | No refetch; state from response only                      | None     |
| PATCH backend                 | 2–3 DB ops per request; single row; no N+1                | None     |
| DealershipInfoStep           | One GET on mount; cleanup on unmount                      | None     |
| Other steps                   | No fetch on mount                                         | None     |
| Progress bar                  | CSS + inline width; no timers/RAF                         | None     |
| Redirect (complete / isComplete / Go to dashboard) | No extra requests                              | None     |
| Finish later                  | Navigation only; no PATCH/GET                             | None     |
| Page server fetches           | onboarding-status and dealerships in parallel            | None     |
| Dealership save               | Single PATCH; one read + one update                       | None     |
| Step 3 onSkip reference       | New function each render; minimal impact                  | Doc only |

**Conclusion:** The onboarding completion flow is performant for the current scope. No code or route changes were required. One optional micro-optimization (stable callback for step 3 onSkip) is documented for future profiling only.

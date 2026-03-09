# Dealer Onboarding Completion — Security QA

**Sprint:** Dealer Onboarding Completion  
**Step:** 4 — Security QA  
**Scope:** Implemented onboarding completion flow only: `/get-started`, GetStartedClient, OnboardingFlowClient, step components, GET/PATCH `/api/onboarding`, onboarding-status integration, dealership info save path, team/inventory step links and actions. No redesign; routes/RBAC unchanged unless a real issue was found.

---

## 1. Onboarding state access

### 1.1 No cross-dealership onboarding read/write

- **GET /api/onboarding** calls `getAuthContext(request)`, which uses `requireDealershipContext(user.userId, request)` to resolve `ctx.dealershipId` from the **session** (cookie or Bearer token). There is no query parameter or body; the client cannot supply a dealership ID.
- **PATCH /api/onboarding** uses the same `getAuthContext(request)` and thus the same `ctx.dealershipId`. The request body is validated by `patchBodySchema` to allow only one of: `currentStep`, `completeStep`, `skipStep`, `inventoryPathChosen`, `markComplete`. No `dealershipId` (or any other tenant identifier) is accepted.
- **Service and DB layer:** Every call passes a single `dealershipId` argument (from the route’s `ctx.dealershipId`). The DB uses `where: { dealershipId }` for all reads and updates. There is no path to read or write another dealership’s onboarding state.
- **Verdict:** No cross-dealership access. No change.

### 1.2 GET/PATCH /api/onboarding respect current dealership and permissions

- **GET** requires `guardPermission(ctx, "admin.dealership.read")`. If the user has no active dealership, `getAuthContext` throws (FORBIDDEN) before any onboarding call. If the user has an active dealership but lacks the permission, `guardPermission` throws. Only then is `onboardingService.getOrCreateState(ctx.dealershipId)` called.
- **PATCH** requires `guardPermission(ctx, "admin.dealership.write")`. Same pattern: no dealership or no permission → no mutation. All mutations use `ctx.dealershipId` only.
- **Verdict:** Correct. No change.

### 1.3 No unauthorized user can mutate onboarding state

- Unauthenticated requests fail at `requireUserFromRequest` inside `getAuthContext`.
- Authenticated users without an active dealership fail at `requireDealershipContext`.
- Users with an active dealership but without `admin.dealership.write` fail at `guardPermission` on PATCH. They never reach the service.
- **Verdict:** Only authenticated users with an active dealership and the appropriate permission can read or mutate onboarding state. No change.

---

## 2. Redirect logic

### 2.1 Only users with active dealership + incomplete onboarding see the flow

- **Server:** The get-started page fetches `onboarding-status` (and dealerships) with the request cookie. The response includes `hasActiveDealership` and, when that is true, `onboardingComplete` and `onboardingCurrentStep` from the **server** (onboarding-status uses `getActiveDealershipId(user.userId)` and then `getOrCreateState(activeDealershipId)`). No client-supplied flags.
- **Client:** `showOnboardingFlow = hasActiveDealership && !onboardingComplete`. Both values come from `initialOnboardingStatus` (server-rendered). The flow is shown only when the user has an active dealership and onboarding is not complete.
- **Verdict:** Intentional and safe. No change.

### 2.2 Completed onboarding routes correctly to dashboard

- When `hasActiveDealership && onboardingComplete`, GetStartedClient renders “Redirecting to dashboard…” and runs `router.replace("/dashboard")` in a `useEffect`. The user is sent to the dashboard; they do not see the 6-step flow or the select-dealership UI.
- OnboardingFlowClient, when it receives state with `isComplete: true` from GET /api/onboarding, also calls `router.replace("/dashboard")` and shows “Redirecting to dashboard…” so a direct hit to get-started after completion still redirects.
- **Verdict:** Correct. No change.

### 2.3 Non-owner / non-admin behavior remains intentional and safe

- Users **with** an active dealership but **without** `admin.dealership.read` (e.g. a member with no admin role): They receive `onboardingComplete` / `onboardingCurrentStep` from onboarding-status only when the server has already resolved their active dealership and loaded that dealership’s onboarding state. So they may see `showOnboardingFlow = true` (if the dealership’s onboarding is incomplete). When OnboardingFlowClient runs, it calls GET /api/onboarding, which then fails with 403 (no permission). The UI shows the error state (“Failed to load onboarding” + Retry). They do **not** see another dealership’s data; they simply cannot load the flow. Spec allows this for V1 (non-owners may see the flow entry; backend correctly denies access).
- Users **without** an active dealership: They never get `onboardingComplete` or `onboardingCurrentStep` (onboarding-status does not set them). So `showOnboardingFlow` is false. They see the existing “Select your dealership” / “Pending invite” / “No dealership” cases. No onboarding flow is shown.
- **Verdict:** Intentional and safe. No change.

---

## 3. Step actions

### 3.1 Dealership info save path only updates allowed data

- **DealershipInfoStep** calls **PATCH /api/admin/dealership** with body `{ name: trimmed }` only. That route (admin dealership) uses `getAuthContext` and `guardPermission(ctx, "admin.dealership.write")`, and updates the dealership with `ctx.dealershipId`. The route’s schema allows only `name`, `slug`, and `settings`; the step sends only `name`. No other fields (e.g. `id`, `dealershipId`, or other tenant data) are sent or accepted for update from this step.
- **Verdict:** Only allowed dealership data for the current tenant is updated. No change.

### 3.2 markComplete / completeStep / skipStep cannot be abused to corrupt state

- **PATCH body validation:** `patchBodySchema` allows **exactly one** of: `currentStep`, `completeStep`, `skipStep`, `inventoryPathChosen`, `markComplete`. The refine ensures at most one key is present. So a client cannot combine, e.g., `markComplete: true` with `completeStep: 1` in one request, or send raw `completedSteps` / `skippedSteps` / `isComplete` arrays or flags.
- **Server-side semantics:**  
  - `currentStep`: service `advanceStep(dealershipId, step)` clamps step to 1–6 and only updates `currentStep`.  
  - `completeStep`: service appends the step to `completedSteps` (from existing state), advances `currentStep`, and does not set `isComplete` or `completedAt`.  
  - `skipStep`: same pattern for `skippedSteps`.  
  - `inventoryPathChosen`: enum `"add_first" | "import" | "later"` only; service sets path and `currentStep: 4`.  
  - `markComplete`: service sets `isComplete: true`, `completedAt: now()`, and step 6 in `completedSteps`; only this path marks completion.
- **DB layer:** `updateOnboardingState` only applies allowed fields; `completedSteps` and `skippedSteps` are normalized via `ensureNumberArray` (valid step numbers 1–6 only). The API never accepts these arrays from the client.
- **Verdict:** Client cannot inject arbitrary completed/skipped arrays or force completion without using the single allowed action. No change.

### 3.3 Team / inventory links do not expose unauthorized flows

- **Team step:** Link to `/admin/users`. That route is protected by the app layout and existing RBAC; users without permission see 403 or are redirected. No query parameters or tokens are passed; no new authority is granted by the onboarding flow.
- **Inventory step:** Links to `/inventory/new` and `/inventory/bulk/import`. Same as above: existing route guards and permissions apply. The step only records the chosen path via PATCH /api/onboarding with `inventoryPathChosen`; it does not create inventory or trigger bulk import by itself.
- **Verdict:** Links only navigate to existing app routes; no additional exposure. No change.

---

## 4. Resume / finish-later behavior

### 4.1 Leaving onboarding does not mark completion incorrectly

- **“I’ll finish later”** (steps 1–5): Implemented as `handleFinishLater` in OnboardingFlowClient, which only calls `router.replace("/dashboard")`. No PATCH is made. So leaving the flow never sets `isComplete` or `completedAt`.
- **“I’ll finish later”** (step 6, Launch): Same: navigates to dashboard without calling PATCH. So completion is never set when the user explicitly chooses “finish later” on the launch step.
- **Closing the tab / navigating away:** No automatic save or PATCH on unload. The next time the user hits get-started, they resume from the last persisted step (from GET /api/onboarding or onboarding-status).
- **Verdict:** Completion is only set when the user clicks “Go to dashboard” on the Launch step, which sends `markComplete: true`. No change.

### 4.2 Returning resumes the correct step

- **Initial render:** GetStartedClient uses `onboardingCurrentStep` from server (onboarding-status). When the flow is shown, OnboardingFlowClient receives `initialStep={onboardingCurrentStep}`.
- **After mount:** OnboardingFlowClient fetches GET /api/onboarding and uses `state.currentStep` (with fallback to `initialStep`) to derive `step`. So the displayed step is always the server-authoritative one.
- **After any PATCH:** The response body contains the updated onboarding state; the client sets state from it, so `step` updates from the server. No client-only step manipulation that could desync from the backend.
- **Verdict:** Resume is server-driven; correct step is shown. No change.

### 4.3 Partial progress remains scoped to the dealership

- All PATCH requests to /api/onboarding use the session’s `ctx.dealershipId`; the client does not send a dealership ID. So any partial progress (currentStep, completedSteps, skippedSteps, inventoryPathChosen) is stored only for that dealership’s row in DealershipOnboardingState.
- **Verdict:** Correct. No change.

---

## 5. Onboarding-status integration

### 5.1 Onboarding state in onboarding-status is tenant-safe

- **GET /api/auth/onboarding-status** uses `requireUser()` and `getActiveDealershipId(user.userId)`. The active dealership comes from the session (cookie / membership), not from the request body or query.
- When `hasActiveDealership && activeDealershipId`, it calls `onboardingService.getOrCreateState(activeDealershipId)`. So the onboarding state returned is always for the user’s **current** active dealership. The response does not include raw `dealershipId`; it only exposes `onboardingComplete` and `onboardingCurrentStep` for that dealership.
- **Verdict:** No cross-tenant leakage. No change.

---

## 6. Summary

| Area                       | Finding                                                                 | Action   |
|----------------------------|-------------------------------------------------------------------------|----------|
| Cross-dealership access    | None; all onboarding APIs use session dealershipId only                 | None     |
| GET/PATCH permissions      | admin.dealership.read / .write enforced; no bypass                      | None     |
| Redirect logic             | Flow only when active dealership + incomplete; complete → dashboard    | None     |
| Non-owner / non-admin      | 403 on GET onboarding when no permission; no data leak                 | None     |
| Dealership info save        | Only name sent; admin dealership route scoped and validated             | None     |
| PATCH abuse                | Single-action schema; no client-supplied completed/skipped/isComplete   | None     |
| Team/inventory links       | Existing routes only; no new authority                                  | None     |
| Finish later / resume      | No completion on leave; step from server; progress per dealership      | None     |
| Onboarding-status          | activeDealershipId from session; state for that dealership only         | None     |

**Conclusion:** The implemented onboarding completion flow is consistent with the intended security model. No issues required code or RBAC changes. No fixes applied.

# Post-Onboarding Stabilization — Security QA (Step 4)

**Program:** Post-Onboarding Stabilization  
**Step:** 4 — Security-QA  
**Scope:** Production files touched in Step 3 only.  
**Date:** 2026-03-08

---

## Files reviewed

1. `components/dashboard-v3/InventoryWorkbenchCard.tsx`
2. `components/dashboard-v3/MetricCard.tsx`
3. `modules/inventory/ui/VehicleDetailPage.tsx`
4. `app/(app)/get-started/OnboardingFlowClient.tsx`

---

## 1. Dashboard token/color changes — permission and visibility

### InventoryWorkbenchCard.tsx

- **Change:** Badge and days-in-stock styling switched from raw Tailwind palette classes (e.g. `bg-emerald-500/15`, `text-red-400`) to CSS variables (`bg-[var(--success-muted)]`, `text-[var(--danger)]`, etc.).
- **Visibility/permission:** Unchanged. The component still receives `canReadInventory`, `canAddVehicle`, `canAddLead`, `canStartDeal` from the parent (DashboardExecutiveClient), which derives them from session permissions. Add Vehicle/Lead/Deal links and dropdown remain gated by these props. Data is still loaded via `apiFetch(\`/api/inventory?${params}\`)`, which is subject to backend RBAC and tenant scoping.
- **Conclusion:** No permission or visibility drift. Token change is presentation-only.

### MetricCard.tsx

- **Change:** Metric card border classes in `COLORS` changed from palette (e.g. `border-emerald-500/30`) to token-based (`border-[var(--success)]`, `border-[var(--accent)]`, etc.). Sparkline/glow still use hex/rgba in styles (no security impact).
- **Visibility/permission:** MetricCard is presentational; it receives `title`, `value`, `href` from the parent. Which metrics are shown is controlled by DashboardExecutiveClient and server-supplied `initialData`/permissions. No new data or permission logic.
- **Conclusion:** No permission or visibility drift.

---

## 2. VehicleDetailPage — hook-order fix and entity/signal behavior

- **Change:** `entityScope`, `headerSignals`, `contextSignals`, and `timelineSignalEvents` useMemos were moved above all early returns so hooks run unconditionally (fixing “Rendered more hooks than during the previous render”).
- **Entity scoping:** `entityScope` is `{ entityType: "Vehicle", entityId: vehicleId }`. `vehicleId` comes only from props (route/segment). The value and semantics are unchanged; the memo now runs on every render instead of only after vehicle is loaded. When the main content is rendered, the same `entityScope` is passed to `toHeaderSignals`, `toContextSignals`, and `toTimelineSignalEvents`.
- **Signal visibility:** In `surface-adapters.ts`, when `entity` scope is provided, items are filtered by `entityType` and `entityId`. So signals remain scoped to the current vehicle. Moving the memos does not change inputs or filter logic; it only stabilizes hook order.
- **Data flow:** Vehicle data is still loaded only when `canRead` is true, via `apiFetch(\`/api/inventory/${vehicleId}\`)`. Backend enforces tenant and permissions. Photo URLs and signals are unchanged in how they are fetched and scoped.
- **Conclusion:** No change to entity scoping or signal visibility. Hook-order fix is safe and does not alter security or data boundaries.

---

## 3. OnboardingFlowClient — micro-polish and state/API behavior

- **Changes:** Copy only: loading text, error fallback string, completion toast, “Finish later” button label and supporting text; plus focus-visible styling on the finish-later button. No new state, no new API calls, no new routes or parameters.
- **State and API:** `handleMarkComplete` still performs a single PATCH with `{ markComplete: true }`, then shows a toast and redirects. `handleFinishLater` still only calls `router.replace("/dashboard")` and `router.refresh()`; it does not call PATCH or mutate onboarding state.
- **Conclusion:** No bypass, no new state leakage, no change to completion or step semantics.

---

## 4. Finish-later path and completion state

- **Finish-later behavior:** `handleFinishLater` is client-only navigation. It does not send `markComplete: true` or any other PATCH. Server-side onboarding state (e.g. `currentStep`, `isComplete`) is unchanged when the user clicks “Finish later.”
- **Completion:** Completion is set only when the user completes the flow and the client calls `handleMarkComplete`, which sends `markComplete: true` to the API. Finish-later does not corrupt or shortcut completion state.
- **Resume:** User can return to `/get-started` and resume from the stored step; no security or state inconsistency introduced.
- **Conclusion:** Finish-later path remains safe and does not corrupt onboarding completion state.

---

## 5. Test-fix work and masking of security issues

- **Step 3 test fixes reviewed:** Mocks (`useSearchParams`, `hasPermission`), assertion text (e.g. “Dashboard” → “New Leads”), snapshot updates, and the VehicleDetailPage hooks-order fix. These do not relax or alter production RBAC, permission checks, or API behavior. The hooks fix is a correct React pattern (no conditional hooks) and does not change what data is shown or to whom.
- **Conclusion:** No test-only change was found to mask a real security issue. Production behavior remains consistent with intended permission and tenant boundaries.

---

## 6. Summary and actions

| Check | Result |
|-------|--------|
| Permission/visibility drift from dashboard token/color changes | None. Presentation-only; gates remain props/API-driven. |
| VehicleDetailPage hook-order vs entity scoping / signal visibility | No change. Same `vehicleId` and entity scope; adapters unchanged. |
| Onboarding micro-polish introducing bypass or state leakage | None. Copy and styling only; no new state or API. |
| Finish-later path and completion state | Safe. No PATCH on finish-later; completion only via markComplete. |
| Test fixes masking security issues | None identified. |

**Actions taken:** None. No code or config changes were required. No backend, route, or RBAC changes.

---

*End of Step 4 — Security-QA. Review limited to the four production files listed above; no redesign.*

# Post-Onboarding Stabilization — Performance Notes (Step 5)

**Program:** Post-Onboarding Stabilization  
**Step:** 5 — Performance pass  
**Scope:** Production files touched in Step 3 only.  
**Date:** 2026-03-08

---

## Files audited

1. `components/dashboard-v3/InventoryWorkbenchCard.tsx`
2. `components/dashboard-v3/MetricCard.tsx`
3. `modules/inventory/ui/VehicleDetailPage.tsx`
4. `app/(app)/get-started/OnboardingFlowClient.tsx`

---

## 1. Token/color refactors — render churn

### InventoryWorkbenchCard.tsx

- **Change:** `badgeStyle(variant)` and `daysColor(days)` now return token-based class strings (e.g. `text-[var(--danger)]`) instead of palette classes. Both remain pure functions with no new closures or allocations.
- **Render path:** They are invoked per row inside `filteredRows.map(...)`. The number of calls and the cost per call are unchanged; only the returned string content differs. `filteredRows` is already memoized with `useMemo(..., [rows, query])`.
- **Effects/callbacks:** `fetchRows` useCallback and the two useEffects are unchanged; dependency arrays and effect count are the same.
- **Conclusion:** No additional render churn. Dashboard/workbench table rendering remains stable.

### MetricCard.tsx

- **Change:** `COLORS` entries use token-based border classes (e.g. `border-[var(--success)]`) instead of palette classes. `COLORS` is a static module-level object; `theme = COLORS[color]` is a simple lookup each render.
- **Render path:** No new state, effects, or memoization. Sparkline and glow logic are unchanged. No extra re-renders or allocations introduced by the token refactor.
- **Conclusion:** No render churn. Metric card rendering remains stable.

---

## 2. VehicleDetailPage — hook-order fix and recomputation cost

- **Change:** `entityScope`, `headerSignals`, `contextSignals`, and `timelineSignalEvents` useMemos were moved above all early returns so they run on every render.
- **Before:** These memos ran only when the component reached the main content branch (vehicle loaded, no error/notFound). So they did not run during loading, error, or notFound.
- **After:** They run on every render. When in loading/error/notFound, the memo results are not used (we return early), but React still runs the memos to keep hook order stable.

**Recomputation cost:**

- `entityScope`: `useMemo(() => ({ entityType: "Vehicle", entityId: vehicleId }), [vehicleId])` — trivial object creation; `vehicleId` is stable per route.
- `headerSignals`: `toHeaderSignals(surfaceSignals, { maxVisible: 3, entity: entityScope })` — when loading, `surfaceSignals` is `[]`; the adapter does a small amount of work. When vehicle is loaded, same as before.
- `contextSignals`: depends on `surfaceSignals`, `entityScope`, `headerSignals` — same pattern; cost is proportional to `surfaceSignals.length` (capped by fetch).
- `timelineSignalEvents`: same idea.

So the only “extra” work is running these four memos on the loading/error/notFound renders. For those, `surfaceSignals` is typically `[]` (initial state) or the result of the single fetch; the adapters are pure and cheap. No additional network requests or subscriptions were introduced.

- **Conclusion:** Hook-order fix adds a small, bounded amount of recomputation (four memos on every render, with cheap inputs in early-return cases). No unnecessary dependency churn; no new requests. Acceptable and no change recommended.

---

## 3. Onboarding micro-polish — requests and rerender churn

- **Changes:** Copy only (loading text, error fallback, completion toast, finish-later label/copy) and one button `className` (focus-visible ring). No new state, no new useCallback/useEffect, no new API calls.
- **Requests:** Still one GET on mount (`fetchOnboarding`) and PATCH only on user actions (back, next, skip, complete, set inventory path, mark complete). No change.
- **Rerenders:** Same state shape and update paths. Handlers remain memoized with the same dependency arrays. No new causes for rerenders.
- **Conclusion:** No extra requests or rerender churn.

---

## 4. Finish-later path — request-free and lightweight

- **Implementation:** `handleFinishLater` is `useCallback(() => { router.replace("/dashboard"); router.refresh(); }, [router])`. No `apiFetch`, no PATCH, no state update before navigation.
- **Cost:** Two Next.js router calls (client-side navigation + refresh). No network request for “finish later” itself.
- **Conclusion:** Finish-later remains request-free and lightweight. No change needed.

---

## 5. Dashboard/workbench stability after token changes

- **Workbench (InventoryWorkbenchCard):** Data flow and list rendering are unchanged. `filteredRows` memo, `fetchRows` callback, and effects are unchanged. Token-based class names do not affect list length, keys, or component tree shape. No new context or subscriptions.
- **MetricCard:** Used in the dashboard KPI row; still receives props from parent and renders a single card. Token border/sparkline classes do not change render frequency or child structure.
- **Conclusion:** Dashboard and workbench rendering remain stable after the token/color refactors.

---

## 6. Summary

| Check | Result |
|-------|--------|
| Token/color refactors introducing render churn | None. Pure string/class changes; memos and effects unchanged. |
| VehicleDetailPage hook-order fix adding unnecessary recomputation | Small extra cost (four memos on every render, cheap when loading). No new requests; acceptable. |
| Onboarding micro-polish adding extra requests or rerender churn | None. Copy and one className only. |
| Finish-later remaining request-free and lightweight | Yes. Router only; no API calls. |
| Dashboard/workbench stable after token changes | Yes. Same data flow and render shape. |

**Actions taken:** None. No code or config changes. No backend, route, or RBAC changes.

---

*End of Step 5 — Performance pass. Audit limited to the four production files listed above; no redesign.*

# Dashboard VFinal Performance Notes

## Scope

Step 3 performance audit for Dashboard VFinal layout pass:

- fixed 3-row dashboard composition (KPI row, 8/4 main split, 5/4/3 lower row)
- new workbench + summary/stack surfaces in `components/dashboard-v3/*`
- existing server-first dashboard data path and layout persistence

No backend contract changes were introduced in this pass.

## Current loading model

- **Server-first preserved for core dashboard payload**
  - `app/(app)/dashboard/page.tsx` still loads `getDashboardV3Data(...)` on the server.
  - widget layout persistence flow remains unchanged and server-computed.
- **Client refresh model preserved**
  - existing refresh token pattern is still used for client-side signal updates.

## Performance findings

- **Layout cost remains bounded**
  - row composition is static and predictable; no deep nested dynamic layout branching.
  - card density increased intentionally, but DOM depth stays within expected range for dashboard pages.
- **Derived computation cost is low**
  - KPI-5 health score uses bounded list counts already in memory.
  - no heavy per-render transforms were added.
- **No hidden duplicate render trees**
  - dark/light parity relies on theme tokens only; same component tree for both themes.

## Hardening applied in Step 3

1. **Inventory workbench fetch guard**
   - `InventoryWorkbenchCard` now skips API fetch work when inventory read permission is absent.
   - prevents unnecessary unauthorized/no-op requests and state churn.

2. **Acquisition insights fetch guard**
   - `AcquisitionInsightsCard` now supports explicit read gating and avoids acquisition fetch when permission is missing.
   - falls back to lightweight unavailable state instead of repeated error-driven updates.

3. **Test-mode async noise reduction**
   - network-driven effects are bypassed in test env for these new client fetch widgets, reducing asynchronous state-update churn in render/snapshot tests.

## Risks reviewed

- **Client fetch-on-mount overhead**
  - still present for some intelligence-backed surfaces by design; bounded by small limits and card count.
- **Layout thrash risk during refresh**
  - low; widget shells maintain fixed padding and border boxes, minimizing visual jumps.
- **Responsive hidden-duplicate risk**
  - low; breakpoint behavior reflows a single tree rather than rendering alternate dashboard trees.

## Follow-up recommendations

1. Prefer server-provided initial rows for the inventory workbench in a future pass to reduce first-mount client fetch dependency.
2. Consolidate domain-signal fetches for dashboard-only surfaces into a thin shared dashboard adapter cache (per refresh token) to avoid repeated endpoint calls.
3. Add a small perf smoke assertion around dashboard hydration and refresh latency in CI for regression detection.

## Conclusion

Dashboard VFinal remains performant for current scope: core data stays server-first, layout is stable, and additional client fetch overhead is now permission-gated in the new surfaces. The resulting composition meets the visual target without introducing high-risk render or network churn.

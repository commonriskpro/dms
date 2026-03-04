# BUG: React #310 (hook order) on /dashboard?switchDealership=<uuid>

## Summary

After platform onboarding, loading `/dashboard?switchDealership=<uuid>` crashes the dealer app with minified React error #310 ("Rendered more hooks than during the previous render").

## Root cause (Architect finding)

**File:** `apps/dealer/modules/search/ui/GlobalSearch.tsx`  
**Component:** `GlobalSearch`

The component has **early returns before hooks**:

- Lines 78–80: `if (!canSearch) return null;` and `if (!activeDealership) return null;`
- Lines 82–105: `useCallback` (runSearch)
- Lines 107–119: `useEffect` (debounce)
- Lines 121–129: `useEffect` (click outside)
- Lines 181–185: `useEffect` (scroll into view)

When `activeDealership` is null (e.g. first paint after redirect with `switchDealership` before session refetch), the component returns after ~12 hooks. After the dashboard’s switch effect runs and session refetches, `activeDealership` is set; the component then runs the same 12 hooks **plus** the `useCallback` and three `useEffect` calls. That increases the hook count between renders and triggers React #310.

## Why it appears after platform onboarding

1. User accepts invite (or completes onboarding) and is redirected to `/dashboard?switchDealership=<uuid>`.
2. First render: session may still show no `activeDealership` (or old one). `GlobalSearch` is mounted inside `Topbar` (AppShell). It runs hooks 1–12 then hits `if (!activeDealership) return null`.
3. Dashboard page runs its switch effect, calls `PATCH /api/auth/session/switch`, then `refetch()`.
4. Session updates; re-render. Now `activeDealership` is set. `GlobalSearch` runs hooks 1–12, does **not** return early, then runs `useCallback` and three `useEffect`s.
5. React sees more hooks than on the previous render → error #310.

## Components reviewed (no hook violations)

- `apps/dealer/app/dashboard/page.tsx` — All hooks at top; early returns after hooks. OK.
- `apps/dealer/app/dashboard/layout.tsx` — Server layout; no hooks. OK.
- `apps/dealer/app/layout.tsx` — Root layout; no hooks. OK.
- `apps/dealer/app/providers.tsx` — Simple composition. OK.
- `apps/dealer/contexts/session-context.tsx` — Hooks unconditional. OK.
- `apps/dealer/contexts/dealer-lifecycle-context.tsx` — Hooks unconditional. OK.
- `apps/dealer/components/auth-guard.tsx` — Hooks at top; early return after. OK.
- `apps/dealer/components/app-shell/index.tsx` — No hooks. OK.
- `apps/dealer/components/app-shell/topbar.tsx` — Hooks at top. OK.
- `apps/dealer/components/app-shell/sidebar.tsx` — Hooks at top. OK.
- `apps/dealer/components/suspended-banner.tsx` — Hooks before early return. OK.

## Fix direction

1. **GlobalSearch:** Move all hooks to the top; call `useCallback` and all `useEffect`s unconditionally. Then, after all hooks, return `null` when `!canSearch || !activeDealership`, otherwise return the search UI. Hook count must be identical on every render.
2. **ErrorBoundary:** Add a minimal ErrorBoundary around the app shell; log only safe data (no tokens/cookies).
3. **Regression test:** Jest test that renders dashboard with and without `switchDealership` and asserts no runtime error.
4. **Backend:** Verify `PATCH /api/auth/session/switch` and `GET /api/auth/session`; add Jest test for switch + session.

## References

- React error #310: "Rendered more hooks than during the previous render" (hook order / conditional hooks).
- Rules of Hooks: https://react.dev/reference/rules/rules-of-hooks

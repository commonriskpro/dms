# Fix: React #310 on /dashboard?switchDealership=<uuid>

## Root cause

**File:** `apps/dealer/modules/search/ui/GlobalSearch.tsx`  
**Component:** `GlobalSearch`

The component had **early returns before all hooks**. It returned `null` when `!canSearch` or `!activeDealership` (lines 78–80), then **after** that ran `useCallback` and three `useEffect` hooks. So:

- When `activeDealership` was null (e.g. first load after redirect with `switchDealership` before session refetch), the component ran 12 hooks and returned.
- After the dashboard’s switch effect ran and session refetched, `activeDealership` was set; the component then ran the same 12 hooks **plus** the `useCallback` and three `useEffect`s.
- React saw more hooks on the second render → **React error #310** (“Rendered more hooks than during the previous render”).

## Why it triggered after platform onboarding

1. User is sent to `/dashboard?switchDealership=<uuid>` (e.g. after accepting an invite).
2. First render: session may still have no `activeDealership`. `GlobalSearch` lives in the Topbar (AppShell). It runs hooks 1–12, then hits `if (!activeDealership) return null`.
3. Dashboard runs its switch effect, calls `PATCH /api/auth/session/switch`, then `refetch()`.
4. Session updates; re-render. `activeDealership` is now set. `GlobalSearch` runs hooks 1–12, does **not** return early, then runs the remaining hooks → hook count increases → crash.

## Fix

1. **GlobalSearch**
   - All hooks (`useCallback`, all `useEffect`s) are now called **unconditionally** at the top of the component.
   - The “no permission / no active dealership” check runs **after** all hooks; we then `return null` or return the search UI. Hook count is the same on every render.
   - The debounce `useEffect` only runs search when `canSearch && activeDealership` (guarded inside the effect) so we still avoid API calls without a tenant.

2. **ErrorBoundary**
   - `apps/dealer/components/ErrorBoundary.tsx`: logs only safe data (`message`, `componentStack`, `pathname`, `searchParamKeys`). No tokens or cookies.

3. **Source maps**
   - `productionBrowserSourceMaps: true` in `apps/dealer/next.config.mjs` for easier production debugging.

4. **Tests**
   - `apps/dealer/app/api/auth/session/route.test.ts`: GET session returns 200 with `activeDealership` when set.
   - `apps/dealer/app/dashboard/__tests__/switchDealership-render.test.tsx`: dashboard renders without crash with and without `switchDealership`, and when `activeDealership` is null.

## Verification

- Tenant isolation unchanged: session/switch and session still use membership and cookie; no logic change.
- RBAC unchanged: no permission bypass.
- No PII/tokens in ErrorBoundary logs.
- Switch effect still runs once (ref guard in dashboard page).
- All hooks in GlobalSearch run on every render; no new fetch-on-mount.

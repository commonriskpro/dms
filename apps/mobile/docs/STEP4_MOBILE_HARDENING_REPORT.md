# Step 4 — Mobile Hardening Report

## Summary

Full hardening pass for the Dealer mobile app (apps/mobile) and its integration with apps/dealer. Scope: security, QA, reliability, auth, navigation, config, API robustness, production readiness. No broad redesign; no new features except those required to harden existing flows.

**apps/platform was not touched.**

---

## A. Auth hardening

### Issues fixed

- **Multiple auth state sources:** Different components (AuthGate, Login, Index, More) each called `useAuth()` and got independent state, so login success did not update the layout’s idea of auth and navigation could stay on login.
- **No single source of truth:** Auth state was local to each hook instance.

### Changes

- **Single source of truth:** Introduced `AuthProvider` and `AuthContext` in `src/auth/auth-context.tsx`. All `useAuth()` usage now reads from this context.
- **Bootstrap states:** Auth has explicit states: `loading`, `authenticated`, `unauthenticated`. Root layout only runs redirects when `status !== "loading"`.
- **Login success:** `signIn` updates context; AuthGate (same context) re-renders and runs `router.replace("/(tabs)")` so the shell transitions immediately after login.
- **Logout:** `signOut` in AuthProvider clears Secure Store (via auth-service), clears TanStack Query cache (`queryClient.clear()`), sets state to `unauthenticated`; AuthGate redirects to login.
- **401 handling:** API client tries refresh once and retries the request once. If still 401, calls `onUnauthorized()` (set by AuthGate to `signOut`), then throws. No infinite retry loop.
- **use-auth.ts:** Now re-exports from `auth-context` so existing imports keep working.

### Files touched

- `src/auth/auth-context.tsx` (new)
- `src/auth/use-auth.ts` (re-export only)
- `src/api/on-unauthorized.ts` (new)
- `app/_layout.tsx` (AuthProvider, setOnUnauthorized, redirect logic)

---

## B. Env / config hardening

### Issues fixed

- **Import-time crashes:** Supabase client was created at module load using env; missing vars caused "supabaseUrl is required" or similar and could break route modules.
- **No validation:** Env was read without checking required vars in one place.

### Changes

- **Central validation:** `src/lib/env.ts` now validates all required vars on first access and throws `ConfigError` with a message listing **missing variable names only** (no secret values).
- **Lazy Supabase client:** `src/auth/supabase.ts` uses a getter/lazy init so env is only read when auth is first used; export kept backward-compatible via Proxy.
- **Root config gate:** Root layout calls `getConfigError()` synchronously on first render; if config is invalid, it renders `ConfigErrorScreen` with a clear message and hint to copy `.env.example` to `.env`.
- **ConfigErrorScreen:** `src/components/config-error-screen.tsx` shows a user-safe message and setup hint.

### Required variables

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_DEALER_API_URL`

### Files touched

- `src/lib/env.ts` (validateEnv, ConfigError, getConfigError)
- `src/auth/supabase.ts` (lazy getSupabase, Proxy for `supabase`)
- `src/components/config-error-screen.tsx` (new)
- `app/_layout.tsx` (config check before rendering app)
- `.env.example` (comments, Android emulator hint)
- `README.md` (setup steps, env description)

---

## C. Routing / navigation hardening

### Changes

- **Valid default exports:** All route files under `app/` have a single default export (no change needed; verified).
- **Auth gating:** AuthGate runs only when `state.status !== "loading"`; unauthenticated users are sent to `/(auth)/login`, authenticated users on `(auth)` are sent to `/(tabs)`. Single context prevents inconsistent auth view.
- **Index:** Keeps redirect on load (to tabs or login); works with shared auth state.
- **Detail params:** Inventory, customers, and deals detail screens use `safeId(raw.id)` so `id` from `useLocalSearchParams` is normalized when it’s an array (Expo Router can pass `string | string[]`).
- **No flicker:** Redirects are driven by one auth state; no competing redirects between index and AuthGate.

### Files touched

- `app/_layout.tsx`
- `app/(tabs)/inventory/[id].tsx`, `customers/[id].tsx`, `deals/[id].tsx` (safeId, retry on error)

---

## D. API client hardening

### Changes

- **Authorization:** Token is obtained via `getValidAccessToken()` and set as `Authorization: Bearer <token>` in one place in `dealerFetch`. No token logging.
- **URL normalization:** `normalizeUrl(baseUrl, path)` strips trailing slashes from base and leading slashes from path, then joins with a single `/` to avoid double slashes and malformed URLs.
- **Non-2xx:** All non-ok responses go through `parseErrorResponse(status, body)` for consistent `DealerApiError` with code, message, status.
- **Network/timeout:** Fetch wrapped in try/catch; timeout via `AbortController` (30s). Network/fetch failures and timeouts turned into user-friendly messages (e.g. "Network error", "Could not reach server", "Request timed out") via `userFriendlyMessage()`.
- **401 path:** One refresh attempt, one retry. If still 401, `getOnUnauthorized()` is invoked (sign out), then error is thrown. No parallel refresh storms; retry is gated by `retried` flag.
- **No token in logs:** No `console.log` or error serialization of tokens or secrets.

### Files touched

- `src/api/client.ts` (normalizeUrl, timeout, network handling, 401 → onUnauthorized)
- `src/api/on-unauthorized.ts` (new)
- `src/api/errors.ts` (unchanged; already safe)

---

## E. Query / cache hardening

### Changes

- **Default options:** QueryClient created with `staleTime: 60_000`, `retry: 1`, `retryDelay` (exponential backoff cap 5s).
- **Logout:** AuthProvider’s `signOut` calls `queryClient.clear()` so cached dealer data is cleared on sign out.
- **Pull-to-refresh:** Dashboard, inventory, customers, deals lists already use `RefreshControl` and `refetch`; left as is.
- **Stable keys:** Query keys are structured (e.g. `["me"]`, `["inventory", { search, limit, offset }]`, `["inventory", id]`).

### Files touched

- `app/_layout.tsx` (QueryClient defaultOptions)
- `src/auth/auth-context.tsx` (signOut clears queryClient when provided)

---

## F. Screen / feature hardening

### Changes

- **Loading:** Dashboard and list/detail screens show explicit loading (ActivityIndicator or "Loading…") when `isLoading && !data`.
- **Empty:** Lists show "No vehicles/customers/deals found" when `data` is present and list is empty.
- **Error + retry:** All list and detail screens (dashboard, inventory, customers, deals and their details) show a user-friendly error message and a "Retry" button that calls `refetch()`.
- **Invalid/missing params:** Detail screens use `safeId(raw.id)` and show "Invalid vehicle/customer/deal" when `id` is missing.
- **Login:** Duplicate submit prevented with a `submitting` ref in addition to `loading` state; button disabled while loading.
- **Sign out:** More screen uses context `signOut`; AuthProvider ensures session and cache are cleared and state is updated.

### Files touched

- `app/(auth)/login.tsx` (submitting ref)
- `app/(tabs)/index.tsx` (error + Retry)
- `app/(tabs)/inventory/index.tsx`, `customers/index.tsx`, `deals/index.tsx` (error + Retry, styles)
- `app/(tabs)/inventory/[id].tsx`, `customers/[id].tsx`, `deals/[id].tsx` (safeId, error + Retry)

---

## G. Mobile security hardening

### Verified

- **Tokens:** Stored only in Expo Secure Store (`session-store.ts`). No AsyncStorage for tokens.
- **No token logging:** No `console.log`/`debug`/`info` of tokens, session, or Authorization in mobile src.
- **No secrets in UI:** Config error screen and env validation expose only variable names, not values.
- **Single backend:** Only `EXPO_PUBLIC_DEALER_API_URL` is used for API base; no platform or other backend references.
- **No platform:** Grep for `platform`/`apps/platform` in apps/mobile source: no matches.
- **Dealership context:** Server is source of truth (Bearer + first active membership or cookie); client does not supply or trust dealership context for authorization.

---

## H. Dealer backend (mobile integration)

### Audited

- `apps/dealer/lib/auth.ts` — getCurrentUserFromRequest, requireUserFromRequest (Bearer or cookie). Unchanged in this pass.
- `apps/dealer/lib/supabase/bearer.ts` — getUserFromBearerToken. Unchanged.
- `apps/dealer/lib/tenant.ts` — getFirstActiveDealershipIdForUser, getActiveDealershipId(..., request). Unchanged.
- `apps/dealer/lib/api/handler.ts` — getAuthContext uses requireUserFromRequest and requireDealershipContext(userId, request). Unchanged.
- `apps/dealer/app/api/me/route.ts` — GET /api/me shape stable: user, dealership, permissions.

No dealer code changes in Step 4. Bearer path and /api/me are already correct and safe.

---

## I. Tests and QA

### Tests added

- **api/errors:** `src/api/__tests__/errors.test.ts` — unit tests for `isApiErrorBody` and `parseErrorResponse` (valid server body, 401 with null body, 500 with invalid body).
- **Jest:** `jest.config.js` (preset jest-expo, moduleNameMapper for `@/`), `package.json` script `"test": "jest --passWithNoTests"` and devDependencies `jest`, `jest-expo`.

### Docs created

- **STEP4_MOBILE_HARDENING_REPORT.md** (this file)
- **STEP4_MOBILE_SMOKE_CHECKLIST.md** — manual smoke checklist
- **STEP4_MOBILE_KNOWN_LIMITATIONS.md** — known limitations and follow-ups

---

## Exact files changed (mobile)

| File | Change |
|------|--------|
| `src/auth/auth-context.tsx` | New: AuthProvider, useAuth from context, signOut clears queryClient |
| `src/auth/use-auth.ts` | Re-export from auth-context |
| `src/auth/supabase.ts` | Lazy getSupabase, Proxy for backward compatibility |
| `src/auth/session-store.ts` | No change |
| `src/auth/auth-service.ts` | No change |
| `src/lib/env.ts` | validateEnv, ConfigError, getConfigError, no secret in messages |
| `src/api/client.ts` | normalizeUrl, timeout, network errors, 401 → onUnauthorized |
| `src/api/on-unauthorized.ts` | New: set/get callback for 401 sign out |
| `src/api/errors.ts` | No change |
| `src/api/endpoints.ts` | No change |
| `src/api/__tests__/errors.test.ts` | New: unit tests for errors |
| `src/components/config-error-screen.tsx` | New: config error UI |
| `app/_layout.tsx` | AuthProvider, config gate, setOnUnauthorized, QueryClient defaults |
| `app/index.tsx` | No change |
| `app/(auth)/login.tsx` | submitting ref to prevent double submit |
| `app/(tabs)/index.tsx` | Error state + Retry button |
| `app/(tabs)/inventory/index.tsx` | Error state + Retry |
| `app/(tabs)/inventory/[id].tsx` | safeId, error + Retry |
| `app/(tabs)/customers/index.tsx` | Error state + Retry |
| `app/(tabs)/customers/[id].tsx` | safeId, error + Retry |
| `app/(tabs)/deals/index.tsx` | Error state + Retry |
| `app/(tabs)/deals/[id].tsx` | safeId, error + Retry |
| `app/(tabs)/more/index.tsx` | No change (uses context signOut) |
| `.env.example` | Comments, Android emulator hint |
| `README.md` | Env setup, config error behavior |
| `package.json` | test script, jest, jest-expo |
| `jest.config.js` | New |
| `docs/STEP4_MOBILE_HARDENING_REPORT.md` | New |
| `docs/STEP4_MOBILE_SMOKE_CHECKLIST.md` | New |
| `docs/STEP4_MOBILE_KNOWN_LIMITATIONS.md` | New |

### Dealer backend

No files changed in apps/dealer for Step 4.

---

## Remaining risks and follow-ups

- **Multi-dealership:** Mobile still uses “first active membership” when no cookie; switching dealership is not implemented.
- **Offline:** No offline persistence; structure is ready for future caching.
- **E2E:** No automated E2E; manual smoke checklist covers critical paths.
- **Deep link:** Direct open to `/(tabs)/inventory/123` when unauthenticated is handled by AuthGate (redirect to login), but no deep-link-specific tests.

See **STEP4_MOBILE_KNOWN_LIMITATIONS.md** for full list.

---

## Confirmation

- **apps/platform** was not modified and is not referenced by the mobile app.
- All changes are confined to **apps/mobile** except documentation; **apps/dealer** was only audited, not changed.

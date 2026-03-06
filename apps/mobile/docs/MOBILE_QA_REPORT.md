# Dealer Mobile App — QA Report

## Scope

- Mobile app: **apps/mobile**
- Backend: **apps/dealer** only
- **apps/platform**: not used by mobile

## Checks performed

### 1. No apps/platform usage

- **Result:** Pass
- Mobile app does not import from `apps/platform`.
- No references to platform routes, admin, or platform-only APIs in mobile source.
- Only mentions of "platform" are in docs (MOBILE_BUILD_SPEC.md) stating it is out of scope.

### 2. Backend source of truth

- **Result:** Pass
- All API calls go to dealer API base URL (`EXPO_PUBLIC_DEALER_API_URL`).
- Typed methods in `src/api/endpoints.ts`: getMe, listInventory, getInventoryById, listCustomers, getCustomerById, listDeals, getDealById.
- No other backend or API base URLs in mobile source.

### 3. Auth token handling

- **Result:** Pass
- Supabase email/password login; session stored in **Expo Secure Store** only (src/auth/session-store.ts).
- No AsyncStorage for tokens; no token logging.
- API client (src/api/client.ts) injects `Authorization: Bearer <access_token>`; token obtained via `getValidAccessToken()` which uses Secure Store and refreshes when needed.
- On 401: client calls `getValidAccessToken()` (refresh), retries request once, then throws (caller/sign-out handled by auth flow).

### 4. Tenant / RBAC

- **Result:** Pass (server-side)
- Tenant and RBAC are enforced in **apps/dealer** (getAuthContext, guardPermission, requireDealershipContext).
- Bearer auth uses same permission/tenant logic; dealership context for mobile is first active membership when no cookie.
- Mobile does not bypass or duplicate RBAC; it only calls dealer APIs that enforce it.

### 5. Dependency versions (mobile)

- **Result:** Pass
- Expo ~55.0.5, React 19.2.0, React Native 0.83.2 as specified.
- No downgrade to React 18; no older Expo SDK in apps/mobile.
- Root package.json: minimal change (added `dev:mobile` script only); no root-level Expo/React Native version pollution.

### 6. Main app flow

- **Result:** Designed to pass (manual verification recommended)
- Auth: login screen → sign in → stored session → redirect to tabs.
- Dashboard: GET /api/me, display user + dealership + permissions, pull-to-refresh.
- Inventory / Customers / Deals: list → detail scaffolds, dealer API wired.
- More: sign out, app info, settings placeholder.
- Cold launch: restore session from Secure Store; if valid → tabs; else → login.

## Known TODOs / next steps

- Manual E2E: run dealer backend + mobile app, sign in, open each tab, confirm data and sign out.
- Add inventory photo capture/upload when dealer API and product are ready.
- Push notifications and offline-friendly caching as future enhancements.
- Optional: add `react-test-renderer@19.2.x` for component tests if needed.

## Files changed (summary)

- **Backend (apps/dealer):** lib/auth.ts, lib/tenant.ts, lib/api/handler.ts, lib/supabase/bearer.ts (new), app/api/me/route.ts (new), docs/MOBILE_DEALER_API.md (new).
- **Mobile (apps/mobile):** New app per MOBILE_BUILD_SPEC (app/, src/, package.json, app.json, tsconfig, babel, metro, .env.example, README, docs).
- **Root:** package.json (added dev:mobile script only).

---

*Generated as part of Dealer mobile greenfield build. apps/platform was not modified or used by mobile.*

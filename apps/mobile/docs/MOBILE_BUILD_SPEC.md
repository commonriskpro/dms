# Dealer Mobile App — Build Spec

## 1. Overview

Greenfield Dealer mobile app at `apps/mobile`, consuming **only** `apps/dealer` as backend. No use of `apps/platform`. Reuse backend systems (APIs, auth concepts, contracts), not web UI.

## 2. Stack (Locked)

| Dependency | Version |
|------------|---------|
| Expo SDK | 55 |
| React Native | 0.83.x |
| React | 19.2.x |
| react-test-renderer | 19.2.x (if needed) |
| TypeScript | ^5.6 |
| Expo Router | (Expo 55 compatible) |
| TanStack Query | ^5 |
| Supabase (auth) | ^2.50 |
| Expo Secure Store | (Expo 55) |

## 3. Architecture

### 3.1 Source of truth

- **Backend / APIs:** `apps/dealer` only.
- **Types / contracts:** `packages/contracts` (environment-safe exports only).
- **No:** `apps/platform`, Next.js components, shadcn, `next/*`, react-dom, server components in mobile.

### 3.2 Auth flow

1. Mobile: Supabase email/password login via `@supabase/supabase-js`.
2. Persist session in **Expo Secure Store** (access_token, refresh_token, expires_at). Never AsyncStorage; never log tokens.
3. On launch: restore session from Secure Store; if valid, navigate to tabs; else login.
4. API client: send `Authorization: Bearer <access_token>` on every dealer API request.
5. On 401: attempt Supabase session refresh; retry request once; if still 401, sign out and redirect to login.

### 3.3 Backend auth (dealer)

- **Current:** Cookie-based SSR via `@supabase/ssr` and `getAuthContext()`.
- **Add:** Central Bearer-token fallback in dealer auth:
  - If `Authorization: Bearer <token>` present, verify with Supabase `getUser(jwt)`; resolve profile and **default dealership** (first active membership when no cookie).
  - Keep existing cookie auth unchanged for web.
- **Add:** `GET /api/me` (dealer-only): returns `{ user: { id, email }, dealership: { id, name? }, permissions?: string[] }` for mobile context.

### 3.4 Dealer API reuse

| Mobile need | Dealer endpoint | Notes |
|-------------|------------------|--------|
| Current user + dealership | GET /api/me | New; mobile-friendly shape |
| Inventory list | GET /api/inventory | Existing; same query params |
| Inventory detail | GET /api/inventory/[id] | Existing |
| Customers list | GET /api/customers | Existing |
| Customer detail | GET /api/customers/[id] | Existing |
| Deals list | GET /api/deals | Existing |
| Deal detail | GET /api/deals/[id] | Existing |

Existing responses are JSON with `data` / `meta`; mobile uses them as-is or via thin serializers if we add mobile-specific shapes later.

### 3.5 Monorepo integration

- Root `package.json`: no new root-level Expo/React Native deps; workspaces already include `apps/*`.
- Mobile lives in `apps/mobile` with its own locked dependencies.
- Root overrides (React 19.2.4, etc.) remain; mobile’s React/React Native versions are chosen for Expo 55 compatibility and do not override root for web apps.

## 4. Dependency / version strategy

- `apps/mobile/package.json`: pin Expo 55, React Native 0.83.x, React 19.2.x.
- Use `npx create-expo-app@latest` with Expo 55 template, then add TanStack Query, Supabase, Secure Store, Expo Router.
- Avoid pulling Expo or react-native into root.

## 5. Screen map

| Route | Purpose |
|-------|---------|
| `(auth)/login` | Email/password login, error/loading |
| `(tabs)/` | Dashboard — /api/me, user + dealership, pull-to-refresh |
| `(tabs)/inventory` | List + search scaffold |
| `(tabs)/inventory/[id]` | Detail scaffold, media placeholder |
| `(tabs)/customers` | List + search scaffold |
| `(tabs)/customers/[id]` | Detail scaffold |
| `(tabs)/deals` | List |
| `(tabs)/deals/[id]` | Detail scaffold |
| `(tabs)/more` | Sign out, app/env info, settings placeholder |

## 6. Folder structure (target)

```
apps/mobile/
  app/
    _layout.tsx
    (auth)/login.tsx
    (tabs)/_layout.tsx, index.tsx, inventory/, customers/, deals/, more/
  src/
    api/       (client, endpoints, errors, serializers)
    auth/      (supabase, session-store, auth-service, use-auth)
    features/  (dashboard, inventory, customers, deals, settings)
    components/ (ui, feedback, layout)
    hooks/, lib/, state/, theme/, types/
  docs/, assets/, package.json, tsconfig.json, app.json, .env.example, README.md
```

## 7. Risks and follow-ups

- **Bearer + default dealership:** First active membership used when no cookie; multi-dealership users may need a “switch dealership” later (header or /api/me variant).
- **Offline:** Not in scope; architecture allows future caching/offline layer.
- **Push / photos / CRM:** Placeholders only; add in later iterations.
- **QA:** Confirm no platform imports, token handling, and tenant isolation in MOBILE_QA_REPORT.md.

---

*Generated for Dealer mobile greenfield build. Backend: apps/dealer only.*

# DMS Dealer Mobile

Superseded notice: the canonical documentation set lives in [`../../docs/canonical/INDEX.md`](../../docs/canonical/INDEX.md). This README is retained as a local app note and should not be treated as the source of truth.

Dealer-only mobile app for the DMS monorepo. Uses **apps/dealer** as the only backend.

Canonical references:
- [`../../docs/canonical/INDEX.md`](../../docs/canonical/INDEX.md)
- [`../../docs/canonical/ARCHITECTURE_CANONICAL.md`](../../docs/canonical/ARCHITECTURE_CANONICAL.md)
- [`../../docs/canonical/DEVELOPER_GUIDE_CANONICAL.md`](../../docs/canonical/DEVELOPER_GUIDE_CANONICAL.md)

## Stack

- Expo SDK 55
- React Native 0.83.x
- React 19.2.x
- Expo Router, TanStack Query, Supabase auth, Expo Secure Store

## Setup

1. **Env (required)**  
   Copy `.env.example` to `.env` in `apps/mobile` and set:
   - `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL (same as dealer web app).
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (same as dealer).
   - `EXPO_PUBLIC_DEALER_API_URL` — Dealer API base URL, no trailing slash (e.g. `http://localhost:3000`).  
   For Android emulator use `http://10.0.2.2:3000` to reach host machine.

2. **Install and run**
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```
   Then press `i` (iOS) or `a` (Android) to open in simulator/emulator.

3. **Backend**  
   Run the dealer web app so the API is available:
   ```bash
   npm run dev:dealer
   ```
   If any required env var is missing, the app shows a "Configuration needed" screen with the missing variable names (no secret values).

## Auth

- Email/password login via Supabase; session stored in Expo Secure Store.
- All dealer API calls use `Authorization: Bearer <access_token>`.
- On 401, the app attempts a session refresh and retries once, then signs out.

## Structure

- `app/` — Expo Router screens (auth, tabs, dashboard, inventory, customers, deals, more).
- `src/api/` — Typed dealer API client and endpoints.
- `src/auth/` — Supabase client, session store, auth service, useAuth hook.

## Backend

See the canonical docs set at [`../../docs/canonical/INDEX.md`](../../docs/canonical/INDEX.md) for current backend/API guidance.

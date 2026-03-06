# DMS Dealer Mobile

Dealer-only mobile app for the DMS monorepo. Uses **apps/dealer** as the only backend.

## Stack

- Expo SDK 55
- React Native 0.83.x
- React 19.2.x
- Expo Router, TanStack Query, Supabase auth, Expo Secure Store

## Setup

1. Copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same as dealer app)
   - `EXPO_PUBLIC_DEALER_API_URL` (dealer API base URL, e.g. `http://localhost:3000` for dev)

2. Install and run:
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```

3. Run the dealer web app so the API is available:
   ```bash
   npm run dev:dealer
   ```

## Auth

- Email/password login via Supabase; session stored in Expo Secure Store.
- All dealer API calls use `Authorization: Bearer <access_token>`.
- On 401, the app attempts a session refresh and retries once, then signs out.

## Structure

- `app/` — Expo Router screens (auth, tabs, dashboard, inventory, customers, deals, more).
- `src/api/` — Typed dealer API client and endpoints.
- `src/auth/` — Supabase client, session store, auth service, useAuth hook.

## Backend

See **apps/dealer/docs/MOBILE_DEALER_API.md** for endpoints and auth.

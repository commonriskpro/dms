# Step 4 — Mobile smoke checklist

Use this for manual QA after hardening. Run dealer backend and mobile app with valid .env.

## Prerequisites

- [ ] `.env` in apps/mobile has EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_DEALER_API_URL
- [ ] Dealer web app running (e.g. `npm run dev:dealer`)
- [ ] Mobile app running (e.g. `npm run dev:mobile`), then open in iOS/Android emulator

---

## Config

- [ ] With valid .env: app loads and shows login (or tabs if already logged in)
- [ ] With missing env (e.g. rename .env): app shows "Configuration needed" with variable names only (no secret values)

---

## Auth

- [ ] Login with valid dealer email/password: redirects to tabs (Dashboard) and does not stay on login
- [ ] Dashboard shows user email and dealership name (from /api/me)
- [ ] Pull-to-refresh on Dashboard: data refreshes
- [ ] More → Sign out → confirm: clears session, redirects to login, next login works again
- [ ] After sign out, opening app again shows login (no cached tabs)
- [ ] Invalid login: error message shown, no crash; form can be submitted again

---

## Navigation

- [ ] From Dashboard, open Inventory: list loads (or empty state)
- [ ] From Inventory list, tap a vehicle: detail screen opens (or "Vehicle not found")
- [ ] Back from detail returns to list
- [ ] Customers list and detail: same behavior
- [ ] Deals list and detail: same behavior
- [ ] More tab: shows email and Sign out

---

## Errors and retry

- [ ] Stop dealer backend; open Dashboard: error message and "Retry" button
- [ ] Tap Retry (with backend still down): still error (no crash)
- [ ] Start dealer again; tap Retry: data loads
- [ ] List screen (Inventory/Customers/Deals): same error + Retry behavior when API fails
- [ ] Detail screen: same error + Retry when API fails

---

## 401 / session

- [ ] While on tabs, invalidate session (e.g. sign out in another client or expire token): next API call should trigger sign out and redirect to login (or show error and Retry; 401 path triggers onUnauthorized)
- [ ] No infinite redirect loop between login and tabs
- [ ] No flicker: single transition from login to tabs after successful login

---

## Security (spot check)

- [ ] No tokens or secrets visible in UI
- [ ] Config error screen does not show env values
- [ ] Sign out clears session (cannot go back to tabs without logging in again)

---

## Quick regression

- [ ] Login → Dashboard → Inventory → back → Customers → Deal detail → More → Sign out
- [ ] Login again: Dashboard loads, Inventory list loads (or empty)

# Step 4 — Mobile known limitations

Documented limitations and recommended follow-ups after the Step 4 hardening pass. No scope creep; these are for future work.

---

## Auth and session

- **Multi-dealership:** When using Bearer auth (mobile), the backend uses the user’s **first active membership** as dealership context. There is no “switch dealership” in the app. Users with multiple dealerships always see the first one. Documented in apps/dealer/docs/MOBILE_DEALER_API.md.
- **Session refresh:** Refresh is triggered when token is near expiry or when a 401 occurs and retry runs. There is no proactive background refresh timer in the app (Supabase client may handle some of this internally).
- **Biometric / PIN:** Not implemented; session is restored from Secure Store on cold start without an extra unlock step.

---

## Config and env

- **Env at build vs runtime:** EXPO_PUBLIC_* are baked in at build; changing .env requires a rebuild for some bundlers. Development reload may pick up changes depending on Expo setup.
- **Android emulator URL:** Developers must set EXPO_PUBLIC_DEALER_API_URL to `http://10.0.2.2:3000` (or host IP) when testing against host machine; this is documented in .env.example and README but not enforced.

---

## API and network

- **Timeout:** Single 30s timeout for all requests; no per-endpoint or per-screen override.
- **Offline:** No offline caching or queue; all requests require network. Failed requests show error + Retry.
- **Retry:** Only one automatic retry for 401 (refresh + retry). Other errors (5xx, network) use TanStack Query’s retry (1 retry) and then show error + Retry button.
- **Request deduplication:** TanStack Query deduplicates by key; no extra deduplication for rapid repeated calls.

---

## Navigation and deep links

- **Direct URL to tab/detail:** Opening the app via deep link to e.g. `/(tabs)/inventory/123` while unauthenticated is handled by AuthGate (redirect to login). After login, user lands on tabs index (Dashboard), not the deep-linked screen. Full deep-link-to-resource after login is not implemented.
- **Web:** Expo Router and tabs are set up; web behavior was not in scope for Step 4.

---

## Testing

- **Unit tests:** Only api/errors and (optionally) minimal auth-related tests were added. No component or integration tests.
- **E2E:** No Detox or other E2E; validation is manual via STEP4_MOBILE_SMOKE_CHECKLIST.md.
- **Mocking:** No shared MSW or fetch mock layer for API tests.

---

## Feature placeholders

- **Inventory detail:** “Photos” section is a placeholder (future photo capture/upload).
- **Customer detail:** “Quick actions” (call, note, callback) are placeholders.
- **Deal detail:** “Quick actions” (finance, documents, status) are placeholders.
- **More:** “Settings” is a placeholder (preferences, notifications).

---

## Security and compliance

- **Token storage:** Tokens only in Secure Store; no AsyncStorage. No token logging. Confirmed in Step 4.
- **Certificate pinning:** Not implemented.
- **ProGuard / obfuscation:** Not configured in this pass; follow standard Expo/React Native release practices.

---

## Backend

- **Dealer only:** Mobile uses only apps/dealer. apps/platform is not used or referenced.
- **RBAC and tenant:** Enforced server-side; mobile does not send or trust dealership context for authorization. No change in Step 4.

---

## Follow-up recommendations (priority order)

1. Run through STEP4_MOBILE_SMOKE_CHECKLIST.md on a real device and emulator.
2. Add E2E (e.g. Detox) for login → tabs → sign out if the team commits to mobile E2E.
3. Consider proactive session refresh (e.g. before expiry) to reduce 401-triggered sign outs.
4. When adding multi-dealership, extend dealer API (e.g. header or /api/me) to allow selecting dealership and keep using server as source of truth.
5. Add offline-friendly caching (e.g. TanStack Query persistence) when product requires it.

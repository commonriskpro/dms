# Mobile Auth & Account Flows — Spec

## 1. Current auth architecture

- **Provider**: Supabase Auth (email/password). Session stored in `expo-secure-store` (access + refresh + expiresAt).
- **Context**: `AuthProvider` in root `_layout.tsx`; `useAuth()` exposes `state`, `signIn`, `signOut`, `refresh`, `restore`, `isAuthenticated`, `session`.
- **Session flow**: On load, `restore()` reads stored session and optionally refreshes; `signIn()` sets runtime session + React state; `signOut()` clears runtime session, calls Supabase signOut + `clearSession()`, then `queryClient.clear()`, then sets state to unauthenticated.
- **Navigation**: Expo Router. `AuthGate` in root: unauthenticated → `/(auth)/login`; authenticated in `(auth)` → `/(tabs)`. No auth required for `(auth)/*` routes.
- **API**: `dealerFetch()` uses token from runtime session or `getValidAccessToken()`. 401 after retry triggers `getOnUnauthorized()` (set to `signOut` in AuthGate).
- **Dealer API base**: `EXPO_PUBLIC_DEALER_API_URL`. All dealer API calls use this base; auth is Bearer only (no cookie).

## 2. Logout flow

**Expectations**

- User can sign out from Account/More.
- Confirmation dialog: "Sign out?" / "Are you sure?" with Cancel and Sign out (destructive).
- On confirm: clear session/tokens, clear query cache, set auth state to unauthenticated; user is redirected to login by AuthGate (no flash of protected content).
- No stale user/dealership data visible after sign-out.

**Implementation**

- Keep existing `signOut()` in auth context (already clears runtime, SecureStore, query client, state).
- More screen already uses `Alert.alert` before `signOut()`. Optionally extract a reusable `LogoutButton` that shows confirmation and calls `signOut()`.
- Ensure AuthGate runs after state becomes unauthenticated so redirect to `/(auth)/login` is immediate.

## 3. Password reset flow

**UX**

- Login screen: "Forgot password?" link → Forgot Password screen.
- Forgot Password: single field (email). Submit sends reset email via Supabase. Success: "Check your email for a reset link."
- Reset link (from email): opens app via deep link (e.g. `dmsdealer://reset-password` with Supabase recovery params). App shows Reset Password screen: new password + confirm; submit calls Supabase `updateUser({ password })` (recovery session). Success: "Password updated. You can sign in."

**Token / deep link**

- Supabase: `resetPasswordForEmail(email, { redirectTo: '<app_scheme>://...' })`. User clicks link in email; Supabase redirects to that URL with hash params; Supabase client recovers session via `getSessionFromUrl()` or `onAuthStateChange(PASSWORD_RECOVERY)`.
- App scheme: `dmsdealer` (already in app.json). Redirect URL must be allowlisted in Supabase Dashboard (e.g. `dmsdealer://reset-password` or `dmsdealer://**`).
- Reset Password screen is shown when we have a recovery session (from deep link or auth state change). No token is passed in path; Supabase handles recovery server-side and client-side session.

**Backend**

- Supabase only (no dealer API for password reset). Email sending and link generation are Supabase.

**Edge cases**

- Invalid or expired recovery link: show error; link back to login or forgot password.
- User opens reset link on a different device: same flow; they set password there and then can sign in on mobile.

## 4. Invite acceptance flow

**UX**

- Entry: deep link (e.g. `dmsdealer://accept-invite?token=...`) or manual paste of token/link on Accept Invite screen.
- Resolve: app calls dealer API **without** auth: `GET /api/invite/resolve?token=...`. Show dealership name, role, masked email; handle errors (not found, expired, already accepted).
- Accept options:
  - **Existing account**: "Sign in to accept" → navigate to login; after successful login, return to accept flow and `POST /api/invite/accept` with `{ token }` (Bearer).
  - **New user**: "Create account" → form (email, password, confirm password, optional full name). Submit `POST /api/invite/accept` with `{ token, email, password, confirmPassword?, fullName? }` (no auth). Backend creates Supabase user + profile + membership. Success: "Account created. Sign in with your new password." → navigate to login (email prefilled if desired).

**Backend**

- Dealer API (same base URL):
  - `GET /api/invite/resolve?token=...` — public, no auth. Returns `{ data: { inviteId, dealershipName, roleName, expiresAt, emailMasked } }`. Errors: 404 INVITE_NOT_FOUND, 410 INVITE_EXPIRED / INVITE_ALREADY_ACCEPTED.
  - `POST /api/invite/accept` — body either `{ token }` (auth required) or `{ token, email, password, confirmPassword?, fullName? }` (signup, no auth). Returns `{ data: { membershipId, dealershipId, alreadyHadMembership? } }`.

**Edge cases**

- Token already used / expired / cancelled: show message; link to login.
- Email mismatch (signup): backend returns INVITE_EMAIL_MISMATCH; show field error.
- Rate limit (429): show "Too many attempts".

## 5. Multi-dealership switching

**Current model**

- `/api/me` returns a single `dealership: { id, name }`. No `memberships` or list of dealerships in current API. Session is effectively single-dealership.

**Decision**

- Do **not** implement switcher UI that implies multiple dealerships until backend supports it (e.g. `/api/me` with `memberships[]` or `/api/dealerships` and a way to set "current" dealership in session).
- Document in this spec: "Multi-dealership switching is out of scope until backend provides memberships and current-dealership selection."
- Optional: add a stub "Dealership" section in Account that shows current dealership name only (from `me`) and a short note that switching is not yet available.

## 6. API dependencies summary

| Flow            | API / provider                         | Auth required |
|----------------|----------------------------------------|---------------|
| Login          | Supabase signInWithPassword            | No            |
| Logout         | Supabase signOut + local clear         | N/A           |
| Forgot password| Supabase resetPasswordForEmail         | No            |
| Reset password | Supabase updateUser (recovery session) | Recovery      |
| Invite resolve | GET /api/invite/resolve?token=         | No (public)   |
| Invite accept  | POST /api/invite/accept                | Yes (token only) or No (signup body) |

## 7. Files to touch

- **Spec**: `apps/mobile/docs/MOBILE_AUTH_ACCOUNT_FLOWS_SPEC.md` (this file).
- **Auth service**: `src/auth/auth-service.ts` — add `requestPasswordReset(email, redirectTo)`, `updatePassword(newPassword)` (recovery); optional public fetch helper for invite resolve.
- **API**: `src/api/` — add unauthenticated `dealerFetchPublic` or use existing fetch with no Authorization for `/api/invite/resolve`; add `api.inviteResolve(token)`, `api.inviteAccept(body)`.
- **Screens**: `app/(auth)/login.tsx` — add "Forgot password?" link. New: `app/(auth)/forgot-password.tsx`, `app/(auth)/reset-password.tsx`, `app/(auth)/accept-invite.tsx` (or under a group).
- **Components**: Optional `src/features/auth/components/LogoutButton.tsx`; use in More.
- **More / Account**: `app/(tabs)/more/index.tsx` — ensure logout confirmation; optional LogoutButton; optional dealership display (no switcher).
- **Deep links**: Document `dmsdealer://reset-password`, `dmsdealer://accept-invite?token=...`; handle in root layout or auth layout if needed (Expo Linking).
- **Config**: Supabase Dashboard redirect URLs; app.json scheme already `dmsdealer`.

## 8. Acceptance criteria

- Logout: Confirm dialog → sign out → redirect to login; no cached data visible.
- Forgot password: Email submitted → Supabase reset email sent; success message shown.
- Reset password: App opens from link → recovery detected → new password + confirm → update success → user can sign in.
- Invite: Open with token → resolve shows context → accept with sign-in or signup → success and redirect to app or login.
- All forms: validation, loading, error states; no double submit; safe area and keyboard handling.
- No change to existing login/session behavior; no new auth state source of truth.

## 9. Deep-link / config steps (post-implementation)

- In Supabase Dashboard → Auth → URL configuration: add redirect URL(s) for password reset (e.g. `dmsdealer://reset-password` or `dmsdealer://**`).
- Optional: document for deploy that invite links should use `dmsdealer://accept-invite?token=...` when targeting the app.

## 10. Multi-dealership (not implemented)

- Backend `/api/me` returns a single `dealership`. No memberships list or "current dealership" switch in the API.
- Do not implement a dealership switcher until the backend supports multiple memberships and current-dealership selection.
- Optional: show current dealership name on Account/More from `me` when available (single line, no switch).

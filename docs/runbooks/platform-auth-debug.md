# Platform auth debug (DEV-ONLY)

Use this to diagnose the platform login loop (stuck on `/platform/login` after correct credentials).

## Enable

In the platform app env (e.g. `.env.local` or `.env.platform-admin` when running platform):

```bash
PLATFORM_AUTH_DEBUG=true
NEXT_PUBLIC_PLATFORM_AUTH_DEBUG=true
```

Restart the dev server. Logs are **only** emitted when these are set. No tokens, cookie values, or PII are logged.

## Verification steps

1. Run platform locally with the flags above.
2. Open `/platform/login`, enter valid credentials, submit.
3. Watch **server logs** (terminal) and **browser console** (F12).

### Server logs (auth_debug)

- **supabase_getUser**  
  - `hasUser`: whether Supabase sees a user for this request.  
  - `userIdTail`: last 6 chars of user id (or null).  
  - `cookieNames`: cookie names present (values never logged).  
  - `error`: Supabase error message/name if any.

- **platformUser_lookup**  
  - `platformUserFound`: whether a row exists in `platform_users` for that user.  
  - If not found: `noPlatformUserRow: "NO_PLATFORM_USER_ROW"`.

- **layout_redirect**  
  - `reason`: `"unauthenticated"` or `"forbidden"`.  
  - `hasUser`, `platformUserFound`: what the layout decided before redirecting.

### Client (browser console)

- **login_submit**  
  - `success`, `errorMessage` (no tokens).

- **session_after_login**  
  - Response from `GET /api/platform/auth/debug` right after sign-in: `status`, `cookieNames`, `supabaseHasUser`, `platformUserFound`.  
  - Proves whether the server sees the session immediately after login.

### URL

- After redirect to login you should see: `/platform/login?reason=unauthenticated` or (when forbidden) `/platform/forbidden`.

## Diagnosis (4 causes)

Use the logs to pick one:

1. **supabase_has_user is true, platformUserFound is false**  
   → User exists in Supabase Auth but **no row in `platform_users`**.  
   Fix: Provision/create a `platform_users` row for that user (e.g. seed or invite flow), or fix the mapping (e.g. wrong Supabase project / user id).

2. **supabase_has_user is false (after login)**  
   → Server does not see the session (cookies not read or not set).  
   Fix: Check cookie adapter consistency (same domain/path, `getAll()`/`setAll()` in server and callback), and that the auth callback route writes cookies correctly. Check `cookieNames` in logs to see if session cookie names are present.  
   **If the console shows "stale cookie data that does not decode to a UTF-8 string"**: the app uses `cookieEncoding: "raw"` in both browser and server Supabase clients to avoid that. Users with old/corrupt cookies may need to sign out once or clear site data for the platform origin, then sign in again.

3. **layout_redirect reason = "forbidden"**  
   → Same as (1): Supabase user exists, no `platform_users` row. User is sent to `/platform/forbidden` (or login with `reason=forbidden`). Fix as in (1).

4. **session_after_login shows server sees user + platform user, but layout still redirects**  
   → Possible race (RSC/layout runs before cookies are visible) or caching. Try full-page reload after login; if that works, consider forcing dynamic for the platform layout or ensuring no cache for auth.

## Debug endpoint

- **GET /api/platform/auth/debug**  
  Returns JSON: `cookieNames`, `supabaseHasUser`, `userIdTail`, `platformUserFound`.  
  If `PLATFORM_AUTH_DEBUG` is not set, returns **404**. No auth required so you can call it right after login to verify what the server sees.

## Cleanup

Remove or set to false:

- `PLATFORM_AUTH_DEBUG`
- `NEXT_PUBLIC_PLATFORM_AUTH_DEBUG`

All auth_debug logs and the debug endpoint (404 when off) are gated; no always-on auth logging remains.

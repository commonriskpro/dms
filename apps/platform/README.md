# Platform Admin Portal

Superseded notice: the canonical documentation set lives in [`../../docs/canonical/INDEX.md`](../../docs/canonical/INDEX.md). This README is retained as a local app note and should not be treated as the source of truth.

Next.js App Router UI for the DMS Platform Admin (applications, dealerships, audit placeholder). Consumes `/api/platform/*` from this app only; no dealer app imports.

Canonical references:
- [`../../docs/canonical/INDEX.md`](../../docs/canonical/INDEX.md)
- [`../../docs/canonical/ARCHITECTURE_CANONICAL.md`](../../docs/canonical/ARCHITECTURE_CANONICAL.md)
- [`../../docs/canonical/DEVELOPER_GUIDE_CANONICAL.md`](../../docs/canonical/DEVELOPER_GUIDE_CANONICAL.md)

## Commands

- **Dev server (port 3001):**  
  `npm run dev`
- **Build:**  
  `npm run build`
- **Tests:**  
  `npm run test`

## Simulating roles (header auth)

Step 2 uses optional header auth for development. To test the UI with a platform user and role:

1. **Create a platform user in the platform DB** (e.g. via seed or SQL):
   - Insert into `platform_users` (id, role, created_at).
   - Use a UUID for `id` (this is the value you will send as `X-Platform-User-Id`).
   - Set `role` to one of: `PLATFORM_OWNER`, `PLATFORM_COMPLIANCE`, `PLATFORM_SUPPORT`.

2. **Enable header auth and send the header on every request:**
   - In `apps/platform/.env.local` set:
     - `PLATFORM_USE_HEADER_AUTH=true`
   - The UI uses `platformUserId` from the server-rendered layout (via `getPlatformUserOrNull()`). When you load a page, the **server** request must include the header. So you either:
     - Use a browser extension or proxy that adds `X-Platform-User-Id: <your-platform-user-uuid>` to requests to `localhost:3001`, or
     - Call the API from a client that sends this header; the list/detail pages send it via the platform API client when `userId` is in context (which comes from the layout). So the **first** request (the one that renders the layout) must have the header. That is the initial HTML request to e.g. `GET /platform/applications`. So you need to add the header to that request (e.g. use a browser extension like ModHeader to set `X-Platform-User-Id` to your platform user UUID for `localhost:3001`).

3. **Dev-only cookie login (no extension):**
   - When `PLATFORM_USE_HEADER_AUTH=true` and `NODE_ENV !== "production"`, you can use dev-login to set an HttpOnly cookie so the server treats the request as that user:
   - Open: `GET /platform/dev-login?userId=<your-platform-user-uuid>` (e.g. `http://localhost:3001/platform/dev-login?userId=...`).
   - This sets cookie `platform_user_id` and redirects to `/platform/applications`. Subsequent requests (including the initial layout) will be authenticated via the cookie if the header is not set. Platform-only; no dealer cookies.

3. **Role behavior:**
   - **PLATFORM_OWNER:** Applications (list, detail, approve, reject); Dealerships (list, detail; Provision/Suspend/Close shown but status change not wired in Step 3).
   - **PLATFORM_COMPLIANCE:** Applications (list, detail, approve, reject); Dealerships (list, detail, read-only).
   - **PLATFORM_SUPPORT:** Applications (list, detail, read-only); Dealerships (list, detail, read-only).

## Structure

- `app/(platform)/layout.tsx` — Platform shell (sidebar + top bar), auth context, toasts.
- `app/(platform)/platform/` — Routes under `/platform`: applications, dealerships, audit (placeholder).
- `lib/api-client.ts` — Fetch wrapper for `/api/platform/*`; supports `platformUserId` for header auth.
- `lib/platform-auth-context.tsx` — Client context for `userId` / `role` (from server layout).
- `components/ui/` — Button, Card, Table, Input, Select, Dialog, Skeleton (Tailwind + CSS variables).

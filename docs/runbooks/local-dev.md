# Local development

## Running both apps

From the **repo root**:

- **Dealer app** (default port 3000):  
  `npm run dev:dealer`  
  Loads `.env.local` from root and runs `next dev` in `apps/dealer`.

- **Platform app** (port 3001):  
  `npm run dev:platform`  
  Runs `next dev -p 3001` in `apps/platform`. Use `apps/platform/.env.local` for platform env (or root `.env.platform-admin` if you use it for local platform DB).

Ports:

- Dealer: **3000**
- Platform: **3001**

## Env files

- **Root `.env.local`** — Used when you run `npm run dev:dealer` or `npm run db:migrate` from root. Set dealer `DATABASE_URL`, Supabase keys, `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`), `COOKIE_ENCRYPTION_KEY`, `CRON_SECRET`.
- **Root `.env.platform-admin`** — Used when you run `npm run db:migrate:platform` from root. Set platform `DATABASE_URL` and platform Supabase keys.
- **apps/platform/.env.local** — Optional; use for platform app when running `npm run dev:platform` if you prefer env in the app folder.

## Test commands

From repo root:

- **Dealer tests**: `npm run test:dealer` (runs Vitest in `apps/dealer`).
- **Dealer unit tests** (with root `.env.unit`): `npm run test:dealer:unit`.
- **Dealer integration tests** (with root `.env.test`): `npm run test:dealer:integration`.
- **Portal-split tests**: `npm run test:portal-split` (runs `apps/dealer` test:portal-split).
- **Platform tests**: `npm run test:platform`.
- **All**: `npm run test:all` (dealer + platform).

Running tests from inside an app:

- `cd apps/dealer && npm run test`
- `cd apps/platform && npm run test`

## Build commands

From repo root:

- **Dealer**: `npm run build:dealer`
- **Platform**: `npm run build:platform`

## Platform dev login (local only)

When developing the platform app locally, you can use **header auth** so you don’t need to sign in with Supabase every time:

1. Set in `apps/platform/.env.local` (or env used by `npm run dev:platform`):
   - `PLATFORM_USE_HEADER_AUTH=true`
   - `NODE_ENV` left unset or `development` (header auth is ignored when `NODE_ENV=production`).
2. Ensure a platform user exists: insert a row into `platform_users` with `id` = a UUID you’ll use (e.g. from Supabase Auth or any UUID for dev).
3. Visit `/platform/dev-login?userId=<that-uuid>` (e.g. `http://localhost:3001/platform/dev-login?userId=...`). This sets an HttpOnly cookie so the server treats requests as that user.
4. Navigate to `/platform` or any platform page; you’ll be treated as that platform user.

**Seeding a PLATFORM_OWNER:** In the platform DB, insert into `platform_users` (`id`, `role`) values (your Supabase auth user UUID, `PLATFORM_OWNER`). That user can then sign in via `/platform/login` (magic link or password) and will have owner role. For local dev with header auth, use any UUID and set it in dev-login; ensure that same UUID exists in `platform_users` with role `PLATFORM_OWNER`.

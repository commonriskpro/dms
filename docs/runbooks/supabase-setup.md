# Supabase setup: both DBs to initial state

Use this runbook to bring **both** Supabase databases (dealer + platform) to their initial schema state and optionally seed them.

---

## Prerequisites

- Two Supabase projects (one for dealer, one for platform).
- Connection strings for each: **Settings → Database → Connection string** (URI). Use **Session** or **Transaction** mode; for serverless you can use **Pooler** (port 6543).

---

## 1. Create env files (one-time)

### Option A: Fetch keys via Supabase CLI (recommended)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started), log in, then run from repo root:

```bash
# Install CLI (one of):
#   npm install -g supabase
#   scoop install supabase   # Windows
#   brew install supabase/tap/supabase   # macOS

supabase login
```

Get each project’s **Reference ID** from **Dashboard → Project → Settings → General**.

Then fetch API keys into your env files (creates/updates `.env.local` and/or `.env.platform-admin`):

```bash
# Dealer only
npx tsx scripts/fetch-supabase-env.ts --dealer <dealer-project-ref>

# Platform only
npx tsx scripts/fetch-supabase-env.ts --platform <platform-project-ref>

# Both at once
npx tsx scripts/fetch-supabase-env.ts --dealer <dealer-ref> --platform <platform-ref>
```

Or use the npm script (same args):

```bash
npm run env:fetch-supabase -- --dealer <dealer-ref> --platform <platform-ref>
```

The script writes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. **You still must add `DATABASE_URL`** (and for dealer: `NEXT_PUBLIC_APP_URL`, `COOKIE_ENCRYPTION_KEY`, `CRON_SECRET`) — get `DATABASE_URL` from **Dashboard → Settings → Database → Connection string (URI)** for each project.

### Option B: Manual copy from examples

From repo root, create env files with the correct `DATABASE_URL` for each app.

**Dealer DB (and dealer app):**

```bash
cp .env.local.example .env.local
```

Edit `.env.local`: set `DATABASE_URL` to your **dealer** Supabase Postgres URI. Fill other vars when you run the dealer app (see [env-reference.md](./env-reference.md)).

**Platform DB:**

```bash
cp .env.platform-admin.example .env.platform-admin
```

Edit `.env.platform-admin`: set `DATABASE_URL` to your **platform** Supabase Postgres URI. Add `PLATFORM_OWNER_USER_ID` later when you create a platform user and run the platform seed.

---

## 2. Run migrations (both DBs to initial state)

From **repo root**:

```bash
npm run db:setup
```

This runs, in order:

1. **Dealer migrations** — `prisma migrate deploy` for `apps/dealer` using `DATABASE_URL` from `.env.local`.
2. **Platform migrations** — `prisma migrate deploy` for `apps/platform` using `DATABASE_URL` from `.env.platform-admin`.

Both databases are now at the latest schema (initial state for all migrations).

To run migrations separately:

```bash
npm run db:migrate          # dealer only
npm run db:migrate:platform # platform only
```

---

## 3. Optional: seed data

**Dealer (demo dealership + permissions):**

```bash
npm run db:seed
```

Uses `.env.local`. Creates permissions catalog and a demo dealership (slug `demo`). For production you typically provision via platform → dealer internal API instead.

**Platform (first platform owner):**

1. In **Platform** Supabase: **Authentication → Users** → create a user or use sign-up. Copy the user’s **UUID** (id).
2. Set in `.env.platform-admin`:

   ```bash
   PLATFORM_OWNER_USER_ID=<that-uuid>
   ```

3. From repo root:

   ```bash
   npm run db:seed:platform
   ```

This upserts a row in `platform_users` so that user can log in to the platform app.

---

## Summary

| Step              | Command                 | Env file              |
|-------------------|-------------------------|------------------------|
| Migrate dealer    | `npm run db:migrate`    | `.env.local`           |
| Migrate platform  | `npm run db:migrate:platform` | `.env.platform-admin` |
| **Both at once**  | **`npm run db:setup`**  | both files             |
| Seed dealer       | `npm run db:seed`       | `.env.local`           |
| Seed platform     | `npm run db:seed:platform` | `.env.platform-admin` (need `PLATFORM_OWNER_USER_ID`) |

After `npm run db:setup`, both Supabase DBs are at initial state. Add seeds as needed for local or staging use.

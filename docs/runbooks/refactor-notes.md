# Monorepo Refactor: Dealer / Platform Split

## Step 1 — Discovery (completed)

### Current structure

- **Repo root = Dealer Next.js app**
  - `app/` — App Router (dealer routes + `/platform/*` pages + `/api/*` including `/api/platform/*`)
  - `components/` — Shared UI (app-shell, auth-guard, toast, etc.)
  - `contexts/` — Session, dealer lifecycle
  - `lib/` — DB (PrismaClient), auth, tenant, API handler, Supabase, etc.
  - `modules/` — Feature modules (inventory, deals, customers, crm, core-platform, platform-admin, etc.)
  - `public/` — Static assets
  - `prisma/` — **Dealer** schema (full tenant schema) + migrations + seed
  - `next.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `tailwind.config.js`, `postcss.config.js`
  - `package.json` — Single root package; scripts: dev, build, start, test, db:*, postinstall (prisma generate)
  - No root `middleware.ts` found.
  - Path alias: `@/*` → `./` (repo root).
  - Vitest: `@` → repo root; tests under `**/*.test.ts(x)`, `tests/portal-split`, module-level `__tests__`.

- **apps/platform** (already separate)
  - Own Next.js app (port 3001), own `app/`, `lib/`, `prisma/` (platform-only schema: PlatformUser, Application, etc.), own package.json.
  - Path alias: `@/*` → `./` (apps/platform).
  - Deps: `@dms/contracts`: `file:../../packages/contracts`.

- **packages/contracts**
  - Zod + TS types only; used by both root (dealer) and apps/platform.

- **Scripts that assume repo root**
  - All root scripts (dev, build, test, db:generate, db:migrate, db:seed, etc.) run from root and use root `prisma/`, root `app/`, etc.
  - `db:migrate:platform` uses `dotenv -e .env.platform-admin -- prisma migrate deploy` (root prisma = dealer; platform DB targeted by env only for that command; dealer schema is applied to platform DB in current setup—see docs/PLATFORM-ADMIN-DB.md).

### Target structure

```
/
  apps/
    dealer/     ← Dealer Next.js app (moved from root)
      app/ components/ contexts/ lib/ modules/ public/
      prisma/    ← Dealer schema + migrations + seed (moved from /prisma)
      next.config.* tsconfig.json vitest.config.* tailwind/postcss
      package.json
    platform/   ← Unchanged
  packages/
    contracts/  ← Unchanged
  docs/
    runbooks/
  tooling/
    scripts/    ← Optional migration scripts
```

Root: minimal package.json (workspace-style scripts: dev:dealer, dev:platform, build:dealer, build:platform, test:dealer, test:platform, db:* for dealer or delegated to app).

### Prisma

- **Dealer**: today at `/prisma` (schema + migrations + seed). After refactor: `apps/dealer/prisma`. One schema, one migration history; used only by dealer app.
- **Platform**: already at `apps/platform/prisma` (separate schema: platform_users, applications, etc.). Unchanged.

### Risks

1. **Path aliases** — Every `@/` import in moved code must resolve to `apps/dealer`. tsconfig in apps/dealer will set `"@/*": ["./*"]` so no import path changes needed.
2. **Prisma** — Moving prisma to apps/dealer requires: (a) updating root/package.json scripts to run prisma from apps/dealer or from root with `--schema=apps/dealer/prisma/schema.prisma`; (b) all PrismaClient imports stay `@prisma/client`; generate runs in apps/dealer so node_modules there gets the client.
3. **Tests** — Vitest today runs from root with include `**/*.test.*`; after move, dealer tests live under apps/dealer, so root test script will need to run vitest from apps/dealer (or use a workspace that includes apps/dealer). `tests/portal-split` moves to apps/dealer/tests/portal-split.
4. **Vercel** — Two projects: Dealer root = `apps/dealer`, Platform root = `apps/platform`. Build commands and env per project.
5. **Cross-app imports** — After move, enforce: no `apps/dealer` importing from `apps/platform`; no `apps/platform` importing from `apps/dealer`. Shared code only via `packages/*`.
6. **env files** — Root has `.env`, `.env.local`, `.env.platform-admin`. After move, dealer app will need its own `.env.local` (or root can keep dealer env and scripts pass through). Prefer minimal change: document required vars; keep DATABASE_URL name unless we add DEALER_DATABASE_URL consistently.

### TODOs / ambiguities

- **Env var names**: Kept `DATABASE_URL` in both apps; documented in `docs/runbooks/deploy.md`. Optional future: `DEALER_DATABASE_URL` / `PLATFORM_DATABASE_URL` for clarity.
- **Tooling scripts**: Optional `tooling/scripts/migrate-dealer.(sh|ts)` and `migrate-platform.(sh|ts)` were not added; root `package.json` scripts are the single source of truth (see `docs/runbooks/local-dev.md` and `deploy.md`).

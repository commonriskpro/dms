# Developer Guide Canonical

This guide documents how the repository currently works for contributors.

## 1. Prerequisites

Required:
- Node `24.x` per root `package.json`
- npm `11.x`

Useful external tooling:
- Supabase CLI for env bootstrap script
- Access to dealer and platform Supabase projects
- Optional Redis instance if testing BullMQ paths

## 2. Repository Layout

Workspaces:
- `apps/dealer`
- `apps/platform`
- `apps/mobile`
- `apps/worker`
- `packages/contracts`

Important root files:
- `package.json`
- `.cursorrules`
- `.env.local.example`
- `.env.platform-admin.example`
- `vercel.json`
- `.github/workflows/deploy.yml`
- `scripts/*`

## 3. Environment Files

Primary env templates:
- Dealer: `.env.local.example` -> `.env.local`
- Platform: `.env.platform-admin.example` -> `.env.platform-admin`

Mobile:
- `apps/mobile/.env` is expected by the mobile env helper, though no example file was found during this pass.

Dealer required env highlights:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COOKIE_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

Platform required env highlights:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `DEALER_INTERNAL_API_URL`
- `INTERNAL_API_JWT_SECRET`
- production email flows also require `RESEND_API_KEY` and `PLATFORM_EMAIL_FROM`

Mobile required env highlights:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_DEALER_API_URL`

## 4. Install and Build

From repo root:

```bash
npm install
```

Build all through root dispatcher:

```bash
npm run build
```

Build specific areas:

```bash
npm run build:contracts
npm run build:dealer
npm run build:platform
```

Notes:
- Dealer build runs `prisma generate && next build --webpack`.
- Platform build runs `npx prisma generate && npx next build`.
- Contracts package must be built for some app builds and is already wired into root scripts.

## 5. Local Development

Start dealer web:

```bash
npm run dev:dealer
```

Start platform web:

```bash
npm run dev:platform
```

Start mobile:

```bash
npm run dev:mobile
```

Start worker:

```bash
cd apps/worker
npm run dev
```

Ports:
- Dealer: default Next.js port `3000`
- Platform: `3001`
- Mobile: Expo dev server

## 6. Database and Prisma Operations

Generate Prisma clients:

```bash
npm run prisma:generate
```

Or separately:

```bash
npm run prisma:generate:dealer
npm run prisma:generate:platform
```

Run dealer migrations:

```bash
npm run db:migrate
```

Run platform migrations:

```bash
npm run db:migrate:platform
```

Check migration status:

```bash
npm run db:migrate:status
npm run db:migrate:status:platform
```

Reset databases:

```bash
npm run db:reset
npm run db:reset:platform
```

Seed dealer DB:

```bash
npm run db:seed
```

Seed platform owner:

```bash
npm run db:seed:platform
```

Important current behavior:
- Root migration/reset wrapper scripts prefer `DIRECT_DATABASE_URL` when present.
- This is specifically to avoid Supabase pooler issues during migration/reset operations.

## 7. Testing Commands

Dealer:

```bash
npm run test:dealer
npm run test:dealer:unit
npm run test:dealer:integration
npm run test:portal-split
```

Platform:

```bash
npm run test:platform
```

All web tests:

```bash
npm run test:all
```

Mobile:

```bash
cd apps/mobile
npm run test
```

Contracts:

```bash
cd packages/contracts
npm run test
```

## 8. Quality and Utility Scripts

Useful root scripts:
- `scripts/vercel-build.js`: Vercel build dispatch by project name
- `scripts/prisma-migrate.ts`: migrate/status/recover helpers
- `scripts/prisma-reset.ts`: reset helper
- `scripts/fetch-supabase-env.ts`: fetch Supabase keys into env files
- `scripts/delete-all-supabase-users.ts`: auth cleanup utility
- `scripts/repair-dealer-roles.ts`: wrapper for dealer role repair
- `scripts/policy-check.mjs`: repo policy checks
- `scripts/dedupe-vins.ts`: VIN dedupe helper for migration safety

Dealer package utility commands:

```bash
cd apps/dealer
npm run db:repair-roles
npm run db:backfill-vehicle-photos
npm run policy-check
```

## 9. Deployment Model

Current deployment model in code:
- Web deploys target Vercel.
- DB migrations are run from GitHub Actions via `.github/workflows/deploy.yml`.
- Root build command routes to dealer or platform build based on `VERCEL_PROJECT_NAME`.

Important operational mismatch:
- Repo root requires Node `24.x`.
- GitHub Actions deploy workflow currently uses Node `20`.

## 10. Debugging Guidance

Useful checks:
- Dealer health: `GET /api/health`
- Platform health: `GET /api/health` on platform app
- Dealer metrics: `GET /api/metrics`

Debug-oriented env toggles:
- `PLATFORM_AUTH_DEBUG=true`
- `NEXT_PUBLIC_PLATFORM_AUTH_DEBUG=true`

Operational debug helpers:
- Platform monitoring routes
- Dealer internal monitoring routes
- Request ID propagation helpers in API logging docs

## 11. Current Contributor Rules Inferred from Repo

Observed and enforced by code/config:
- Use Next.js 16 / React 19 / Prisma 6 / Zod 3.25.76 stack pinned at root.
- Dealer architecture expects route -> service -> db layering.
- Money should remain integer cents.
- Dealer business logic should stay tenant-scoped.
- Current tests use Jest, not Vitest.

## 12. Branch and PR Workflow

What the repo currently defines:
- A deploy workflow on push to `main`
- No PR template found
- No test CI workflow found during this pass

Canonical guidance:
- Treat `main` as deployment-sensitive because migrations run from GitHub Actions on push.
- Validate migrations and tests before merging to `main`.
- If you add CI expectations, document them in this canonical set because they are not fully encoded today.

## 13. Current Gotchas

- Dealer and platform use separate databases and env files.
- Platform-to-dealer flows require matching `INTERNAL_API_JWT_SECRET`.
- Migrations/resets should prefer direct DB URLs on Supabase.
- Worker queue behavior depends on `REDIS_URL`.
- Some legacy docs still reference Vitest or outdated architecture assumptions.
- Mobile push notification code is intentionally disabled by feature flag.

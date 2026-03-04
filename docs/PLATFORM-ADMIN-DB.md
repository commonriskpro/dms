# Platform-admin database

The platform-admin Supabase project (`uuotgizzrqycitllmzqs`) uses a **separate** database from the dealer app. Use `.env.platform-admin` only for migrations and app config when targeting that DB.

## Setup

1. **Get the database password**  
   In [Supabase Dashboard](https://supabase.com/dashboard) → project **uuotgizzrqycitllmzqs** → **Settings** → **Database**:
   - Copy the **Connection string (URI)** (direct, port 5432), or  
   - Copy the **Database password** and build:  
     `postgresql://postgres:YOUR_PASSWORD@db.uuotgizzrqycitllmzqs.supabase.co:5432/postgres`

2. **Set `DATABASE_URL` in `.env.platform-admin`**  
   Replace `REPLACE_WITH_DB_PASSWORD` in that file with the real password (or paste the full URI into `DATABASE_URL`).

3. **Run migrations**  
   From the repo root:
   ```bash
   npm run db:migrate:platform
   ```
   This runs **platform** Prisma migrations (`apps/platform/prisma`) against the platform DB. Dealer migrations (`apps/dealer/prisma`) are separate and target the dealer DB only.

## Env file

- **`.env.platform-admin`** — Platform Supabase URL, anon key, service role key, and `DATABASE_URL` for the platform Postgres. Used by `db:migrate:platform`. Do not commit (it is gitignored via `.env*`).

## Scripts

| Script | Purpose |
|--------|--------|
| `npm run db:migrate` | Deploy **dealer** migrations (`apps/dealer/prisma`) to dealer DB (uses root `.env.local`) |
| `npm run db:migrate:platform` | Deploy **platform** migrations (`apps/platform/prisma`) to platform-admin DB (uses root `.env.platform-admin`) |

## Schema

Dealer and platform use **separate** Prisma schemas and migrations: `apps/dealer/prisma` (tenant/operational data) and `apps/platform/prisma` (platform_users, applications, etc.). Do not mix migration targets.

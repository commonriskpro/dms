# AGENT_SPEC — DMS (Cursor Agents Must Follow)

This repository is a production SaaS Dealer Management System (DMS) built as a modular monolith.
All agent work MUST comply with this spec. If a change conflicts, refactor to comply.

---

## 0) Product Goal

Build a DealerCenter-class competitor with:
- Fast, professional UX (Notion-like neutrals + blue accent)
- Modular pricing (core + add-ons)
- Strong multi-tenant security and auditability
- Finance support via embed/redirect first (no SSN storage by default)
- Supabase + Vercel deployment

---

## 1) Tech Stack (Pinned)

Frontend:
- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- TanStack Table (tables), TanStack Query (optional) or server actions (careful)

Backend:
- Next.js Route Handlers (/app/api/**) + service layer
- Zod validation on every request
- Prisma ORM

Database & Platform:
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Hosting: Vercel

Jobs:
- pg-boss (preferred) OR Vercel Cron for light tasks (choose pg-boss when in doubt)

Testing:
- Vitest for unit/integration tests
- Playwright optional for E2E smoke tests (add later)

---

## 2) Repository Structure (Non-Negotiable)

Modules live here:
- /modules/<module>/{ui,service,db,tests}

Shared:
- /components/**  (shared UI components)
- /lib/**         (shared utilities: auth, supabase, prisma, logging)
- /app/**         (Next.js pages/routes)
- /prisma/**      (schema + migrations)

No module may place business logic directly in UI components.

---

## 3) Core Rules (Non-Negotiable)

### 3.1 Multi-Tenancy
- Every business table MUST include:
  - dealership_id (UUID)
  - created_at, updated_at
- Every query MUST be scoped by dealership_id.
- Never accept dealership_id from the client without verifying membership.
- Tenant isolation MUST be tested.

### 3.2 RBAC (Permissions)
- Every route MUST enforce permission checks.
- Permissions are explicit strings (e.g., "inventory.read", "deals.write").
- Roles are a set of permissions.
- Membership ties user -> dealership -> role.
- No “admin bypass” unless explicitly documented and tested.

### 3.3 Validation (Zod Everywhere)
- All API inputs validated at the edge via Zod:
  - body, query, params
- Reject unknown fields where reasonable (strip/strict).
- Standard error shape (see §8).

### 3.4 Pagination & Query Limits
- All list endpoints paginate.
- Enforce max page size (default 25, max 100).
- Never return unbounded lists.

### 3.5 Audit Logging
- Append-only audit log for:
  - create/update/delete of critical entities
  - role/membership changes
  - finance/documents sensitive reads (viewing private docs, finance app status)
- Record: actor_id, dealership_id, action, entity, entity_id, metadata, ip, user_agent, created_at
- Optional (recommended): before/after diffs for critical updates (safe fields only)

### 3.6 Sensitive Data Handling
- NEVER store raw payment card data. Use tokenized providers only.
- By default, DO NOT store SSN, DOB, income.
- Finance first approach: embed/redirect to lender networks; store external IDs/status only.
- Avoid PII in logs. Mask where needed.

### 3.7 File Storage
- Use Supabase Storage.
- Private bucket for sensitive docs (deal-documents).
- Store only file metadata in DB (bucket, path, size, mime, checksum).
- Use signed URLs for private downloads.
- Validate uploads (mime/size) and enforce dealership scoping.

---

## 4) Module Contracts & Boundaries

- Each module owns its Prisma models but they live in a single Prisma schema.
- Each module owns its db functions under /modules/<module>/db
- Route handlers may call module service layer only.
- Cross-module access: service-to-service only (no direct db access of another module).
- Prefer emitting internal domain events instead of tight coupling.

---

## 5) Domain Events (Internal)
Implement a lightweight internal event pattern (in-process initially):
- /lib/events.ts exports:
  - emit(eventName, payload)
  - register(eventName, handler)
Use events for cross-module updates:
- deal.created -> finance_app shell created
- vehicle.sold -> inventory status update + docs pack init
- finance.status_changed -> report counters update

Events must be idempotent where possible.

---

## 6) API Conventions

### 6.1 Routes
- Use /app/api/<resource> for REST-ish routes.
- Prefer:
  - GET /api/<resource>?page&limit&filters
  - POST /api/<resource>
  - GET /api/<resource>/<id>
  - PATCH /api/<resource>/<id>
  - DELETE /api/<resource>/<id> (soft delete preferred for critical entities)

### 6.2 Auth in API
- Use Supabase session from cookies (server-side).
- Derive:
  - user_id
  - dealership_id (active dealership)
  - permissions
- Never trust client-sent user_id/role/dealership_id.

### 6.3 Rate Limiting
- Apply to:
  - auth endpoints
  - file upload endpoints
  - finance session endpoints
Basic in-memory or Upstash-style is acceptable; implement a simple limiter now and make it replaceable.

---

## 7) UI Conventions

Design:
- Notion-like neutral palette with subtle borders, soft shadows, blue accent.
- shadcn/ui components for consistency.

UX Requirements:
- Every screen must have:
  - loading state
  - empty state
  - error state
- Tables:
  - pagination
  - sorting
  - column visibility optional
- Forms:
  - client validation + server validation
  - clear inline errors
- Accessibility:
  - keyboard navigable
  - proper labels
  - focus rings

---

## 8) Error Handling (Standard)

All API errors must conform to:

{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable",
    "details": { ...optional }
  }
}

Use meaningful codes:
- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- VALIDATION_ERROR
- CONFLICT
- RATE_LIMITED
- INTERNAL

Never leak stack traces to clients.

---

## 9) Database Conventions

- Use UUID primary keys.
- Add indexes for:
  - dealership_id
  - foreign keys
  - common filters (status, created_at, updated_at)
- Use soft delete on critical entities:
  - deleted_at
  - deleted_by
- Use transactions for multi-step writes.
- Ensure idempotency for webhooks/jobs (unique keys).

---

## 10) Testing Requirements

For each module:
- Unit tests for service logic
- Integration tests for:
  - tenant isolation
  - RBAC negative cases
- Audit log tests:
  - verify audit rows created for critical actions
Minimum coverage is not required, but critical paths must be tested.

---

## 11) Deployment Requirements (Vercel + Supabase)

- Provide migration steps (Prisma migrate deploy).
- Ensure env vars are documented in /docs/DEPLOYMENT.md
- Ensure storage bucket names and policies are documented.

---

## 12) Working Style for Cursor Agents

- Do not ask the user questions unless blocked.
- Implement features as vertical slices (schema + API + UI + tests).
- Keep commits/changesets small and scoped to one module.
- Do not scaffold all modules at once.
- No placeholders, no TODOs. Finish each feature.

If any step fails (lint/build/tests), fix it before moving on.
# Modular Boundary Hardening Spec

## Scope

This sprint hardens `apps/dealer` as a modular monolith. The goal is to preserve the existing product shape while making dependency ownership more explicit and harder to regress.

This spec reflects the codebase as implemented in this repository, not a generic clean-architecture rewrite.

## Current Dependency Map

### Stable patterns already present

- Thin app pages that render module UI directly, for example the admin route wrappers under `app/(app)/admin/*`.
- Thin API routes that authenticate, authorize, validate, then call module services, such as `app/api/admin/roles/route.ts`.
- Service-owned tenant checks, audit logging, and not-found handling in module services such as `modules/core-platform/service/role.ts`.
- Prisma/data access concentrated in `db/` packages for mature modules such as `core-platform`, `inventory`, `deals`, `customers`, and `websites-core`.

### Mature dealer modules

The most mature dealer modules follow the intended `db/`, `service/`, `ui/`, and `tests/` shape:

- `modules/core-platform`
- `modules/inventory`
- `modules/deals`
- `modules/customers`
- `modules/finance-core`
- `modules/reporting-core`
- `modules/websites-core`
- `modules/crm-pipeline-automation`

### Structural risks found during discovery

- Several route handlers still imported `@/lib/db` directly.
- Some app pages imported `modules/*/db/*` directly.
- `modules/search/service/global-search.ts` imported foreign `db/*` packages instead of service boundaries.
- `lib/serialization/customers.ts` was customer-domain code living outside the owning module.
- Boundary enforcement existed mostly by convention and behavioral tests, not by explicit import guardrails.

## Dependency Rules

### Allowed directions

- `app page/route -> module ui/service`
- `route -> service -> db -> Prisma`
- `service -> same-module db`
- `service -> other-module service`
- `lib -> cross-cutting infra only`

### Forbidden directions

- `route -> Prisma`
- `route/page -> modules/*/db/*`
- `ui -> modules/*/db/*`
- `module service -> other module's db/*`
- `service -> ui`
- `db -> audit, tenant policy, or business workflows`
- `lib -> domain-owned module code unless explicitly grandfathered`

## Why These Rules Fit This Repo

- Dealer is already organized as a modular monolith, so the lowest-risk change is to reinforce the boundaries that already exist rather than introduce a new framework.
- The repo already treats services as the business boundary for tenant checks, audit, and orchestration.
- Existing thin route and page wrappers show that explicit ownership is already the dominant local pattern.
- A small allowlisted architecture test fits the current repo better than adding a heavyweight dependency-graph tool mid-sprint.

## Non-goals

- No microservice split.
- No move of dealer business writes out of `apps/dealer`.
- No dependency injection framework.
- No broad UI rewrites unrelated to boundary ownership.
- No testing stack change away from Jest.

## Enforcement Plan

### Implemented guardrails

`tests/architecture/modular-boundaries.test.ts` now enforces:

1. Dealer route files may not import `@/lib/db` directly except for an explicit legacy allowlist.
2. UI files may not import `modules/*/db/*`.
3. Module source files may not import another module's `db/*` except for an explicit legacy allowlist.
4. `lib/` may not import module `db/service/ui` layers except for an explicit legacy allowlist.

### Allowlist policy

The allowlists are intentionally small and explicit. They document remaining legacy exceptions that were outside the safe minimal refactor set for this sprint:

- Route direct Prisma allowlist: 0 files.
- Cross-module `db/*` allowlist: 0 files.
- `lib/` layer allowlist: 0 files.

Any new violation fails the Jest suite immediately.

### Next tightening steps

- Keep the guardrail suite green as new dealer routes and services are added.

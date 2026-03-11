# DMS Code Optimization Duplication Audit

Date: 2026-03-10
Scope scanned (code-truth):
- `apps/dealer/modules/**`
- `apps/dealer/app/api/**`
- `apps/dealer/app/(app)/**`
- `apps/platform/**`
- `packages/contracts/**`
- shared helpers under `apps/dealer/lib/**`, `apps/platform/lib/**`

Notes:
- This audit is grounded in current code.
- No behavior changes were made in Step 1.
- Canonical architecture constraints were respected (server-first, tenant/RBAC invariants, BullMQ+Postgres split).

## Executive Summary
High-confidence duplication remains in four practical clusters:
1. Repeated API route plumbing (`searchParams` parse + zod parse + list meta response + common error handling).
2. Repeated inline serializers (especially date/BigInt normalization) in route files.
3. Repeated list/query patterns in platform DB/service layers.
4. Repeated small utility vocabularies (cents parsing/coercion patterns, date serialization patterns).

There are also larger “looks similar but behavior-sensitive” areas (CRM workflow logic, dashboard refresh orchestration, job/worker semantics) that should be deferred.

## Duplication Map by Category

### 1) Service Duplication

Findings:
- Platform list services are thin pass-through wrappers over similarly structured DB list functions:
  - `apps/platform/lib/service/accounts.ts`
  - `apps/platform/lib/service/dealerships.ts`
  - `apps/platform/lib/service/subscriptions.ts`
  - with matching DB list patterns in:
    - `apps/platform/lib/db/accounts.ts`
    - `apps/platform/lib/db/dealerships.ts`
    - `apps/platform/lib/db/subscriptions.ts`
- Repeated `findMany + count + meta(limit,offset)` pattern in both dealer and platform route/service surfaces.

Classification:
- Safe to consolidate in small batches.
- Not safe for “single sweep” because some wrappers also add audit logging and target-specific includes.

### 2) API Duplication

Findings:
- `Object.fromEntries(request.nextUrl.searchParams)` repeated heavily across dealer routes (69 direct occurrences).
- Repeated list response shape construction (`meta: { total, limit, offset }`) appears widely (40+ explicit occurrences).
- Repeated try/catch zod-validation response pattern:
  - `if (e instanceof z.ZodError) return Response.json(validationErrorResponse(...), { status: 400 })`
  - then `handleApiError(e)`.
- Repeated auth/guard sequence in most protected routes:
  - `getAuthContext` + `guardPermission` + parsed body/query.

Classification:
- Safe to consolidate in small batches via helper extraction and partial route migration.
- Defer “full route wrapper abstraction” because that can unintentionally alter status/error contracts.

### 3) Schema / Validation Duplication

Findings:
- Repeated pagination/list query composition in multiple domains (often `paginationQuerySchema` + domain fields).
- Repeated cents BigInt transforms in multiple places:
  - `apps/dealer/modules/lender-integration/schemas.ts`
  - `apps/dealer/app/api/crm/schemas.ts`
  - `apps/dealer/modules/finance-core/schemas.ts`
- Possible dead duplicate: `centsStringSchema` declared but unused in `apps/dealer/app/api/crm/schemas.ts`.

Classification:
- Safe to consolidate in small batches for shared coercion helpers.
- Defer broad schema unification where domain-specific constraints differ subtly.

### 4) Serializer Duplication

Findings:
- Exact duplicated serializer function appears in three compliance-form routes:
  - `apps/dealer/app/api/compliance-forms/route.ts`
  - `apps/dealer/app/api/compliance-forms/generate/route.ts`
  - `apps/dealer/app/api/compliance-forms/[id]/route.ts`
  - duplicated `serializeForm(...)` body with identical payload/date handling.
- Multiple route-level serializers repeat ISO/date and money-string conversion patterns:
  - e.g. tax profiles, accounting accounts, deal documents, compliance forms.

Classification:
- Safe to consolidate now for exact duplicates.
- Safe in small batches for similar-but-not-identical serializers.
- Defer polymorphic serializer consolidation that could impact response contract nuances.

### 5) UI / Component Duplication

Findings:
- Repeated loading/error/card shells across report/platform pages (skeleton + card header/content patterns).
- Many pages recompose similar shell primitives but not exact duplicates.

Classification:
- Safe to consolidate in small batches for leaf wrappers only.
- Defer broad page-level component abstraction (risk of UI behavior drift).

### 6) Utility Duplication

Findings:
- Date serialization (`toISOString`) and money BigInt/string conversion logic repeated in many serializers.
- Query-string assembly patterns duplicated across bridge/service callers:
  - especially `apps/platform/lib/call-dealer-internal.ts`.

Classification:
- Safe to consolidate in small batches.
- Defer aggressive centralization into a “god util” module.

### 7) Structural Duplication

Findings:
- Re-export/barrel surfaces still exist for many component families; some overlap is intentional and used via indirection.
- Near-copy list endpoints in multiple domains are structurally similar but domain semantics differ.

Classification:
- Safe to consolidate only after import-graph verification and indirect-usage checks.
- Defer wholesale structural flattening.

## Priority Classification

### Safe to Consolidate Now
1. Exact duplicate compliance-form serializers in 3 route files.
2. Small query helper for `Object.fromEntries(request.nextUrl.searchParams)` usage (partial rollout).

### Safe to Consolidate in Small Batches
1. Repeated list meta response helper creation + incremental adoption.
2. Shared cents/date coercion helper extraction where currently identical.
3. Platform list db/service pattern normalization with careful audit-log preservation.
4. Leaf UI loading/error wrappers where output is deterministic.

### Defer (Behavior-Sensitive)
1. Auth core / tenant/session resolution (`getAuthContext`, tenant context, support session).
2. RBAC guard semantics and permission edge paths.
3. Job orchestration / workflow state transitions (CRM jobs, automation runs, BullMQ transitions).
4. Dashboard refresh orchestration and reconciliation internals.
5. Any refactor that changes route contracts or JSON shapes.

## Highest-Value, Lowest-Risk First Candidate
- Consolidate compliance-form serializer duplication into one canonical serializer in `finance-core` and migrate all 3 compliance routes.


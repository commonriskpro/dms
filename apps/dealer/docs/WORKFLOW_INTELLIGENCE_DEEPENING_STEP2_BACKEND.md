# Workflow Intelligence Deepening — Step 2: Backend

**Completed:** Step 2 (Backend-engineer)  
**Spec:** `WORKFLOW_INTELLIGENCE_DEEPENING_SPEC.md`

## Summary

No API or schema changes were made. The existing signal engine and route already support workflow deepening via adapter-side filtering and UI-derived explanation.

## What Was Not Changed

- **API** — `GET /api/intelligence/signals`: no new query params (`entityType`, `entityId`, `entityIds`). Spec requires adapter-side filtering first; entity filters only if adapter-side proves insufficient.
- **Schema / Prisma** — No changes. Explanation text is derived in UI adapters from existing `title`, `description`, `actionLabel`, `actionHref` and code fallback.
- **Signal engine** — No rewrite. `listSignalsForDealership` and `listSignals` (db) unchanged.
- **Route contract** — Unchanged. Same response shape and permissions.

## What Was Added (Adapter Layer Only)

- **`groupSignalsByEntityId`** in `modules/intelligence/ui/surface-adapters.ts`  
  - Pure adapter helper: given `SignalSurfaceItem[]` and optional `entityIds`, returns `Map<string, SignalSurfaceItem[]>` keyed by `entityId`.  
  - Used for queue row-level blocker display: page fetches signals once, then groups by deal id per row. No new API or DB calls.  
  - Keeps tenant isolation and RBAC unchanged (data still from existing tenant-scoped fetch).

## Verification

- Existing API returns `entityType`, `entityId`, `title`, `description`, `actionLabel`, `actionHref` on each signal — sufficient for:
  - Entity-scoped header/context/timeline via `filterSignalsForEntity`
  - Queue row-level display via `groupSignalsByEntityId` on that payload
  - Explanation text via UI adapters (no backend fields)
- Dedupe and signal lifecycle semantics remain in existing adapters and engine.

Step 3 (Frontend-engineer) can implement all slices using current API and the new adapter helper.

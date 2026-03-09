# Dashboard Personalization Hardening — Backend Report (Step 2)

## Summary

Backend hardening implemented: server cache for effective layout (30s TTL), payload guardrails (10KB, 50 widgets), deterministic normalization and checksum, widget versioning in registry, checksum-based no-op save, and rate limiting on save/reset. All changes are backward compatible.

## Deliverables

### A. Schema / persistence
- **Prisma:** Added optional `checksum` (VarChar 64) to `DashboardLayoutPreference`. Migration `20260306140000_add_dashboard_layout_checksum`. No breaking change; existing rows remain valid.
- **Persistence:** `getSavedLayoutRow` returns `{ layoutJson, checksum }`. `saveLayout` accepts `payload` and `checksum`; returns `boolean` (true if write performed). No-op when existing checksum equals new checksum.

### B. Schema validation
- **Limits:** `MAX_JSON_BYTES = 10_240` (10KB). `MAX_WIDGET_ENTRIES = 50` (unchanged). Size validated after normalization.
- **Normalization:** `normalizeDashboardLayout(payload)` — group by zone, sort by (order, widgetId), renumber 0..n-1 per zone. Deterministic.
- **Checksum:** `computeDashboardLayoutChecksum(payload)` — SHA-256 hex of normalized serialized JSON.
- **Version:** Optional `widgetVersion` in placement schema; parse schema accepts legacy layouts without it.

### C. Widget registry
- **Version:** Added `version: number` (default 1) to `WidgetDefinition`. All 12 widgets set `version: 1`.
- **Merge:** Unchanged; version mismatch uses current registry definition (graceful).

### D. Merge service
- No change to merge logic. Parse accepts optional `widgetVersion` from DB. Normalization and checksum used in save path and schema layer.

### E. Server cache
- **Module:** `dashboard-layout-cache.ts` using `createTtlCache` (TTL 30s, max 1000 entries). Key: `dashboard_layout:${dealershipId}:${userId}`. Value: `CachedLayoutItem[]` (serializable).
- **Read:** Dashboard page tries `getCachedEffectiveLayout` first; on miss runs getSavedLayout + merge + toSerializableLayout and `setCachedEffectiveLayout`.
- **Invalidate:** `invalidateDashboardLayoutCache(dealershipId, userId)` called after save and after reset in API routes.

### F. Persistence write
- **Save:** Validate → filter and enrich with widgetVersion from registry → normalize → size check → checksum → getSavedLayoutRow; if existing checksum === new checksum skip upsert; else upsert with layoutJson + checksum. Invalidate cache. Audit only when write performed.
- **Reset:** deleteMany; invalidate cache.

### G. Rate limiting
- **Types:** Added `dashboard_layout_mutation` (10/minute) in `lib/api/rate-limit.ts`.
- **Key:** `dashboard_layout:${dealershipId}:${userId}`. Applied to POST `/api/dashboard/layout` and POST `/api/dashboard/layout/reset`. Response 429 `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }`.

### H. Tests
- **Schemas:** normalization deterministic, same layout same checksum, different layout different checksum, payload over 10KB returns false from isPayloadWithinSizeLimit, legacy layout without widgetVersion parses.
- **Persistence:** getSavedLayoutRow, saveLayout with checksum and upsert, no-op when checksum matches.
- **Merge:** Existing tests still pass (legacy payload, version optional).
- **API:** Existing route tests pass (duplicate 400, 403, 200).

## Files changed/added

| Path | Change |
|------|--------|
| prisma/schema.prisma | checksum column |
| prisma/migrations/20260306140000_add_dashboard_layout_checksum/migration.sql | New |
| modules/dashboard/schemas/dashboard-layout.ts | 10KB, widgetVersion, normalize, checksum, parse relaxed |
| modules/dashboard/config/widget-registry.ts | version: 1 on all widgets |
| modules/dashboard/service/dashboard-layout-cache.ts | New |
| modules/dashboard/service/dashboard-layout-persistence.ts | getSavedLayoutRow, saveLayout(checksum, return boolean) |
| app/api/dashboard/layout/route.ts | Rate limit, normalize, enrich version, checksum, no-op, invalidate cache |
| app/api/dashboard/layout/reset/route.ts | Rate limit, invalidate cache |
| app/(app)/dashboard/page.tsx | Cache read path (get then set on miss) |
| lib/api/rate-limit.ts | dashboard_layout_mutation 10/min |
| modules/dashboard/tests/* | New/updated schema, persistence, getSavedLayoutRow, no-op |

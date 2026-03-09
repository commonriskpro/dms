# Dashboard Personalization — Hardening Follow-up Spec (Step 1)

## 1. Existing state

### Current V1 implementation summary
- **Data:** One `DashboardLayoutPreference` row per (dealershipId, userId) with `layoutJson` (JSON). No checksum or version column.
- **Flow:** Dashboard page calls `getSavedLayout(dealershipId, userId)` and `mergeDashboardLayout({ permissions, savedLayoutRaw })`; passes `toSerializableLayout(effective)` to client. Save/reset API routes validate body, filter to allowed widgets, upsert or delete, then return effective layout.
- **Schemas:** `dashboard-layout.ts` — `MAX_WIDGET_ENTRIES = 50`, `MAX_JSON_BYTES = 64*1024`; duplicate widget ids rejected; `parseLayoutJson` for DB reads.
- **Registry:** `widget-registry.ts` — WidgetDefinition has id, title, description, zones, defaultOrder, defaultVisible, requiredPermissions, fixed, hideable. No version field.
- **Merge:** `merge-dashboard-layout.ts` — normalizes order to 0..n-1 per zone; no caching; no checksum.
- **Persistence:** `dashboard-layout-persistence.ts` — getSavedLayout (findUnique), saveLayout (upsert), resetLayout (deleteMany). No checksum comparison or no-op skip.
- **API:** POST `/api/dashboard/layout` (save), POST `/api/dashboard/layout/reset` (reset). No rate limiting.

### Where hardening plugs in
| Area | Current | Hardening hook |
|------|---------|----------------|
| Caching | None | Cache effective merged layout (serializable) after merge; key = dealershipId + userId; read in dashboard page / API response path; invalidate on save/reset. |
| Validation | 50 widgets, 64KB | Tighten to 50 widgets, 10KB serialized; reject with clear error before DB. |
| Normalization | Order 0..n-1 in merge | Canonical normalize before save and after merge; deterministic ordering; checksum on normalized payload. |
| Versioning | None | Add optional `widgetVersion` in registry and in layout item; legacy layouts without version still parse and merge. |
| Rate limiting | None | Add rate limit types for dashboard_layout_save and dashboard_layout_reset; key = dealershipId:userId; 10/min. |

---

## 2. Cache design

- **Cache key:** `dashboard_layout:${dealershipId}:${userId}`. Must include both so entries are tenant- and user-scoped.
- **TTL:** 30 seconds (recommended; 15–30s acceptable). Short enough to avoid stale layout after save/reset if invalidation were missed; long enough to reduce repeated merge work on rapid reloads.
- **What is cached:** The **effective merged layout** in serializable form (same shape as `toSerializableLayout(mergeDashboardLayout(...))`). Do not cache raw client payload or unvalidated data.
- **Where cache is read:** (1) Dashboard page server component: when resolving layout for the user, try cache first; on miss, run getSavedLayout + merge + toSerializableLayout, then set cache. (2) Optionally in save/reset response path after merge — can reuse same merge result and cache it.
- **Where cache is invalidated:** On save: after successful upsert, delete cache key for that dealershipId+userId. On reset: after successful deleteMany, delete cache key for that dealershipId+userId.
- **RBAC / context:** Cache is keyed by dealershipId and userId; merge input uses permissions from the same request/session. Cached value is the result of merge with permissions already applied; we do not cache by permission set (would multiply entries). So: cache is valid only for the same user in the same dealership; permission changes are rare and 30s TTL limits staleness.
- **What is stored:** Serializable layout array only (no definition objects). Same as current `SerializableLayoutItem[]` (or the shape returned by toSerializableLayout).

**Implementation:** Use existing `createTtlCache` from `modules/core/cache/ttl-cache.ts`. Create a dedicated cache instance with TTL 30s and reasonable maxEntries (e.g. 1000). Export get/set/delete; call get before merge, set after merge; call delete in save and reset handlers.

---

## 3. Payload guardrails

- **Max widget count:** 50 (keep current). Enforced in zod schema and in validation before persist.
- **Max serialized JSON size:** 10 KB (10_240 bytes). Stricter than current 64KB to prevent layout JSON from growing with future optional metadata. Enforced after normalization (reject if normalized payload string length > 10_240).
- **Error behavior:** Return 400 with `error.code = "VALIDATION_ERROR"` and message e.g. "Payload too large" or "Too many widgets", consistent with existing validation errors.
- **Rationale:** 12 widgets today; 50 leaves room for growth. 10KB is enough for 50 small layout items with optional version field; keeps DB and cache small.

---

## 4. Normalization design

- **Canonical format:** Ordered list of widget placements per zone. Zones ordered: topRow, then main. Within each zone, widgets ordered by a stable sort (e.g. by widgetId then by order index), then renumbered to 0..n-1. Each placement: widgetId, visible, zone, order (integer 0..n-1 within zone). Optional widgetVersion when present.
- **Order normalization rules:** (1) Group by zone. (2) Within zone, sort by (order, widgetId) for stability. (3) Reassign order to 0, 1, 2, … within zone. (4) Output widgets array: all topRow first (order 0..k-1), then all main (order 0..m-1).
- **Duplicate handling:** Reject at validation (current behavior): duplicate widget ids in request body → 400. After validation we only have unique widget ids; normalization does not introduce duplicates.
- **Checksum source:** Deterministic JSON string of the normalized payload (keys sorted if needed). Use a stable digest (e.g. Node crypto createHash("sha256").update(normalizedJson).digest("hex")).
- **When checksum is computed:** (1) On save: after normalizing the validated payload, compute checksum. (2) Optionally when reading existing row: compute checksum of stored layoutJson for comparison.
- **No-op save:** If we persist checksum in DB (optional column): on save, normalize payload, compute new checksum; if existing row exists and existing checksum equals new checksum, skip DB update (no-op), still invalidate cache and return 200 with current effective layout. If we do not add a checksum column: we can still skip update by reading current row, normalizing current layoutJson, comparing normalized string to new normalized string; if equal, skip upsert. Spec recommends: add optional `checksum` column (VarChar 64) to avoid reading and re-parsing on every save; store checksum on write; on save, compute checksum of normalized payload, fetch current row by (dealershipId, userId), if current.layoutChecksum === newChecksum then skip update, else upsert. Reset always deletes row so no checksum comparison.

---

## 5. Widget versioning design

- **Registry:** Add optional `version: number` (e.g. 1) to WidgetDefinition. Default 1 for all current widgets.
- **Persisted layout items:** Add optional `widgetVersion?: number` to the placement object in layout payload. Not required for backward compatibility.
- **Backward compatibility:** Existing saved rows have no widgetVersion in layout items. Parse and merge as today; treat missing version as “legacy” and treat as compatible with current registry version (1). No migration of historical rows.
- **Future mismatch behavior:** If a layout item has widgetVersion and registry widget has a different version, treat as “known widget, version mismatch”: still include in merge using registry’s current definition (do not crash). If widget was removed from registry, already handled: strip from merge. Optionally in future we could hide or show a placeholder for mismatched versions; for this hardening, we only add the version field and merge using current definition.
- **Acceptance criteria:** Legacy layouts without version field load and render. Versioned layout items merge correctly. Removed widget ids still stripped. No crash on version mismatch.

---

## 6. Rate limit design

- **Endpoints:** POST `/api/dashboard/layout`, POST `/api/dashboard/layout/reset`.
- **Keying:** Per user per dealership: `dashboard_layout:${dealershipId}:${userId}`. Use same key for both save and reset so total mutations per user-dealership are limited.
- **Window + limit:** 1 minute window, 10 requests per window (10/minute per user per dealership). Align with existing rate-limit module (WINDOW_MS, new type with max 10).
- **Response when limited:** 429, body `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }`, consistent with e.g. last-visit and report export.
- **Logging:** No extra audit for rate limit; existing rate-limit module can be extended with a new type; no sensitive payload in logs.

---

## 7. Acceptance criteria

- **Cached reads:** When dashboard page loads and cache has entry for (dealershipId, userId), the cached serializable layout is used and getSavedLayout + merge are not called (or merge is skipped when cache hit). After TTL expiry, next load does getSavedLayout + merge and repopulates cache.
- **Cache invalidation:** After successful save or reset, cache key for that (dealershipId, userId) is deleted. Next dashboard load or API response recomputes layout.
- **Oversized payload:** Request body with >50 widgets or normalized payload size >10KB returns 400 VALIDATION_ERROR with clear message; no DB write.
- **Deterministic normalization:** Same semantic layout (same widget ids, visibility, zone assignment) produces identical normalized JSON and same checksum across calls.
- **Checksum no-op:** If implemented: when saved layout checksum equals normalized new payload checksum, no DB update is performed; cache is still invalidated (or not, since content unchanged); API returns 200 with effective layout.
- **Legacy layouts:** Saved row with layoutJson that has no widgetVersion in any item still parses; merge produces effective layout; dashboard renders.
- **Rate limit:** More than 10 save or reset requests per minute per (dealershipId, userId) results in 429 for the excess requests.

---

## 8. File plan

### Step 2 — Backend
- `apps/dealer/prisma/schema.prisma` — Add `checksum` String? (VarChar 64) to DashboardLayoutPreference if checksum persistence chosen; migration additive, nullable.
- `apps/dealer/modules/dashboard/schemas/dashboard-layout.ts` — Add MAX_JSON_BYTES = 10_240; add optional widgetVersion to placement schema; add normalizeDashboardLayout, serializeNormalizedDashboardLayout, computeDashboardLayoutChecksum; enforce size after normalization; backward-compatible parseLayoutJson for legacy version field.
- `apps/dealer/modules/dashboard/config/widget-registry.ts` — Add optional `version: number` (default 1) to WidgetDefinition; default layout includes version in placement if present.
- `apps/dealer/modules/dashboard/service/merge-dashboard-layout.ts` — Use cache in getEffectiveVisibleLayout path (or new getCachedEffectiveLayout); accept optional widgetVersion in saved items; normalize after merge; compute checksum if needed; invalidate cache not in merge (in persistence/route).
- `apps/dealer/modules/core/cache/ttl-cache.ts` — Either reuse as-is or add a named export for dashboard layout cache instance (createTtlCache({ ttlMs: 30_000, maxEntries: 1000 })) in dashboard module.
- New: `apps/dealer/modules/dashboard/service/dashboard-layout-cache.ts` — get/set/delete by key(dealershipId, userId); value = SerializableLayoutItem[]; TTL 30s.
- `apps/dealer/modules/dashboard/service/dashboard-layout-persistence.ts` — saveLayout: accept normalized payload and checksum; getSavedLayout also return checksum if column exists; optional getByUserForChecksum for no-op check; reset invalidate cache.
- `apps/dealer/app/api/dashboard/layout/route.ts` — Rate limit (key dealershipId:userId); validate size after normalization; normalize before save; checksum compare and skip update if equal; invalidate cache on save.
- `apps/dealer/app/api/dashboard/layout/reset/route.ts` — Rate limit; invalidate cache after reset.
- `apps/dealer/app/(app)/dashboard/page.tsx` — Try cache first for layout; on miss getSavedLayout + merge + toSerializableLayout, then set cache.
- `apps/dealer/lib/api/rate-limit.ts` — Add rate limit type(s) for dashboard_layout (e.g. dashboard_layout_mutation) with limit 10.
- `apps/dealer/modules/dashboard/tests/*` — New/updated tests: oversized widget count, oversized JSON, normalization deterministic, same layout same checksum, no-op save when checksum match, legacy layout without version, versioned merge, cache hit/miss, cache invalidation, rate limit 429.

### Step 3 — Frontend (only if needed)
- If API returns specific message for payload too large: optionally surface in toast in DashboardCustomizePanel (e.g. "Layout too large. Remove some widgets."). Minimal typing for version in layout item if passed to client (optional field).
- `apps/dealer/docs/DASHBOARD_PERSONALIZATION_HARDENING_FRONTEND_REPORT.md` — Only if frontend changes.

### Step 4 — Security & QA
- `apps/dealer/docs/STEP4_DASHBOARD_PERSONALIZATION_HARDENING_SECURITY_REPORT.md`
- `apps/dealer/docs/STEP4_DASHBOARD_PERSONALIZATION_HARDENING_SMOKE_REPORT.md`
- `apps/dealer/docs/STEP4_DASHBOARD_PERSONALIZATION_HARDENING_PERF_REPORT.md`

---

*Spec complete. No code until Step 2.*

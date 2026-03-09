# Dashboard Personalization — Backend Report (Step 2)

## Summary

Backend foundation for dashboard personalization is in place: data model, validation, widget registry, merge service, persistence, and API routes.

## Deliverables

### A. Data model
- **Prisma:** `DashboardLayoutPreference` model with `id`, `dealershipId`, `userId`, `layoutJson` (Json), `createdAt`, `updatedAt`.
- **Unique:** `(dealershipId, userId)`.
- **Indexes:** `dealershipId`, `userId`.
- **Migration:** `20260306120000_add_dashboard_layout_preference/migration.sql`.
- **Relations:** Dealership (Cascade), Profile (Cascade).

### B. Contracts / schemas
- **Location:** `apps/dealer/modules/dashboard/schemas/dashboard-layout.ts`.
- **Zod:** `zoneIdSchema`, `widgetPlacementSchema`, `dashboardLayoutPayloadSchema`, `dashboardLayoutPayloadWithDuplicatesSchema`, `saveLayoutBodySchema`.
- **Helpers:** `parseLayoutJson(raw)`, `isPayloadWithinSizeLimit(payload)`.
- **Rules enforced:** Duplicate widget ids rejected; max 50 widget entries; max 64KB payload; version must be 1; strict no extra keys.

### C. Widget registry
- **Location:** `apps/dealer/modules/dashboard/config/widget-registry.ts`.
- **Exports:** `WIDGET_REGISTRY`, `getWidgetById(id)`, `widgetAllowedByPermissions`, `filterByPermissions(registry, permissions)`, `getDefaultLayout(permissions)`.
- **Widgets:** 12 (4 topRow metrics + 8 main). Each has id, title, description, allowedZones, defaultZone, defaultOrder, defaultVisible, requiredPermissions, fixed, hideable.

### D. Merge service
- **Location:** `apps/dealer/modules/dashboard/service/merge-dashboard-layout.ts`.
- **Exports:** `mergeDashboardLayout(input)`, `getVisibleLayout(effective)`, `getEffectiveVisibleLayout(input)`.
- **Behavior:** Start from registry defaults filtered by RBAC; apply saved layout for allowed widgets only; strip unknown/forbidden/removed ids; normalize order within zones; fixed widgets keep default.

### E. Persistence and API
- **Persistence:** `apps/dealer/modules/dashboard/service/dashboard-layout-persistence.ts` — `getSavedLayout`, `saveLayout`, `resetLayout`.
- **Save:** `POST /api/dashboard/layout` — body validated, filtered to allowed widgets only, then upsert. Returns effective visible layout.
- **Reset:** `POST /api/dashboard/layout/reset` — delete row, return default visible layout.
- **Auth:** `getAuthContext(request)`; `guardAnyPermission(ctx, ["customers.read", "crm.read"])`. Dealership and user from session only.

### F. Audit
- **Save:** `auditLog({ action: "dashboard_layout.saved", entity: "DashboardLayoutPreference", ... })`.
- **Reset:** `auditLog({ action: "dashboard_layout.reset", entity: "DashboardLayoutPreference", ... })`.
- No payload or PII in metadata.

### G. Tests (Jest)
- **merge-dashboard-layout.test.ts:** Default layout, RBAC filtering, merge with saved, unknown/removed widgets, forbidden widgets, missing widgets, order normalization, invalid payload; getVisibleLayout.
- **dashboard-layout-schemas.test.ts:** Valid placement, invalid zone, duplicate rejection, parseLayoutJson, size limit.
- **dashboard-layout-persistence.test.ts:** getSavedLayout (null + with data), saveLayout upsert, resetLayout deleteMany.

## Commands (from repo root)

- Prisma generate: `npx prisma generate --schema=apps/dealer/prisma/schema.prisma`
- Migrate: `npx tsx scripts/prisma-migrate.ts dealer deploy`
- Run dealer tests: `npm run test --workspace=apps/dealer` or `cd apps/dealer && npm test`

## Files added/changed

| Path | Change |
|------|--------|
| apps/dealer/prisma/schema.prisma | Added DashboardLayoutPreference, relations on Dealership and Profile |
| apps/dealer/prisma/migrations/20260306120000_add_dashboard_layout_preference/migration.sql | New |
| apps/dealer/modules/dashboard/schemas/dashboard-layout.ts | New |
| apps/dealer/modules/dashboard/config/widget-registry.ts | New |
| apps/dealer/modules/dashboard/service/merge-dashboard-layout.ts | New |
| apps/dealer/modules/dashboard/service/dashboard-layout-persistence.ts | New |
| apps/dealer/app/api/dashboard/layout/route.ts | New (POST save) |
| apps/dealer/app/api/dashboard/layout/reset/route.ts | New (POST reset) |
| apps/dealer/modules/dashboard/tests/merge-dashboard-layout.test.ts | New |
| apps/dealer/modules/dashboard/tests/dashboard-layout-schemas.test.ts | New |
| apps/dealer/modules/dashboard/tests/dashboard-layout-persistence.test.ts | New |

## Next (Step 3)

- Dashboard page: load saved layout, call merge, pass effective layout to client.
- Dashboard client: render widgets by layout (widget id → component map), add “Customize dashboard” entry and customization panel (sheet/modal) with show/hide, reorder, save/cancel/reset.

# Legacy Systems Matrix

This matrix captures code-verified legacy/superseded systems as inspected on March 9, 2026. **Post–Legacy Sprint (March 2026):** Rows marked "Migrated" were addressed in the Legacy to Canonical Migration Sprint; see [LEGACY_MIGRATION_PLAN.md](./LEGACY_MIGRATION_PLAN.md) Decision Log.

Classification labels:
- `active legacy`: still affects runtime behavior or persisted data
- `passive legacy`: retained but not materially active in hot paths
- `compatibility layer`: intentional bridge to older clients/data/operations
- `deprecated retained`: known superseded path intentionally kept for now
- `dead/stale candidate`: appears unused in current runtime
- `uncertain`: could still be required; needs human confirmation

| Legacy system | Classification | Active runtime/data impact | Replacement / canonical target | Migration needed | Recommended phase | Risk | Sprint note |
|---|---|---|---|---|---|---|---|
| Non-canonical docs corpus under [`docs/`](../), [`apps/dealer/docs`](../../apps/dealer/docs), [`apps/platform/docs`](../../apps/platform/docs), [`docs/design`](../design) | passive legacy | Medium (developer/agent confusion risk) | Canonical docs in [`docs/canonical/`](./INDEX.md) | docs cleanup + archival rules | Phase 1 | Low | |
| Stale agent guidance in [`agent_spec.md`](../../agent_spec.md) (`pg-boss`, Vitest, old layout assumptions) | active legacy | High (automation behavior drift) | [`docs/canonical/INDEX.md`](./INDEX.md) + [`.cursorrules`](../../.cursorrules) | docs/tooling cleanup | Phase 1 | Medium | **Migrated:** agent_spec.md is superseded notice only. |
| Canonical-doc drift risk after fast-moving architecture changes | passive legacy | Medium (canonical trust erosion) | current code reality | periodic docs reconciliation | Phase 1 | Low | |
| Dashboard v1 API and service (removed) | — | — | Dashboard v3 only ([`getDashboardV3Data.ts`](../../apps/dealer/modules/dashboard/service/getDashboardV3Data.ts), [`/api/dashboard/v3`](../../apps/dealer/app/api/dashboard/v3/route.ts)) | — | — | — | **Migrated:** v1 route and service removed; v3 is sole dashboard data path. |
| Inventory legacy money aliases (removed) | — | — | canonical cents fields only | — | — | — | **Migrated:** Aliases removed; getSalePriceCents/getAuctionCostCents use canonical only. |
| Vehicle-photo legacy FileObject migration helpers/scripts ([`vehicle-photo.ts`](../../apps/dealer/modules/inventory/db/vehicle-photo.ts), [`vehicle-photo-backfill.ts`](../../apps/dealer/modules/inventory/service/vehicle-photo-backfill.ts), [`backfill-vehicle-photos.ts`](../../apps/dealer/scripts/backfill-vehicle-photos.ts), [`cleanup-legacy-vehicle-fileobjects.ts`](../../apps/dealer/scripts/cleanup-legacy-vehicle-fileobjects.ts)) | deprecated retained | Medium (data cleanup path) | canonical `VehiclePhoto`-backed photo model | env-by-env data verification | Phase 3/4 | Medium | Retained; backfill/cleanup still active. |
| VIN decode (single implementation) | — | — | [`vin-decode-cache.ts`](../../apps/dealer/modules/inventory/service/vin-decode-cache.ts) (NHTSA/cache); vehicle-scoped route uses same service | — | — | — | **Migrated:** Mock removed; vehicle decode uses vin-decode-cache. |
| BullMQ producers (Redis required) | — | — | Enqueue helpers throw when REDIS_URL unset | — | — | — | **Migrated:** No-Redis fallback removed. |
| Legacy CRM DB-runner execution ([`crm/jobs/run`](../../apps/dealer/app/api/crm/jobs/run/route.ts), [`job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)) alongside BullMQ worker ([`apps/worker/src`](../../apps/worker/src)) | active legacy | Medium | BullMQ execution plus Postgres durable workflow state | async convergence migration | Phase 0/3 | High | |
| Dealer invite/support bridge residue after cutover ([`modules/platform-admin`](../../apps/dealer/modules/platform-admin), dealer support-session and internal invite endpoints) | compatibility layer | Medium (platform workflows still cross apps) | dedicated platform app role model (`apps/platform/lib/platform-auth.ts`) plus dealer internal bridge only | keep bridge narrow; remove only if platform/dealer ownership changes | Phase 0/3/4 | Medium | Documented in DEALER_PLATFORM_BRIDGE_SURFACE. |
| RBAC normalization compatibility artifacts ([`permissions.ts`](../../apps/dealer/lib/constants/permissions.ts) legacy maps + removed keys, [`normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts), [`repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts)) | compatibility layer | High (live data migration path) | normalized canonical permission catalog | staged data migration in each env | Phase 3 | High | Legacy maps retained for script use; documented. |
| Dead customer UI (CustomersListPage removed) | — | — | `CustomersPageClient` only | — | — | — | **Migrated:** CustomersListPage removed; tests use CustomersPageClient. |
| Deprecated deal-desk wrapper (removed) | — | — | `saveFullDealDesk` only | — | — | — | **Migrated:** updateDealDesk removed. |
| Mobile Supabase proxy (removed) | — | — | `getSupabase()` only | — | — | — | **Migrated:** Deprecated export removed; auth-service uses getSupabase(). |
| Obsolete rule source file [`agent_spec.md`](../../agent_spec.md) | active legacy | Medium | `.cursorrules` + canonical docs | superseded notice added | Phase 1 | Medium | **Migrated:** Superseded notice only. |
| Stale or duplicate tooling artifacts (removed) | — | — | root package.json + Jest | — | — | — | **Migrated:** dms-package.json and vitest-to-jest.js deleted. |

# Optimization Matrix

| Optimization item | Area | Impact | Effort | Risk | Evidence | Recommended phase | Notes |
|---|---|---|---|---|---|---|---|
| Request-scoped caching for dealer session, tenant, and permissions | Dealer runtime / DB | High | Medium | Low | `apps/dealer/lib/api/handler.ts`, `apps/dealer/lib/tenant.ts`, `apps/dealer/lib/rbac.ts` | Phase 1 | Repeated request-time lookups are explicit in current code. |
| Reuse BullMQ `Queue` instances in enqueue helpers | Worker producer path | Medium | Low | Low | `apps/dealer/lib/infrastructure/jobs/enqueue*.ts` | Phase 1 | Clear quick win. |
| Reduce worker success-path logs | Worker ops / cost | Medium | Low | Low | `apps/worker/src/workers/*.worker.ts` | Phase 1 | Keep failure and summary logs. |
| Remove routine `prisma generate` from default dealer test loop | Build/test | Medium | Low | Low | `apps/dealer/package.json` | Phase 1 | Developer-speed improvement. |
| Lazy-load chart-heavy reports UI | Dealer bundle / rendering | Medium | Medium | Low | `apps/dealer/modules/reports/ui/ReportsPage.tsx` | Phase 1 | `recharts` is statically imported today. |
| Replace dashboard row-fetch trend aggregation with grouped counts | Dealer runtime / DB | High | Medium | Medium | `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts` | Phase 2 | High-value endpoint with current JS aggregation. |
| Reduce reports fan-out and in-memory joins | Dealer reports / DB | High | Medium | Medium | `apps/dealer/modules/reports/db/sales.ts`, `finance.ts`, `inventory.ts` | Phase 2 | Needs endpoint-by-endpoint work, not one rewrite. |
| Measure inventory list enrichment cost before refactor | Dealer runtime / DB | High | Medium | Low | `apps/dealer/modules/inventory/service/inventory-page.ts` | Phase 0 | Likely hotspot, but dominant contributor is not proven yet. |
| Reduce platform monitoring bridge overhead | Platform runtime | Medium | Medium | Medium | `apps/platform/lib/call-dealer-internal.ts` | Phase 2 | Likely batch/caching opportunity. |
| Split large client pages into server-shell + client islands | Dealer/platform rendering | High | Medium | Medium | `apps/platform/app/(platform)/platform/dealerships/[id]/page.tsx`, large dealer `use client` pages | Phase 3 | Best after bundle measurement. |
| Simplify preserved CRM worker loop internals | Worker / CRM | Medium | High | High | `apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts` | Phase 4 | Only after rollout confidence. |
| Search/index optimization for `contains` queries | DB/search | Unknown | Medium | Medium | `apps/dealer/modules/customers/db/customers.ts`, `apps/dealer/modules/inventory/db/vehicle.ts` | Phase 0 -> 2 | Requires measurement first. |
| Reduce mobile auth token-user lookup churn | Mobile runtime | Low to Medium | Medium | Low | `apps/mobile/src/auth/auth-service.ts` | Phase 3 | Likely smaller payoff than dealer/web work. |
| Consolidate serializer / DTO duplication in high-noise areas | Code health / API shapes | Medium | Medium | Medium | `apps/dealer/app/api/deals/serialize.ts`, `apps/mobile/src/api/endpoints.ts` | Phase 5 | Start with a narrow domain, not repo-wide. |
| Clean stale docs/tooling artifacts that increase repo noise | Repo health | Medium | Low | Low | `agent_spec.md`, `dms-package.json`, `scripts/vitest-to-jest.js` | Phase 5 | Productivity gain, not runtime gain. |

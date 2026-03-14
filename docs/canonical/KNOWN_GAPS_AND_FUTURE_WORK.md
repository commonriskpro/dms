# Known Gaps and Future Work

This file separates implemented work from incomplete or absent work.

## 1. Background Processing

### BullMQ worker execution

Status:
- Implemented with operational follow-up remaining

What exists:
- Queue definitions
- Dealer enqueue helpers
- Separate worker process
- Signed dealer internal job endpoints for:
  - bulk import
  - analytics
  - alerts
  - VIN follow-up
- Focused worker/dealer tests for the completed handlers

Gap:
- The repo still cannot prove every live environment actually runs the worker with correct `REDIS_URL`, `DEALER_INTERNAL_API_URL`, and `INTERNAL_API_JWT_SECRET` settings.
- Worker coverage is focused, not yet full Redis-backed end-to-end integration coverage.
- CRM execution is BullMQ-triggered (see CRM_ASYNC_CUTOVER_REPORT); the worker invokes the dealer's job-worker for Postgres workflow state (intentional design). No further convergence required for this path.

## 2. Marketplace and Listings

### External marketplace syndication

Status:
- Planned/partial

What exists:
- `VehicleListing` model
- publish/unpublish endpoints
- inventory feed endpoint

Gap:
- No confirmed outbound integrations to Autotrader, Cars.com, Carfax, Facebook Marketplace, or similar providers.

## 3. Auctions

### Real auction provider connectivity

Status:
- Partial

What exists:
- Auction-facing models
- Search/detail/appraisal routes
- purchase tracking

Gap:
- Current provider behavior is mock-backed rather than real upstream integration.

## 4. Billing

### Automated billing and payments

Status:
- Scaffolded

What exists:
- Platform subscription records
- billing overview endpoint
- plan/limits modeling

Gap:
- No Stripe integration
- No billing webhooks
- No automated provider reconciliation

## 5. Mobile Push Notifications

Status:
- Scaffolded

What exists:
- Expo push service wrapper
- feature flag

Gap:
- Feature flag is off
- backend device-token persistence endpoint is not implemented
- no delivery workflow built around push payloads

## 6. External Lender Connectivity

Status:
- Partial

What exists:
- Lender/application/stipulation models
- route surfaces
- external-system enum values

Gap:
- No confirmed live RouteOne/Dealertrack/CUDL connector implementation in current source.

## 7. Dealer RBAC Rollout

Status:
- Operational follow-up

What exists:
- Dealer RBAC naming is normalized around:
  - `domain.read`
  - `domain.write`
  - `domain.subdomain.read`
  - `domain.subdomain.write`
- Canonical dealer catalog lives in `apps/dealer/lib/constants/permissions.ts`.
- Existing-database cleanup path exists in `apps/dealer/scripts/normalize-rbac-permissions.ts`.

Remaining work:
- Non-reset databases still need the normalization script run so stale permission rows, role assignments, and overrides are cleaned up.
- Historical RBAC audit/deprecation docs in this folder remain useful for provenance, but they describe pre-normalization state.

## 8. Documentation Drift

Status:
- Current technical debt being addressed by this canonical set

Observed issues:
- Some legacy docs may still refer to Vitest; canonical test runner is Jest (see .cursorrules and TESTING_QA_CANONICAL).
- `agent_spec.md` still exists even though `.cursorrules` is the canonical rule source.
- Legacy specs describe broader integrations than current code implements.

## 9. Residual Platform Compatibility

Status:
- Implemented and narrowed

What exists:
- The dealer-hosted platform pages and public dealer `/api/platform/*` control-plane routes were removed.
- Dealer still retains:
  - dealer internal provisioning, status-sync, monitoring, invite, and dealer-application bridge endpoints used by `apps/platform`
  - dealer public invite acceptance and support-session endpoints

Current boundary:
- Dealer-side compatibility is now limited to dealer-owned bridge flows:
  - invite acceptance and support-session
  - provisioning and lifecycle sync
  - monitoring telemetry
  - dealer-application onboarding bridge
- The old dealer `PlatformAdmin` helper, session overlay, tenant bypass, seed path, and schema model were removed in the residual cleanup sprint.

## 10. CI and Release Automation

Status:
- Partial

What exists:
- GitHub Actions migration workflow

Gap:
- No test CI workflow found
- No broad automated release/test pipeline beyond the migration workflow

## 11. Worker Test Coverage

Status:
- Partial

Observed:
- Focused worker-handler tests exist in `apps/worker/src/workers/worker-handlers.test.ts`.
- Dealer-side async job tests exist in:
  - `apps/dealer/modules/inventory/service/bulk.worker.test.ts`
  - `apps/dealer/modules/intelligence/service/async-jobs.test.ts`

Gap:
- No Redis-backed end-to-end worker integration suite was found.
- No CI workflow currently guarantees worker tests run on every change.
- CRM execution now queues through BullMQ, but the repo still lacks Redis-backed integration tests proving the full enqueue -> worker -> dealer-internal CRM path.

## 12. Mobile Coverage Depth

Status:
- Partial

What exists:
- Real mobile app with auth, dashboard, inventory, customers, deals

Gap:
- Small automated test surface
- settings/more area is shallow
- no push or deep ops/admin tooling on mobile

## 13. Operational Unknowns Requiring Human Confirmation

These were not fully provable from code alone:
- Whether production actually runs the standalone worker in all environments
- Whether any real third-party auction or lender connectors exist outside this repo
- Whether platform billing is intentionally display-only or waiting on a payment provider integration

## 14. Suggested Future Work Priorities

1. Verify worker rollout, supervision, and env configuration in every live environment.
2. Run the dealer RBAC normalization script in every non-reset environment that still has older permission rows.
3. Add Redis-backed integration coverage for the CRM BullMQ execution path and verify cron/operator rollout in live environments.
4. Decide whether marketplace/auction/lender integrations are real roadmap items or should be de-scoped in code and docs.
5. Add explicit CI test workflow plus broader worker integration coverage.
6. Websites Module MVP: Steps 1–4 complete (see `apps/dealer/docs/STEP4_WEBSITES_SECURITY_REPORT.md`).

## 15. Websites / Dealer Website Platform

Status:
- **Implemented** (Steps 1–4 complete as of 2026-03-14)

What is implemented:
- `apps/websites` public Next.js runtime (separate workspace, hostname-based tenant resolution)
- Prisma models: `WebsiteSite`, `WebsitePage`, `WebsiteDomain`, `WebsitePublishRelease`, `WebsiteLeadForm`, `VehicleWebsiteSettings`
- `apps/dealer/modules/websites-core` — site/page/form CRUD + admin UI
- `apps/dealer/modules/websites-publishing` — atomic publish + release history
- `apps/dealer/modules/websites-public` — public-safe serializers + hostname-resolved tenant reads
- `apps/dealer/modules/websites-templates` — `premium-default` template registry
- `apps/dealer/modules/websites-leads` — lead submission, rate limiting, honeypot, CRM integration
- `apps/dealer/modules/websites-domains` — subdomain allocation + hostname resolution with normalization
- Dealer private API routes `/api/websites/*` (RBAC-gated `websites.read/write`)
- Public API routes `/api/public/websites/*` (hostname-authoritative, no client dealershipId)
- Dealer admin UI at `/websites/*` (Overview, Theme, Page configuration, Publish, Domains, Analytics)
- Permissions: `websites.read`, `websites.write`
- Shared contracts: `packages/contracts/src/websites.ts`, `websites-public.ts`, `websites-forms.ts`
- `premium-default` template: SiteHeader, SiteFooter, VehicleCard, LeadForm
- Public pages: homepage, inventory list, VDP, contact, sitemap.xml, robots.txt
- Rate limit: `website_lead` type, 5/min per IP (Redis-backed when REDIS_URL set; in-memory fallback)
- Test coverage: 46 tests across 4 test suites

Security hardening (Step 4 + configuration boundary):
- Public routes accept `hostname` only — no `dealershipId` from client
- Publish is atomic (single Prisma `$transaction`)
- Hostname normalization: strips port, trailing dots, www prefix
- `_hp` honeypot enforced at schema level (`z.string().max(0)`)
- No `dangerouslySetInnerHTML` in public templates
- **Dealer = configuration only:** Explicit ownership boundary (see `apps/dealer/docs/WEBSITES_MODULE_SPEC.md`): **Platform Admin** owns template code, advanced layout, custom widgets, domain/SSL technical setup, provisioning; **Dealer Owner** owns template selection, branding, approved section toggles/order, safe content, inventory display, SEO, publish. All dealer-editable fields use allowlisted schemas and safe-content validation (no markup/script). **Output model:** render text as text; do not add rich text mode; avoid markdown unless tightly controlled; keep section config enums/fields explicit to prevent boundary drift. Tests: `modules/websites-core/tests/website-safe-content.test.ts`.

**Websites Platform Scale-Up (Post-MVP):** Steps 1–4 complete as of 2026-03-13.
- **Track 1:** Redis-backed rate limiting for `website_lead` (fallback to in-memory when Redis unavailable).
- **Track 2:** Public photo endpoint `GET /api/public/websites/photo?fileId=&hostname=` (302 to signed URL); media helper and `next/image` in apps/websites.
- **Track 3:** Domain verify/refresh APIs (`POST .../domains/[id]/verify`, `.../refresh-ssl`) and Domains UI.
- **Track 4:** Publish-triggered revalidation (dealer calls WEBSITES_REVALIDATE_URL with secret; apps/websites `POST /api/revalidate`).
- **Track 5:** Website analytics: `WebsitePageView` model, public ingest `POST /api/public/websites/events`, dealer read APIs (summary, top-pages, top-vdps, leads-by-source), Analytics UI.
- **Track 6:** Rollback API `POST /api/websites/publish/releases/[id]/rollback` and rollback UI on Publish page.
- **Track 7:** Pre-rendering: doc only (ISR/revalidate strategy in WEBSITES_CACHING_AND_DELIVERY_SPEC).
Reports: `STEP4_WEBSITES_SCALEUP_SECURITY_REPORT.md`, `STEP4_WEBSITES_SCALEUP_SMOKE_REPORT.md`, `STEP4_WEBSITES_SCALEUP_TEST_REPORT.md`.

Known remaining gaps (out of scope for Scale-Up):
- Drag-and-drop page builder
- Real DNS/SSL provider integration (domain APIs are stub providers; foundations in place)
- Full marketing analytics / A/B testing beyond first loop
- Blog/news CMS
- External lender/financing integrations from the public site
- Mobile parity for website admin
- Optional pre-rendering (e.g. static host list) beyond current revalidate TTLs

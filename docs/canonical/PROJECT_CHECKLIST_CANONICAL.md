# Project Checklist Canonical

This checklist is the structured project progress view derived from current code and canonical docs as inspected on March 9, 2026.

Status keys:
- `Done`
- `Partial`
- `Missing`
- `Deprecated / Superseded`
- `Needs confirmation`

Project-wide completion estimate:
- `77%`

## 1. Architecture / Foundation

Estimated progress:
- `82%`

Done:
- Monorepo with dealer, platform, mobile, worker, and contracts workspaces.
- Separate dealer and platform Prisma schemas and databases.
- Dealer modular-monolith domain structure under `apps/dealer/modules/*`.
- Shared internal contract package in `packages/contracts`.
- Health endpoints in dealer and platform apps.
- Metrics endpoint in dealer app.
- Platform monitoring and maintenance route surface.
- Canonical RBAC model and rollout tooling.
- `main` is the canonical deploy branch in the current GitHub Actions workflow.
- `.cursorrules` is the canonical active rule source.

Partial:
- Dealer-hosted platform surfaces still coexist with the now-canonical `apps/platform` control plane.
- Async execution still includes a legacy dealer DB-runner path even though BullMQ is the chosen execution model.
- Operational automation and CI breadth relative to system size.

Missing:
- Dedicated end-to-end release/test automation pipeline.

Deprecated / Superseded:
- Vitest as canonical runner.
- `pg-boss` as canonical queue model.

Needs confirmation:
- Whether the standalone worker is deployed in all production-like environments.

## 2. Dealer App

Estimated progress:
- `84%`

Done:
- Large authenticated dealer UI surface across inventory, customers, CRM, deals, reports, vendors, accounting, files, admin, onboarding.
- Public auth, apply, invite, and password-reset flows.
- Strong dealer API breadth with 269 route handlers.
- Mature RBAC and tenant-aware API patterns.

Partial:
- Settings surface depth.
- Some inventory edit tabs still show placeholder content.
- Some older dashboard-v1 style permission-gated sections still coexist with dashboard-v3 shell.
- Dealer-hosted platform-admin pages still exist here as transitional legacy surfaces rather than growth targets.

Missing:
- Full parity for every modeled subsystem at polished UI depth.

Needs confirmation:
- Which dealer-hosted platform-admin surfaces are actively used in production versus kept for support/ops convenience.

## 3. Platform App

Estimated progress:
- `78%`

Done:
- `apps/platform` is the canonical control-plane app.
- Platform auth and role gating.
- Applications review, approval, rejection, provision, invite-owner flows.
- Dealership registry and status/provisioning routes.
- Platform users and accounts.
- Monitoring, maintenance, audit, and summary reports.
- Subscription records and plan/status CRUD.

Partial:
- Billing page and billing API are display/internal-plan management only.
- Platform reports are useful but limited to ops summaries.

Missing:
- External billing/payment-provider automation.
- Full commercial SaaS back-office workflow depth.

Needs confirmation:
- Whether platform billing is intentionally internal-only long term.

## 4. Mobile App

Estimated progress:
- `58%`

Done:
- Login, forgot/reset password, accept invite.
- Dashboard screen backed by dealer dashboard APIs.
- Inventory list/detail/create/edit with photo upload.
- Customers list/detail/create/edit with note/timeline access.
- Deals list/detail/create/edit with status update.
- Dealership switching.

Partial:
- More/settings screen is shallow.
- Feature coverage is limited to core dealer workflows.
- Test coverage is light.

Missing:
- Admin, reports, accounting, lender, and deep CRM automation tooling.
- Push-token persistence/backend support.
- Broad navigation or E2E coverage.

Needs confirmation:
- Whether the mobile app is intended to reach parity or remain a companion app.

## 5. Worker / Jobs

Estimated progress:
- `74%`

Done:
- Separate worker package and startup process.
- BullMQ queue names and Redis plumbing.
- Dealer enqueue helpers for analytics, VIN decode, alerts, and bulk import.
- Dealer DB-backed CRM job execution path.
- Signed dealer internal worker endpoints.
- Bulk import worker-backed execution with persisted job progress and terminal state.
- Analytics/alerts worker-backed execution through cache invalidation and intelligence-signal refresh.
- VIN follow-up worker execution for cache warming and decode attachment.
- Focused worker-handler and dealer async job tests.

Partial:
- BullMQ is the canonical execution layer, but CRM execution still includes a legacy DB-runner path.
- VIN decode primary decode remains synchronous on dealer routes; worker covers secondary follow-up only.
- Worker deployment confidence and environment rollout verification.
- End-to-end Redis/dealer integration coverage.

Missing:
- Dedicated worker deployment/health automation proof inside the repo.

Needs confirmation:
- Whether any environments rely materially on the standalone worker today.

## 6. Auth / Tenancy / RBAC

Estimated progress:
- `88%`

Done:
- Dealer auth via Supabase cookies and bearer tokens.
- Platform auth via platform-user role model.
- Encrypted active-dealership cookie.
- Mobile bearer-token dealership resolution.
- Dealership lifecycle enforcement.
- Dealer canonical permission vocabulary and normalization tooling.
- Platform role-based access model.

Partial:
- Live-environment RBAC rollout still requires operator runbooks and environment verification.

Missing:
- Nothing major in-model.

Deprecated / Superseded:
- Dealer granular CRUD/action permission vocabulary as canonical runtime model.
- Dealer `platform.*` permission strings as canonical dealer RBAC vocabulary.

Needs confirmation:
- Which long-lived environments still contain stale RBAC data pending rollout.

## 7. Inventory

Estimated progress:
- `86%`

Done:
- Vehicle CRUD, list, detail, search/filter, pricing display.
- VIN decode and VIN cache support.
- Photos and photo ordering/primary selection.
- Cost ledger and cost documents.
- Recon support.
- Floorplan routes and models.
- Valuation/book values.
- Pricing rules and apply/preview flows.
- Acquisition pipeline.
- Appraisals.
- Inventory alerts/dashboard.
- Internal listing state and feed generation.

Partial:
- Bulk import async rollout/supervision confidence in live environments.
- Auction provider behavior is mock-backed.
- Marketplace syndication stops at internal feed/listing generation.
- Some edit UI tabs remain placeholder-level.

Missing:
- Confirmed outbound marketplace transport.
- Confirmed real auction provider connector.

Needs confirmation:
- Whether any external listing sync happens outside this repository.

## 8. Customers / CRM

Estimated progress:
- `81%`

Done:
- Customer CRUD.
- Phones/emails/address/tags.
- Notes, tasks, callbacks, timeline, activity.
- Saved filters and saved searches.
- Pipelines, stages, opportunities.
- Sequences and automation rules.
- CRM job persistence and DB-backed execution.
- Journey bar and lead source reporting.

Partial:
- CRM inbox depth.
- Appointment handling is limited rather than a full scheduling subsystem.
- Some customer-adjacent UI still contains future placeholder content.

Missing:
- Full omnichannel inbox/productized communications suite.
- Rich scheduling subsystem.

## 9. Deals / Finance / Desking

Estimated progress:
- `80%`

Done:
- Deal CRUD and board/list views.
- Deal desk calculations.
- Fees and trades.
- Delivery workflow.
- Funding workflow.
- Title and DMV workflow.
- Deal history and profit surfaces.
- Finance shell calculations and product management.
- Credit applications, lender applications, submissions, stipulations.
- Compliance forms and deal document flows.

Partial:
- External lender connector depth.
- Some finance behavior is broad in schema/modeling but not proven against real upstream systems.

Missing:
- Confirmed live RouteOne/Dealertrack/CUDL-style integrations in repo.

Needs confirmation:
- Whether real lender connectors exist outside this codebase.

## 10. Reports / Analytics

Estimated progress:
- `78%`

Done:
- Dealer sales summary.
- Sales by user / salesperson performance.
- Dealer profit.
- Inventory aging and ROI.
- Finance penetration.
- Pipeline reports.
- CSV export support.
- Global search.
- Platform usage/growth/funnel summaries.

Partial:
- Platform analytics depth beyond ops reporting.
- Worker-based analytics recomputation.
- Intelligence/signals depth.

Missing:
- Broad BI/analytics platform behavior.

## 11. Integrations

Estimated progress:
- `57%`

Done:
- Supabase.
- Twilio send plus inbound/status webhooks.
- SendGrid send plus inbound parse route.
- Resend for platform email.
- Slack webhook alerting.
- NHTSA vPIC VIN decode path.
- Signed platform-to-dealer internal bridge.

Partial:
- BullMQ/Redis rollout confidence in live environments.
- Marketplace feed generation without confirmed outbound sync.
- Auction domain with mock-backed provider behavior.
- Lender external-system modeling without proven deep connectors.

Missing:
- Stripe/payment-provider billing integration.
- Confirmed real marketplace syndication.
- Confirmed real auction connectors.
- Confirmed real lender connectors.

Deprecated / Superseded:
- Removed dealer QuickBooks/integration permission families as canonical RBAC vocabulary.

Needs confirmation:
- Whether external connectors exist outside the repo.

## 12. Platform SaaS / Provisioning / Subscriptions

Estimated progress:
- `72%`

Done:
- Application review and approval.
- Dealership provisioning.
- Owner invite orchestration.
- Dealership mapping/status support.
- Platform subscriptions record management.
- Operational monitoring and audit.

Partial:
- Billing view is scaffold/display-only.
- Subscription records are internal operational data, not proof of automated billing.

Missing:
- Payment automation.
- Billing reconciliation/webhooks.
- Commercial billing lifecycle maturity.

Needs confirmation:
- Product intent for platform billing depth.

## 13. Docs / Developer Experience

Estimated progress:
- `83%`

Done:
- Canonical docs set under `docs/canonical`.
- `.cursorrules` reflects the active stack/rules.
- Architecture, API, DB, workflow, testing, RBAC, rollout, and migration docs.
- Runbooks for live RBAC rollout and review.
- Root/app scripts for migrations, resets, seeding, and RBAC normalization.

Partial:
- Legacy docs still exist outside canonical set as reference.
- Operational knowledge still depends on some human confirmation for environment reality.
- `agent_spec.md` still exists in the repo even though it is obsolete.

Missing:
- Fully automated environment verification/reporting around rollout state.

Deprecated / Superseded:
- legacy docs outside `docs/canonical` as source of truth.
- `agent_spec.md` as an active rule source.

## 14. Testing / QA / Production Readiness

Estimated progress:
- `70%`

Done:
- Strong dealer backend test surface.
- Strong platform API RBAC and monitoring tests.
- Good tenant-isolation and RBAC coverage.
- Focused mobile validation/unit tests.
- Focused worker-handler and dealer async job tests.

Partial:
- Mobile automated coverage depth.
- Production readiness for worker-driven flows.
- CI/release automation maturity.

Missing:
- Dedicated test CI workflow.
- Browser E2E test framework.

Needs confirmation:
- How much operational confidence current teams have in worker-dependent or integration-dependent flows outside local/test environments.

## 15. Deprecated / Superseded Summary

Deprecated / Superseded:
- Vitest as current repo test runner.
- `pg-boss` as current queue implementation.
- dealer-hosted platform surfaces as the long-term platform control plane.
- DB-runner execution as the preferred async pattern for new work.
- Dealer granular CRUD/action RBAC vocabulary as canonical model.
- Dealer `platform.*` permission vocabulary as canonical dealer RBAC model.
- Older docs outside `docs/canonical` as authoritative status sources.

## 16. Needs-Confirmation Summary

Needs confirmation:
- standalone worker deployment/use in live environments
- real external marketplace, auction, and lender connectors outside repo
- long-term intent for platform billing automation
- live-environment RBAC rollout completeness for older databases

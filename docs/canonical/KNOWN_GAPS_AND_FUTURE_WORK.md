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
- Dealer CRM job execution still includes a legacy DB-runner path that should converge toward BullMQ execution while keeping Postgres workflow state.

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
- Legacy docs still refer to Vitest.
- `agent_spec.md` still exists even though `.cursorrules` is the canonical rule source.
- Legacy specs describe broader integrations than current code implements.

## 9. CI and Release Automation

Status:
- Partial

What exists:
- GitHub Actions migration workflow

Gap:
- No test CI workflow found
- No broad automated release/test pipeline beyond the migration workflow

## 10. Worker Test Coverage

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

## 11. Mobile Coverage Depth

Status:
- Partial

What exists:
- Real mobile app with auth, dashboard, inventory, customers, deals

Gap:
- Small automated test surface
- settings/more area is shallow
- no push or deep ops/admin tooling on mobile

## 12. Operational Unknowns Requiring Human Confirmation

These were not fully provable from code alone:
- Whether production actually runs the standalone worker in all environments
- Whether any real third-party auction or lender connectors exist outside this repo
- Whether platform billing is intentionally display-only or waiting on a payment provider integration

## 13. Suggested Future Work Priorities

1. Verify worker rollout, supervision, and env configuration in every live environment.
2. Run the dealer RBAC normalization script in every non-reset environment that still has older permission rows.
3. Plan and execute CRM async convergence from the legacy DB-runner path to BullMQ execution while preserving Postgres workflow state.
4. Decide whether marketplace/auction/lender integrations are real roadmap items or should be de-scoped in code and docs.
5. Add explicit CI test workflow plus Redis-backed worker integration coverage.

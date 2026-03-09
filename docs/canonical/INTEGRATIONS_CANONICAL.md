# Integrations Canonical

This file distinguishes real integrations from placeholders.

Status labels:
- `Implemented`
- `Partial`
- `Scaffolded`

## 1. Supabase

Status:
- Implemented

Used for:
- Dealer auth
- Platform auth
- Dealer and platform Postgres databases
- Dealer file/storage flows
- Service-role admin operations
- Mobile auth

Code locations:
- Dealer auth/storage helpers under `apps/dealer/lib/supabase/*`
- Platform auth helpers under `apps/platform/lib/supabase/*`
- Mobile Supabase auth client under `apps/mobile/src/auth/*`

Current behavior:
- Dealer and platform apps use separate env files and separate Supabase projects/databases.
- Mobile app shares dealer auth/backend.
- Prisma migrations target Supabase Postgres, with direct connection recommended for migrations/resets.

## 2. Twilio

Status:
- Implemented

Used for:
- Outbound SMS
- Inbound message/status webhooks

Code locations:
- `apps/dealer/modules/integrations/service/sms.ts`
- `/api/messages/sms`
- `/api/webhooks/twilio`
- `/api/webhooks/twilio/status`

Current behavior:
- Outbound send logic is real.
- Webhook handling is real.
- Security includes webhook verification logic.

## 3. SendGrid

Status:
- Implemented

Used for:
- Dealer outbound email
- Dealer inbound email webhook processing

Code locations:
- `apps/dealer/modules/integrations/service/email.ts`
- `/api/messages/email`
- `/api/webhooks/sendgrid`

Current behavior:
- Send logic is real.
- Webhook ingestion path is real.

## 4. Resend

Status:
- Implemented

Used for:
- Platform owner invite emails
- Platform health/alert email paths

Code locations:
- `apps/platform/lib/email/resend.ts`
- owner invite routes and monitoring services

Current behavior:
- Real transactional email integration on the platform side.

## 5. Slack Webhook Alerting

Status:
- Implemented

Used for:
- Platform monitoring alerts

Code locations:
- Platform monitoring/check-health services and alerting helpers

Current behavior:
- Slack is used as an operational alert channel for health failures/recoveries.

## 6. NHTSA vPIC VIN Decode

Status:
- Implemented

Used for:
- VIN decode and vehicle enrichment

Code locations:
- Dealer inventory services and VIN decode routes

Current behavior:
- Dealer app can decode VINs through NHTSA/vPIC-backed calls.
- Cache tables exist to avoid repeated remote calls.

## 7. Internal Dealer/Platform JWT Bridge

Status:
- Implemented

Used for:
- Provisioning
- Application status sync
- Owner invites
- Monitoring/job-run/rate-limit proxying

Code locations:
- `apps/platform/lib/call-dealer-internal.ts`
- Dealer `/api/internal/*`
- Shared contracts in `packages/contracts/src/internal/*`

Current behavior:
- Signed JWT secret required on both sides.
- Bridge is core to control-plane operations.

## 8. BullMQ and Redis

Status:
- Partial

Used for:
- Analytics queue
- VIN decode queue
- Bulk import queue
- Alerts queue

Code locations:
- Dealer enqueue helpers in `apps/dealer/lib/infrastructure/jobs/*`
- Worker app in `apps/worker/src/*`

Current behavior:
- Queue infrastructure is real when `REDIS_URL` is present.
- Worker app boots and subscribes.
- Several handlers are still placeholder/scaffold level.

## 9. Marketplace and Listing Integrations

Status:
- Partial

Modeled platforms:
- `WEBSITE`
- `AUTOTRADER`
- `CARS`
- `CARFAX`
- `FACEBOOK`

Current implementation:
- Internal listing records
- Publish/unpublish state
- Feed generation via `/api/inventory/feed`

Not currently implemented:
- Verified outbound marketplace API integrations
- Provider credential management and sync jobs
- Delivery acknowledgements/reconciliation

## 10. Auction Integrations

Status:
- Partial

Modeled providers:
- `COPART`
- `IAAI`
- `MANHEIM`
- `ACV`
- `MOCK`

Current implementation:
- Auction-facing models and route surface exist.
- Service behavior currently relies on mock-provider data generation/caching.

Conclusion:
- Auction domain is modeled.
- Real external auction integration is not present.

## 11. External Lender Systems

Status:
- Partial

Modeled systems:
- `ROUTEONE`
- `DEALERTRACK`
- `CUDL`
- `OTHER`

Current implementation:
- Lender/application/stipulation models and routes are real.
- External system identifiers and statuses are modeled.

Not currently implemented:
- Confirmed live API connectors to RouteOne, Dealertrack, or CUDL in this codebase.

## 12. Sentry

Status:
- Implemented on platform app

Code location:
- `apps/platform/next.config.js`
- platform monitoring/error handling helpers

Current behavior:
- Platform build is wrapped with `withSentryConfig`.
- Dealer app uses internal monitoring hooks but not the same explicit Sentry Next.js config wrapper in the inspected files.

## 13. Vercel

Status:
- Implemented

Used for:
- Dealer and platform web deployments

Code locations:
- `scripts/vercel-build.js`
- `vercel.json`
- docs and env templates

Current behavior:
- Root build dispatches based on `VERCEL_PROJECT_NAME`.
- Separate dealer and platform Vercel project expectations are encoded in the build script.

## 14. GitHub Actions

Status:
- Implemented, limited scope

Code location:
- `.github/workflows/deploy.yml`

Current behavior:
- Push to `main` or manual dispatch runs Prisma migrations.
- Workflow uses Node `24`, matching the repo root engine guidance.

Current limitation:
- The workflow scope is still narrow; no broad test CI workflow was found.

## 15. Mobile Push Notifications

Status:
- Scaffolded

Code location:
- `apps/mobile/src/services/push.ts`
- `apps/mobile/src/config/features.ts`

Current behavior:
- Feature flag is hardcoded off.
- Service code can request Expo token when enabled.
- Backend token storage endpoint is not implemented.

## 16. Integration Summary

Real and production-relevant:
- Supabase
- Twilio
- SendGrid
- Resend
- Slack webhook alerting
- NHTSA/vPIC
- Internal JWT bridge
- Vercel deployment

Real but incomplete:
- BullMQ/Redis async execution
- Marketplace/listing integrations
- Auction integrations
- External lender integrations
- Mobile push notifications

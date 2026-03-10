# Workflows Canonical

This file describes major end-to-end workflows as currently implemented.

## 1. Authentication and Active Dealership Workflow

Status:
- Implemented and code-backed

Web flow:
1. User authenticates through Supabase-backed dealer auth routes.
2. Dealer session is resolved server-side.
3. Active dealership is read from encrypted cookie.
4. Membership and dealership lifecycle are revalidated.
5. Effective permissions are loaded for that dealership.
6. UI and API requests operate within that tenant context.

Mobile flow:
1. User signs in through Supabase from the Expo app.
2. Access/refresh tokens are stored in Expo Secure Store.
3. Dealer API requests attach Bearer token.
4. Dealer backend resolves user from token and then resolves active dealership.
5. On 401, mobile client attempts refresh and retries once.

Dealership switch flow:
1. Client calls dealer session switch/current-dealership endpoint.
2. Server validates requested dealership against memberships or platform-admin support path.
3. Encrypted active-dealership cookie or user-active-dealership state is updated.

## 2. Dealer Application to Provisioned Tenant Workflow

Status:
- Implemented and code-backed

Flow:
1. Applicant starts draft through `/api/apply/draft` or invite-linked path.
2. Dealer app stores dealer-side application records.
3. Platform app reads/reviews platform-side `Application` records.
4. Platform owner/compliance approves or rejects.
5. Platform owner provisions approved application.
6. Platform app calls dealer internal provisioning endpoint with signed JWT.
7. Dealer app creates dealership, roles/memberships scaffolding, and supporting records.
8. Platform app records `DealershipMapping`.
9. Platform owner can trigger owner invite.
10. Dealer invite is accepted, dealership membership is activated.
11. Dealer onboarding flow becomes available in `get-started`.

Important current behavior:
- Provisioning is idempotency-aware.
- Internal dealer/platform calls use signed JWT, not public tenant auth.

## 3. Invite and Owner Activation Workflow

Status:
- Implemented and code-backed

Flow:
1. Platform owner triggers owner invite for a provisioned dealership.
2. Platform app calls dealer internal owner-invite endpoint.
3. Dealer app creates invite and returns accept URL when available.
4. Platform app optionally sends invite email via Resend.
5. Invitee resolves token through dealer public invite endpoints.
6. Invitee accepts invite.
7. Dealer membership is created or updated.
8. Active dealership can be established for the new owner.

Current limitations:
- Email dedupe window exists.
- Invite orchestration is real, but broader invitation campaign tooling does not exist.

## 4. Dealer Onboarding Workflow

Status:
- Implemented and code-backed

Core behavior:
- Onboarding state is persisted in `DealershipOnboardingState`.
- Dealer app exposes current onboarding status and update endpoints.
- UI guides user through a six-step launch flow.

Observed flow shape:
1. Dealer signs in with no fully active setup.
2. App redirects to `get-started`.
3. User completes dealership info and readiness steps.
4. Launch step marks onboarding completion state.

## 5. Inventory Lifecycle Workflow

Status:
- Implemented and code-backed, with partial side systems

Core lifecycle:
1. Vehicle is created manually, via appraisal conversion, or via acquisition flow.
2. Optional VIN decode enriches the vehicle.
3. Photos, costs, recon, and floorplan data are added.
4. Pricing rules and valuations can be previewed/applied.
5. Vehicle appears in inventory lists, dashboard, aging, and alert surfaces.
6. Vehicle can be published/unpublished into internal listing state.
7. Vehicle may be linked to a deal and later move to `SOLD`.

Supporting subflows:
- Cost documents can be uploaded and attached.
- Recon line items can be tracked to completion.
- Floorplan loans and curtailments can be managed.
- Vehicle listings can be generated for feed output.

Current partial areas:
- External marketplace push is not implemented.
- Auction sourcing is mock-backed.
- Bulk import runs through a real worker-backed path when Redis is configured and falls back to the same dealer-side execution path when Redis is absent.

## 6. CRM Lifecycle Workflow

Status:
- Implemented but partial

Core workflow:
1. Customer is created or imported.
2. Customer receives status, notes, tasks, callbacks, and activity.
3. Customer can be associated to CRM opportunity/pipeline stage.
4. Opportunities move across pipelines/stages.
5. Automation rules and jobs can generate operational work.
6. Sequence templates and instances can drive staged follow-up.
7. Inbox and journey-bar surfaces summarize current work.

Current implementation strengths:
- Strong CRUD coverage for pipelines, stages, opportunities, sequences, notes, tasks, callbacks.
- DB-backed automation/job telemetry is real.
- CRM execution is now queued through BullMQ and executed through a dealer internal CRM job endpoint, while `Job`, `AutomationRun`, and sequence state remain in Postgres.

Current limitations:
- CRM inbox is not a full omnichannel communications platform.
- Automation breadth is meaningful but not equivalent to a mature external marketing automation suite.

## 7. Messaging Workflow

Status:
- Implemented and code-backed

SMS flow:
1. Dealer user posts outbound SMS through `/api/messages/sms`.
2. Twilio service sends message.
3. Twilio inbound/status webhooks hit dealer webhook endpoints.
4. Dealer app records/updates messaging state through integrations services.

Email flow:
1. Dealer user posts outbound email through `/api/messages/email`.
2. SendGrid service sends email.
3. SendGrid inbound webhook hits dealer endpoint.
4. Dealer app processes inbound/response events.

Current limitation:
- Messaging is operationally integrated, but not modeled as a full standalone conversation product.

## 8. Deal Lifecycle Workflow

Status:
- Implemented and code-backed

Core lifecycle:
1. Deal is created from customer and optional vehicle.
2. Desk calculations, fees, trade values, and notes are added.
3. Deal transitions through `DRAFT`, `STRUCTURED`, `APPROVED`, `CONTRACTED`, or `CANCELED`.
4. Finance shell and finance products can be attached.
5. Credit/lender applications may be created and submitted.
6. Title and DMV checklist work progresses independently.
7. Delivery workflow can mark deal ready and completed.
8. Funding workflow tracks pending/approved/funded outcomes.

Important enforced rule:
- Once a deal is contracted, core financial mutation paths are locked by service logic.

## 9. Title, Delivery, and Funding Workflow

Status:
- Implemented and code-backed

Title flow:
1. Start title process.
2. Maintain title status and DMV checklist items.
3. Transition through title states such as pending, sent, received, completed, or issue hold.

Delivery flow:
1. Mark ready for delivery.
2. Complete delivery.

Funding flow:
1. Create/update funding record.
2. Maintain funding status.
3. Deal and finance status interact with funding decisions.

## 10. Compliance and Credit Workflow

Status:
- Implemented but partial

Flow:
1. Credit application is created.
2. Lender or finance application records are created.
3. Submissions and stipulations are tracked.
4. Compliance forms can be generated from deal/customer/vehicle data.
5. Compliance alerts surface operational gaps.

Current limitation:
- External lender rails are modeled, but live integrations are limited.

## 11. Platform Monitoring Workflow

Status:
- Implemented and code-backed

Flow:
1. Platform user requests monitoring views.
2. Platform app authenticates and checks platform role.
3. Platform app calls internal dealer monitoring endpoints or dealer `/api/health`.
4. Dealer responses are sanitized and mapped into platform monitoring views.
5. Platform stores monitoring events and alert state.
6. Slack/Resend notification paths can be triggered for failures/recoveries.

## 12. Marketplace Publication Workflow

Status:
- Implemented but partial

Current flow:
1. Dealer marks vehicle as published/unpublished.
2. Internal `VehicleListing` state is updated.
3. Feed endpoint can emit inventory feed output.

Not currently implemented:
- Live outbound syndication to external listing marketplaces.
- Provider-specific delivery confirmation or reconciliation.

## 13. Background Job Workflow

Status:
- Implemented and code-backed

Current reliable path:
1. Dealer CRM automation or operational task creates dealer DB job/run records.
2. Dealer job worker service processes tenant-scoped work and persists outcomes.

Redis/BullMQ path:
1. Dealer app enqueues analytics, VIN decode, bulk import, or alert jobs when `REDIS_URL` is set.
2. Worker app subscribes to BullMQ queues.
3. Worker authenticates into dealer internal job endpoints under `/api/internal/jobs/*`.
4. Dealer app executes tenant-aware business logic, persists outcomes, and records `DealerJobRun` telemetry.
5. Bulk import jobs update persisted progress and terminal state; analytics/alerts refresh caches and intelligence signals; VIN follow-up warms cache and attaches decode snapshots when needed.

Implication:
- Async architecture exists.
- The remaining uncertainty is deployment/ops rollout rather than placeholder queue handlers.

## 14. Support Session / Impersonation Workflow

Status:
- Implemented and code-backed

Flow:
1. Platform owner starts impersonation from platform app.
2. Platform app coordinates support-session state with dealer app.
3. Dealer app reads support-session cookie.
4. Dealer session is treated as a support session with active dealership context.
5. Support session can be explicitly ended.

Purpose:
- Operational troubleshooting without normal dealership membership.

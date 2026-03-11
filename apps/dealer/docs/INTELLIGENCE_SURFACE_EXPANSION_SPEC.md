# Intelligence Surface Expansion Spec

Version: v1  
Status: Authoritative for this sprint  
Scope: UI surface expansion only (no signal-engine rewrite)

## 0) Current State Snapshot

Already implemented:

- Signal backend and routes:
  - `apps/dealer/modules/intelligence/service/signal-engine.ts`
  - `apps/dealer/app/api/intelligence/signals/route.ts`
  - `apps/dealer/app/api/intelligence/jobs/run/route.ts`
- Dashboard adapters and signal widgets:
  - `apps/dealer/components/dashboard-v3/intelligence-signals.ts`
  - dashboard signal cards already consume `/api/intelligence/signals`
- Shared signal primitives:
  - `apps/dealer/components/ui-system/signals/SignalCard.tsx`
  - `apps/dealer/components/ui-system/signals/SignalList.tsx`
  - `apps/dealer/components/ui-system/signals/SignalSeverityBadge.tsx`
- Shared entity/queue/timeline primitives already present:
  - `apps/dealer/components/ui-system/entities/*`
  - `apps/dealer/components/ui-system/queues/*`
  - `apps/dealer/components/ui-system/timeline/*`

Notes from doc scan:

- `apps/dealer/docs/INTELLIGENCE_LAYER_ARCHITECTURE.md` is not present.
- `apps/dealer/docs/DASHBOARD_SIGNAL_MAP.md` is not present.
- This spec uses existing implemented behavior as source of truth.

## 1) Approved Surfaces

Signals expand into these UI surfaces only:

1. Entity headers (compact, high-signal)
2. Context rails (top unresolved awareness)
3. Queue summary blocks (operational snapshot)
4. Activity timelines (meaningful lifecycle entries only)

No new one-off signal visual systems are allowed outside `ui-system/signals`.

## 2) Surface Rules by Page/Domain

### Deal Detail (`/deals/[id]`)

- Header surface:
  - domains: `deals`, `operations`
  - entity match: `entityType = "Deal"` and `entityId = dealId` when present; otherwise domain-level fallback
- Context rail:
  - domains: `deals`, `operations`
  - unresolved first
- Timeline:
  - signal lifecycle events mapped to deal timeline when linked to the same deal entity

### Inventory Detail (`/inventory/vehicle/[id]`)

- Header surface:
  - domains: `inventory`, `acquisition` (acquisition only if tied to vehicle/appraisal context)
  - entity match: `entityType = "Vehicle"` and `entityId = vehicleId` when present; otherwise domain-level fallback
- Context rail:
  - domains: `inventory`, `acquisition`
- Timeline:
  - only vehicle-related signal lifecycle events

### Customer Detail (`/customers/profile/[id]`) (low-risk path)

- Header surface:
  - domain: `crm`
  - entity match: `entityType = "Customer"` and `entityId = customerId` when present; otherwise domain-level fallback
- Context rail:
  - domain: `crm`
- Timeline:
  - CRM signal lifecycle entries only

### Delivery Queue (`/deals/delivery`)

- Queue summary surface:
  - domains: `operations`, `deals`
  - focus on delivery/title/funding blockers that affect delivery throughput

### Funding Queue (`/deals/funding`)

- Queue summary surface:
  - domains: `deals`, `operations`
  - focus on pending funding and issue-hold blockers

### Title Queue (`/deals/title`)

- Queue summary surface:
  - domain: `operations`
  - focus on issue-hold/title-pending pressure

### CRM Jobs (`/crm/jobs`) (only if low-risk)

- Queue summary surface:
  - domain: `crm`
  - only include high-level queue pressure signals, no duplicate row-level noise

## 3) Max Visible Counts and Prioritization

Hard limits:

- Header: max 3
- Context rail: max 5
- Queue summary: max 4
- Timeline: only meaningful signal-created/signal-resolved events

Severity priority:

- `critical > warning > info`
- Implementation mapping for current enums: `danger => critical bucket`, `warning => warning`, `info|success => info`

Secondary sort:

- recency (`happenedAt` descending)

## 4) Sorting Logic

All adapters must sort by:

1. Severity bucket: critical, warning, info
2. Recency: `happenedAt` desc
3. Stable tie-break: `createdAt` desc then `id`

Resolved items:

- hidden by default on header/rail/queue surfaces
- timeline can show resolved lifecycle entries as historical events

## 5) Noise Control Rules

1. Adjacent dedupe:
   - If the same signal appears in header and immediate context rail, keep in header and suppress in rail unless rail includes additional unique items.
2. Domain dedupe:
   - Same `code + entityId` should render once per surface.
3. Timeline anti-spam:
   - Add entries only for create/resolve lifecycle transitions.
   - Ignore repeated unchanged refreshes.
4. Queue anti-noise:
   - Queue summary should not restate row data verbatim when summary adds no aggregation value.
5. Truncation:
   - Enforce max counts; optional lightweight "View all signals" link only when useful and low-risk.

## 6) File Plan (Exact Add/Change)

### Add

- `apps/dealer/components/ui-system/signals/SignalSummaryPanel.tsx`
- `apps/dealer/components/ui-system/signals/SignalContextBlock.tsx`
- `apps/dealer/components/ui-system/signals/SignalInlineList.tsx`
- `apps/dealer/components/ui-system/signals/SignalHeaderBadgeGroup.tsx`
- `apps/dealer/components/ui-system/signals/SignalQueueSummary.tsx`
- `apps/dealer/modules/intelligence/ui/surface-adapters.ts`
- `apps/dealer/modules/intelligence/ui/timeline-adapters.ts`

### Update

- `apps/dealer/components/ui-system/signals/index.ts`
- `apps/dealer/components/ui-system/index.ts`
- `apps/dealer/modules/inventory/ui/VehicleDetailPage.tsx`
- `apps/dealer/modules/inventory/ui/VehicleDetailContent.tsx`
- `apps/dealer/modules/customers/ui/DetailPage.tsx`
- `apps/dealer/modules/customers/ui/CustomerDetailContent.tsx`
- `apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx`
- `apps/dealer/modules/deals/ui/desk/DealHeader.tsx` (header-level integration only)
- `apps/dealer/modules/deals/ui/DeliveryQueuePage.tsx`
- `apps/dealer/modules/deals/ui/FundingQueuePage.tsx`
- `apps/dealer/modules/deals/ui/TitleQueuePage.tsx`
- `apps/dealer/modules/crm-pipeline-automation/ui/JobsPage.tsx` (only if straightforward)
- `apps/dealer/docs/UI_SYSTEM_USAGE.md`

### Optional low-risk API query extension (only if required by adapter constraints)

- `apps/dealer/app/api/intelligence/schemas.ts`
- `apps/dealer/app/api/intelligence/signals/route.ts`

Only for additive filters (`entityType`, `entityId`, `codes`, `limit`) without contract break.

## 7) Adapter Plan (Shared vs Module-specific)

Shared (module-owned intelligence adapters):

- `modules/intelligence/ui/surface-adapters.ts`
  - `fetchDomainSignals(domain, opts)`
  - `toHeaderSignals(signals, { max: 3 })`
  - `toContextSignals(signals, { max: 5, suppressKeys? })`
  - `toQueueSignals(signals, { max: 4 })`
  - severity and recency normalization
- `modules/intelligence/ui/timeline-adapters.ts`
  - `toTimelineSignalEvents(signals, entityKey)`
  - filters only create/resolved transitions

Module/page-level thin usage:

- Deal pages call shared adapters with deal-specific constraints.
- Vehicle pages call shared adapters with vehicle-specific constraints.
- Customer pages call shared adapters with customer-specific constraints.
- Queue pages call shared queue summary adapters and render via `SignalQueueSummary`.

Strict boundary:

- `ui-system/signals/*` remains presentational only.
- Business/domain filtering lives in adapters or module presenters.

## 8) Risks and Mitigations

### Header overcrowding

- Risk: action buttons and chips collide.
- Mitigation: max 3; compact list with truncation; hide long descriptions in header.

### Timeline spam

- Risk: frequent engine refresh generates noisy feed.
- Mitigation: only lifecycle create/resolved entries; dedupe same transition key.

### Queue duplication

- Risk: summary repeats table rows with no added value.
- Mitigation: queue summaries must be aggregated counts/alerts, max 4.

### Tenant/RBAC leakage

- Risk: broad signal query shown on wrong page.
- Mitigation: always fetch via existing tenant-scoped route; domain guards remain; adapters enforce entity match when available.

### Client-fetch regressions

- Risk: new mount-time fetches increase jitter.
- Mitigation: prefer existing page data flow and only add minimal client fetch islands where needed; no shared component fetching.

### Modal architecture regressions

- Risk: detail modal and full-page variants diverge.
- Mitigation: apply wrapper-level integration only; keep existing modal presenters and routes unchanged.

## 9) Slice Plan and Acceptance Criteria

## SLICE A — signal surface architecture spec

- Deliver this document with approved surfaces, rules, file plan, and risk controls.
- Acceptance:
  - clear boundaries (shared UI vs adapters vs module presenters)
  - explicit max counts and sorting/noise rules

## SLICE B — shared signal surface primitives

- Add 5 new shared components under `ui-system/signals`.
- Acceptance:
  - typed props, token-only styling, no data fetching
  - exported from `ui-system/signals/index.ts` and `ui-system/index.ts`

## SLICE C — entity header signal integration

- Integrate compact signal groups into deal/inventory/customer headers.
- Acceptance:
  - max 3
  - severity/recency sorted
  - no header breakage on small screens

## SLICE D — context rail signal blocks

- Add rail signal blocks to deal/inventory/customer detail rails.
- Acceptance:
  - max 5
  - dedupe against header where adjacent
  - loading/empty/error states consistent with ui-system

## SLICE E — queue signal summaries

- Integrate `SignalQueueSummary` into delivery/funding/title queues (+crm/jobs if low-risk).
- Acceptance:
  - max 4
  - no queue business logic changes
  - no duplicate/noisy row restatement

## SLICE F — timeline intelligence events

- Add signal lifecycle timeline entries for deal/customer/vehicle where clean.
- Acceptance:
  - only create/resolved lifecycle entries
  - no repeated unchanged noise
  - visual parity with `ActivityTimeline`/`TimelineItem`

## SLICE G — data adapters and fetch integration

- Implement thin shared adapters and module usage.
- Acceptance:
  - adapter-first
  - shared components remain dumb
  - tenant and domain constraints preserved

## SLICE H — UX noise control and prioritization

- Enforce limits, sorting, dedupe and optional view-all behavior.
- Acceptance:
  - hard max counts respected
  - severity-first ordering visible and consistent
  - adjacent duplication reduced

## SLICE I — tests and hardening

- Add targeted tests for new signal surface components/adapters and key integrations.
- Acceptance:
  - focused tests on signal presentation contracts
  - no unrelated broad rewrites
  - known unrelated failures documented separately


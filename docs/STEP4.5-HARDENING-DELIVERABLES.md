# Step 4.5 — Hardening & Final Security Checks — Deliverables

## 1) Files modified

### Dealer — status enforcement (guards added)
- `modules/crm-pipeline-automation/service/automation-rule.ts` — requireTenantActiveForRead/Write on list, get, create, update, delete.
- `modules/crm-pipeline-automation/service/opportunity.ts` — requireTenantActiveForRead/Write on list, get, createOpportunity, updateOpportunity, listActivity.
- `modules/crm-pipeline-automation/service/pipeline.ts` — requireTenantActiveForRead/Write on list, get, create, update, delete.
- `modules/crm-pipeline-automation/service/stage.ts` — requireTenantActiveForRead/Write on listStages, getStage, create, update, deleteStage, deleteStageWithReassign.
- `modules/crm-pipeline-automation/service/sequence.ts` — requireTenantActiveForRead/Write on all public entry points (list/get/create/update/delete templates, steps, instances, startSequence, updateStatus, skipStep).
- `modules/crm-pipeline-automation/service/stage-transition.ts` — requireTenantActiveForWrite on transitionStage.
- `modules/crm-pipeline-automation/service/journey-bar.ts` — requireTenantActiveForRead on getJourneyBarData.
- `modules/crm-pipeline-automation/service/automation-engine.ts` — requireTenantActiveForWrite on processAutomationTrigger.

### Platform — lifecycle and audit
- `apps/platform/app/api/platform/dealerships/[id]/status/route.ts` — Documented Option B (all-or-nothing); platform status updated only after dealer succeeds; 502 and audit on dealer failure.

### Internal rate limit
- `lib/internal-rate-limit.ts` — Rate limit key now includes pathname + IP (not user-controlled). Comment: active in production; do not set DISABLE_INTERNAL_RATE_LIMIT in production.

### Golden path test
- `apps/platform/app/api/platform/dealerships/[id]/lifecycle-golden-path.test.ts` — New: provision success audit, status ACTIVE/SUSPENDED/CLOSED audit, 502 on dealer failure with safe message and audit.

---

## 2) Issues found and fixed

| Issue | Fix |
|-------|-----|
| **CRM pipeline services had no tenant lifecycle guards** | Added requireTenantActiveForRead or requireTenantActiveForWrite to automation-rule, opportunity, pipeline, stage, sequence, stage-transition, journey-bar, and processAutomationTrigger in automation-engine. All reads and writes now go through the centralized guard. |
| **Internal rate limit key was IP-only** | Key changed to `pathname:ip` so each route has its own bucket and key is not user-controlled (pathname from request.url). |
| **Platform status behavior not documented** | Documented Option B in status route: platform updates only after dealer call succeeds; on dealer failure we audit (with dealerCallFailed, no PII) and return 502 with safe message. |
| **No single golden-path test for lifecycle** | Added lifecycle-golden-path.test.ts: provision audit, status ACTIVE/SUSPENDED/CLOSED audit, 502 + audit on dealer failure. |

---

## 3) Confirmation checklist

| Requirement | Status |
|-------------|--------|
| **No lifecycle leaks** | All dealer service entry points (customers, deals, inventory, documents, CRM pipeline, tasks/notes/activity, sequences, automation rule/opportunity/pipeline/stage, stage-transition, journey-bar, automation-engine, job worker) call requireTenantActiveForRead or requireTenantActiveForWrite as appropriate. CLOSED blocks read and write; SUSPENDED blocks write only. getActiveDealershipId clears cookie and returns null for CLOSED. |
| **No audit gaps** | Application approve/reject, dealership provision, dealership status: all platform mutation endpoints write platform audit with actorPlatformUserId, action, targetType, targetId, beforeState, afterState; reason where required (reject, suspend, close); requestId/idempotencyKey where applicable. Table remains append-only (create only). |
| **No rate limit bypass** | Rate limit is active in production. Disabled only when NODE_ENV === "test" or DISABLE_INTERNAL_RATE_LIMIT === "true". Key is pathname + IP (not user-controlled). DISABLE_INTERNAL_RATE_LIMIT documented as must not be set in production. |
| **Consistent lifecycle transaction behavior** | Option B implemented and documented: platform status is updated only after dealer status call succeeds; on dealer failure we audit and return 502 without changing platform status. |

---

## 4) Commands to re-run tests

```bash
# Platform (RBAC + golden path)
cd apps/platform && npm run test

# Dealer tenant + job worker + CRM unit
npm run test -- --run lib/tenant-status.test.ts modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts modules/crm-pipeline-automation/tests/unit.test.ts

# Portal-split (JWT rejection)
npm run test:portal-split
```

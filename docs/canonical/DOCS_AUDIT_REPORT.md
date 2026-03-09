# Documentation Audit Report

This report records how legacy documentation compares to current code.

Scope audited:
- `docs/*`
- README files
- app/package/config docs
- module docs and runbooks

Policy used:
- Code is the source of truth.
- New canonical truth lives only in `docs/canonical/`.
- Legacy docs are retained for reference unless removal is necessary.

## 1. Canonical Outcome

New authoritative set:
- `docs/canonical/INDEX.md`
- `docs/canonical/ARCHITECTURE_CANONICAL.md`
- `docs/canonical/MODULE_REGISTRY_CANONICAL.md`
- `docs/canonical/FEATURE_MAP_CANONICAL.md`
- `docs/canonical/API_SURFACE_CANONICAL.md`
- `docs/canonical/WORKFLOWS_CANONICAL.md`
- `docs/canonical/DB_DOMAIN_MODEL_CANONICAL.md`
- `docs/canonical/DEVELOPER_GUIDE_CANONICAL.md`
- `docs/canonical/TESTING_QA_CANONICAL.md`
- `docs/canonical/INTEGRATIONS_CANONICAL.md`
- `docs/canonical/KNOWN_GAPS_AND_FUTURE_WORK.md`
- `docs/canonical/DOCS_AUDIT_REPORT.md`

## 2. Legacy Docs Kept as Reference but Superseded

These files contain useful historical context but are no longer canonical:
- `docs/APP-SUMMARY.md`
- `docs/ARCHITECTURE_MAP.md`
- `docs/SYSTEM_MASTER_MAP.md`
- `docs/MODULE_REGISTRY.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/LOCALHOST.md`
- `docs/MANUAL-SMOKE-TEST-CHECKLIST.md`
- `apps/platform/README.md`
- `apps/mobile/README.md`
- `apps/dealer/lib/api/README.md`
- `apps/platform/lib/api/README.md`

Classification:
- Mostly `partially outdated`
- Still useful as supporting reference
- Merged into canonical docs where code-backed

## 3. Legacy Doc Families and Trust Classification

### A. Root architecture/security/setup docs

Files:
- `docs/APP-SUMMARY.md`
- `docs/ARCHITECTURE_MAP.md`
- `docs/SYSTEM_MASTER_MAP.md`
- `docs/MODULE_REGISTRY.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/LOCALHOST.md`

Classification:
- `partially outdated`

Why:
- They still describe real major app boundaries and security intent.
- They drift on testing, background jobs, and some feature completeness claims.

### B. Design specs under `docs/design/*`

Classification:
- `still useful but needs merge`

Why:
- They often describe domain intent and module boundaries.
- They are not reliable as current implementation status.

### C. Module docs under `docs/modules/*`

Classification:
- `still useful but needs merge`

Why:
- Helpful for historical module intent.
- Superseded by current route/service/test reality.

### D. Runbooks under `docs/runbooks/*`

Classification:
- mixed `partially outdated` and `archival only`

Why:
- Some env/deploy/platform-auth guidance is still directionally useful.
- Many step-oriented sprint runbooks describe prior intermediate states rather than current truth.

### E. Specs under `docs/specs/*`

Classification:
- `archival only`

Why:
- These are planning documents, not implementation truth.

### F. Reports, final reports, perf notes, security reports

Examples:
- `docs/*FINAL_REPORT*`
- `docs/*SPEC.md` paired with reports
- `docs/STEP*_REPORT.md`
- `docs/*AUDIT*`
- `docs/*PERF_NOTES*`

Classification:
- `archival only`

Why:
- They describe previous sprints, checkpoints, or audits.
- They are not current source-of-truth documentation.

### G. UI design docs under `docs/ui-design/*`

Classification:
- `duplicate` or `archival only`

Why:
- They describe intended layouts and design systems.
- Current UI implementation has evolved and must be read from code.

### H. Dealercenter reference assets

Classification:
- `archival only`

Why:
- Reference inspiration material, not product truth.

## 4. Major Doc-vs-Code Mismatches Found

1. `docs/LOCALHOST.md` still documents Vitest commands and behaviors.
   - Current repo uses Jest in dealer/platform/mobile/contracts.

2. At audit time, `.cursorrules` still described older queue guidance that conflicted with the BullMQ implementation.
   - This was later corrected; current implementation uses BullMQ and `ioredis` in active code.

3. Legacy docs often describe broader marketplace integrations than current source supports.
   - Current code supports internal listing state and feed generation, not confirmed external syndication.

4. Legacy docs imply mature billing integration.
   - Current platform billing is display/internal-subscription oriented and lacks Stripe/webhooks.

5. Some older platform-admin docs describe a single platform-admin model.
   - Current repo has both dealer-side `PlatformAdmin` and platform-app `PlatformUser` role systems.

6. Legacy docs understate the amount of platform-to-dealer signed internal API traffic.
   - Current provisioning, invite, monitoring, and status sync flows rely on it.

7. Old docs under-emphasize the dealer DB-backed CRM job system.
   - Current code has meaningful job and run models in dealer schema.

8. Permission documentation drift exists around dashboard access.
   - Current dashboard routes explicitly use `dashboard.read`, while some legacy docs focus on `customers.read`/`crm.read`.

9. Worker-related docs and rules lagged behind code maturity.
   - This was later corrected; the worker app now has real completed handlers and the remaining gap is rollout/ops confidence.

10. GitHub Actions deploy workflow runtime differed from repo engine guidance at audit time.
   - This was later corrected; the workflow now uses Node `24`, matching the repo root requirement.

## 5. Docs Merged into Canonical Set

Primary content merged and reconciled into `docs/canonical/*`:
- Architecture summaries
- Module registry material
- Security model
- Deployment/local setup
- Manual QA expectations
- Platform/mobile README operational guidance
- API helper/logging notes

## 6. Docs Treated as Historical Only

These categories should not be used as truth for planning new work:
- sprint specs
- sprint final reports
- intermediate audit reports
- performance note bundles
- UI blueprint and reconstruction docs
- step-by-step deliverable reports

## 7. Old Docs Not Modified by This Sprint

Current handling choice:
- Legacy docs were not overwritten in this sprint.
- Supersession is recorded here rather than scattering edits across many files.

Reason:
- Preserves historical traceability.
- Keeps canonical truth centralized in `docs/canonical/`.

## 8. Residual Ambiguities

Ambiguities that code alone did not fully resolve:
- Whether the standalone worker is actively deployed in production everywhere
- Whether there are private/out-of-repo connectors for lenders or marketplaces
- Whether platform billing is intentionally scaffold-only or temporarily incomplete

These ambiguities are listed again in `KNOWN_GAPS_AND_FUTURE_WORK.md`.

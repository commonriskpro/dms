# Canonical Documentation Index

This directory is the canonical documentation set for the repository as implemented on March 9, 2026.

Source of truth rule:
- Code wins over legacy documentation.
- Files outside `docs/canonical/` are reference material only unless explicitly stated otherwise here.

Status labels used across this set:
- `Implemented`: code-backed and materially complete.
- `Partial`: code-backed but incomplete, limited, or unevenly surfaced.
- `Scaffolded`: structural code exists but business behavior is mostly stubbed.
- `Planned`: referenced in docs/UI language but not implemented in current code.
- `Deprecated`: retained only for historical reference.

Recommended reading order:
1. [ARCHITECTURE_CANONICAL.md](./ARCHITECTURE_CANONICAL.md)
2. [ARCHITECTURE_DECISIONS_CANONICAL.md](./ARCHITECTURE_DECISIONS_CANONICAL.md)
3. [PLATFORM_SURFACE_MIGRATION_PLAN.md](./PLATFORM_SURFACE_MIGRATION_PLAN.md)
4. [ASYNC_CONVERGENCE_PLAN.md](./ASYNC_CONVERGENCE_PLAN.md)
5. [FEATURE_MAP_CANONICAL.md](./FEATURE_MAP_CANONICAL.md)
6. [MODULE_REGISTRY_CANONICAL.md](./MODULE_REGISTRY_CANONICAL.md)
7. [DB_DOMAIN_MODEL_CANONICAL.md](./DB_DOMAIN_MODEL_CANONICAL.md)
8. [API_SURFACE_CANONICAL.md](./API_SURFACE_CANONICAL.md)
9. [WORKFLOWS_CANONICAL.md](./WORKFLOWS_CANONICAL.md)
10. [INTEGRATIONS_CANONICAL.md](./INTEGRATIONS_CANONICAL.md)
11. [DEVELOPER_GUIDE_CANONICAL.md](./DEVELOPER_GUIDE_CANONICAL.md)
12. [TESTING_QA_CANONICAL.md](./TESTING_QA_CANONICAL.md)
13. [RBAC_AUDIT_REPORT.md](./RBAC_AUDIT_REPORT.md)
14. [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md)
15. [RBAC_REMEDIATION_REPORT.md](./RBAC_REMEDIATION_REPORT.md)
16. [RBAC_NORMALIZATION_REPORT.md](./RBAC_NORMALIZATION_REPORT.md)
17. [POST_NORMALIZATION_ROLE_AUDIT.md](./POST_NORMALIZATION_ROLE_AUDIT.md)
18. [CUSTOM_ROLE_MIGRATION_REVIEW.md](./CUSTOM_ROLE_MIGRATION_REVIEW.md)
19. [CUSTOM_ROLE_MIGRATION_MATRIX.md](./CUSTOM_ROLE_MIGRATION_MATRIX.md)
20. [RBAC_LIVE_ROLLOUT_RUNBOOK.md](./RBAC_LIVE_ROLLOUT_RUNBOOK.md)
21. [RBAC_LIVE_SQL_CHECKLIST.md](./RBAC_LIVE_SQL_CHECKLIST.md)
22. [PERMISSION_VOCABULARY_AUDIT.md](./PERMISSION_VOCABULARY_AUDIT.md)
23. [PERMISSION_DEPRECATION_PLAN.md](./PERMISSION_DEPRECATION_PLAN.md)
24. [PERMISSION_DEPRECATION_MATRIX.md](./PERMISSION_DEPRECATION_MATRIX.md)
25. [PROJECT_STATUS_CANONICAL.md](./PROJECT_STATUS_CANONICAL.md)
26. [PROJECT_CHECKLIST_CANONICAL.md](./PROJECT_CHECKLIST_CANONICAL.md)
27. [PROJECT_PERCENTAGE_RECONCILIATION.md](./PROJECT_PERCENTAGE_RECONCILIATION.md)
28. [PROJECT_STATUS_WORKER_DELTA.md](./PROJECT_STATUS_WORKER_DELTA.md)
29. [WORKER_COMPLETION_REPORT.md](./WORKER_COMPLETION_REPORT.md)
30. [KNOWN_GAPS_AND_FUTURE_WORK.md](./KNOWN_GAPS_AND_FUTURE_WORK.md)
31. [DOCS_AUDIT_REPORT.md](./DOCS_AUDIT_REPORT.md)
32. [ADOPTION_NOTES.md](./ADOPTION_NOTES.md)
33. [LEGACY_SYSTEMS_AUDIT.md](./LEGACY_SYSTEMS_AUDIT.md)
34. [LEGACY_MIGRATION_PLAN.md](./LEGACY_MIGRATION_PLAN.md)
35. [LEGACY_SYSTEMS_MATRIX.md](./LEGACY_SYSTEMS_MATRIX.md)

Quick links by topic:
- System architecture: [ARCHITECTURE_CANONICAL.md](./ARCHITECTURE_CANONICAL.md)
- Fixed architecture decisions: [ARCHITECTURE_DECISIONS_CANONICAL.md](./ARCHITECTURE_DECISIONS_CANONICAL.md)
- Platform-surface migration: [PLATFORM_SURFACE_MIGRATION_PLAN.md](./PLATFORM_SURFACE_MIGRATION_PLAN.md)
- Async convergence: [ASYNC_CONVERGENCE_PLAN.md](./ASYNC_CONVERGENCE_PLAN.md)
- Module boundaries: [MODULE_REGISTRY_CANONICAL.md](./MODULE_REGISTRY_CANONICAL.md)
- Feature status: [FEATURE_MAP_CANONICAL.md](./FEATURE_MAP_CANONICAL.md)
- API routes: [API_SURFACE_CANONICAL.md](./API_SURFACE_CANONICAL.md)
- Data model: [DB_DOMAIN_MODEL_CANONICAL.md](./DB_DOMAIN_MODEL_CANONICAL.md)
- Business workflows: [WORKFLOWS_CANONICAL.md](./WORKFLOWS_CANONICAL.md)
- External systems: [INTEGRATIONS_CANONICAL.md](./INTEGRATIONS_CANONICAL.md)
- Local development: [DEVELOPER_GUIDE_CANONICAL.md](./DEVELOPER_GUIDE_CANONICAL.md)
- Tests and QA: [TESTING_QA_CANONICAL.md](./TESTING_QA_CANONICAL.md)
- RBAC audit: [RBAC_AUDIT_REPORT.md](./RBAC_AUDIT_REPORT.md)
- RBAC matrix: [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md)
- RBAC remediation: [RBAC_REMEDIATION_REPORT.md](./RBAC_REMEDIATION_REPORT.md)
- RBAC normalization: [RBAC_NORMALIZATION_REPORT.md](./RBAC_NORMALIZATION_REPORT.md)
- Post-normalization role audit: [POST_NORMALIZATION_ROLE_AUDIT.md](./POST_NORMALIZATION_ROLE_AUDIT.md)
- Custom-role migration review: [CUSTOM_ROLE_MIGRATION_REVIEW.md](./CUSTOM_ROLE_MIGRATION_REVIEW.md)
- Custom-role migration matrix: [CUSTOM_ROLE_MIGRATION_MATRIX.md](./CUSTOM_ROLE_MIGRATION_MATRIX.md)
- RBAC live rollout runbook: [RBAC_LIVE_ROLLOUT_RUNBOOK.md](./RBAC_LIVE_ROLLOUT_RUNBOOK.md)
- RBAC live SQL checklist: [RBAC_LIVE_SQL_CHECKLIST.md](./RBAC_LIVE_SQL_CHECKLIST.md)
- Permission vocabulary audit: [PERMISSION_VOCABULARY_AUDIT.md](./PERMISSION_VOCABULARY_AUDIT.md)
- Permission deprecation plan: [PERMISSION_DEPRECATION_PLAN.md](./PERMISSION_DEPRECATION_PLAN.md)
- Permission deprecation matrix: [PERMISSION_DEPRECATION_MATRIX.md](./PERMISSION_DEPRECATION_MATRIX.md)
- Project status: [PROJECT_STATUS_CANONICAL.md](./PROJECT_STATUS_CANONICAL.md)
- Project checklist: [PROJECT_CHECKLIST_CANONICAL.md](./PROJECT_CHECKLIST_CANONICAL.md)
- Project percentage reconciliation: [PROJECT_PERCENTAGE_RECONCILIATION.md](./PROJECT_PERCENTAGE_RECONCILIATION.md)
- Worker status delta: [PROJECT_STATUS_WORKER_DELTA.md](./PROJECT_STATUS_WORKER_DELTA.md)
- Worker completion report: [WORKER_COMPLETION_REPORT.md](./WORKER_COMPLETION_REPORT.md)
- Known gaps and deferred work: [KNOWN_GAPS_AND_FUTURE_WORK.md](./KNOWN_GAPS_AND_FUTURE_WORK.md)
- Legacy-doc trust audit: [DOCS_AUDIT_REPORT.md](./DOCS_AUDIT_REPORT.md)
- Canonical adoption and cleanup notes: [ADOPTION_NOTES.md](./ADOPTION_NOTES.md)
- Legacy systems audit: [LEGACY_SYSTEMS_AUDIT.md](./LEGACY_SYSTEMS_AUDIT.md)
- Legacy migration plan: [LEGACY_MIGRATION_PLAN.md](./LEGACY_MIGRATION_PLAN.md)
- Legacy systems matrix: [LEGACY_SYSTEMS_MATRIX.md](./LEGACY_SYSTEMS_MATRIX.md)

Repository summary:
- Monorepo with four apps: dealer web, platform web, mobile client, worker process.
- Shared package: `packages/contracts`.
- Primary business system lives in `apps/dealer`.
- Current architecture is a dealer modular monolith plus a separate canonical platform control-plane app in `apps/platform`.
- Multi-tenancy and RBAC are enforced in code, not only documented.
- `main` is the deployment-sensitive branch and `.cursorrules` is the canonical rule source.
- Canonical async direction is BullMQ for execution plus Postgres for durable workflow state.
- Dealer DB-backed CRM job execution still exists, but it is a legacy execution path rather than the target pattern for new async work.

Canonical scope:
- Everything in this folder is based on direct inspection of current code under `apps/*`, `packages/*`, `scripts/*`, Prisma schemas, route trees, tests, and config files.

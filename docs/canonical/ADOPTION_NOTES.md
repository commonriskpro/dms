# Adoption Notes

This file records the first post-canonization cleanup pass.

## 1. Old Docs Now Pointing to Canonical Docs

Entry-point legacy docs updated with superseded headers:
- `/Users/saturno/Downloads/dms/README.md`
- `/Users/saturno/Downloads/dms/docs/ARCHITECTURE_MAP.md`
- `/Users/saturno/Downloads/dms/docs/MODULE_REGISTRY.md`
- `/Users/saturno/Downloads/dms/docs/APP-SUMMARY.md`
- `/Users/saturno/Downloads/dms/docs/LOCALHOST.md`
- `/Users/saturno/Downloads/dms/docs/DEPLOYMENT.md`
- `/Users/saturno/Downloads/dms/apps/platform/README.md`
- `/Users/saturno/Downloads/dms/apps/mobile/README.md`

Canonical entrypoint:
- `/Users/saturno/Downloads/dms/docs/canonical/INDEX.md`

## 2. Mismatches Fixed in This Pass

Low-risk drift corrected:
- Added a root `README.md` pointer to the canonical docs set because the repo had no root README entrypoint.
- Updated `.cursorrules` so new work points at `docs/canonical/INDEX.md` instead of legacy architecture/module docs.
- Updated `.cursorrules` background-job guidance to match the repo's actual BullMQ/Redis implementation instead of the older `pg-boss` guidance.
- Updated `.github/workflows/deploy.yml` from Node `20` to Node `24` to match the repo's declared engine requirement.
- Corrected `docs/LOCALHOST.md` test command references from Vitest to the current Jest-based commands.
- Corrected `docs/LOCALHOST.md` quickstart dev command from `npm run dev` to `npm run dev:dealer`.
- Corrected `docs/DEPLOYMENT.md` test-env wording so it no longer claims Vitest is the active runner.
- Updated app-level README links so they point to the canonical docs index.

## 3. Permission Drift Follow-Up

Remediated after the initial audit:
- `dashboard.read` is now seeded and used consistently across dashboard page, nav, and dashboard APIs.
- Dealer audit permission naming is now canonicalized on `admin.audit.read`; the legacy dealer `audit.read` alias was removed from the seed catalog.
- Reports navigation visibility now matches the Reports page access model and requires `reports.read`.

Still intentionally not changed:
- The dealer seed file still contains a large legacy permission catalog with several keys that appear unused by current route handlers.
- Legacy permission docs and old specs outside `docs/canonical/` still describe older permission boundaries in places.

Recommended follow-up:
1. Compare seeded permission keys in `apps/dealer/prisma/seed.ts` against route-handler usage.
2. Remove or deprecate unused permission families only after validating existing tenants and role assignments.
3. Decide whether command-palette navigation should become permission-aware as a broader UI-hardening task.

## 4. Ambiguities Still Requiring Human Confirmation

These remain unresolved by code inspection alone:
- Whether the standalone BullMQ worker is deployed in every production environment.
- Whether real lender, auction, or marketplace connectors exist outside this repository.
- Whether platform billing is intentionally display-only or awaiting provider integration.

## 5. Canonical Policy Reminder

The canonical documentation set remains:
- `/Users/saturno/Downloads/dms/docs/canonical/*`

Legacy docs outside that directory now serve only as:
- historical reference
- migration pointers
- local notes

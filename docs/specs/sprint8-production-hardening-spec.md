# SPRINT 8 — Production Hardening — SPEC

No new features. Focus on reliability, safety, and performance.

## Tasks

1. **Review DB indexes for large datasets** — Confirm all list/filter patterns have indexes (dealershipId, compound with status/createdAt); document in DEPLOYMENT.
2. **Add slow query detection logging** — Log when Prisma query exceeds threshold (e.g. 2000 ms); no PII in log.
3. **Verify pagination on all list endpoints** — Every list API must use limit/offset (or cursor) with a bounded max; document list and verify.
4. **Add export audit verification** — Confirm report exports (inventory, sales) write audit log entry; document.
5. **Add basic access logs view** — Admin audit page exists at `/admin/audit`; ensure it is discoverable (sidebar/layout) and documented as "Access / Audit logs".
6. **Update DEPLOYMENT.md** — Add: DB indexes summary, slow query logging, pagination verification table, export audit verification, prisma migrate deploy safety recap, Vercel env validation.
7. **Verify prisma migrate deploy safety** — Document that only `migrate deploy` is used in production; no `migrate dev` or `db push`.
8. **Confirm Vercel env validation** — Add runtime or build-time validation of required env vars so missing vars fail fast with a clear message.

## Out of scope

- New product features.
- Changing RBAC or tenant model.
- Adding new list endpoints.

## Deliverables

- [ ] DB indexes documented (DEPLOYMENT or schema comment).
- [ ] Slow query logging in `lib/db.ts` (threshold configurable via env).
- [ ] Pagination verification list (all list endpoints with limit/offset).
- [ ] Export audit: both export routes call `auditLog` with `report.exported`; documented.
- [ ] Access logs: `/admin/audit` linked in admin nav; documented as access/audit log view.
- [ ] DEPLOYMENT.md updated with all sections above.
- [ ] Prisma migrate safety subsection in DEPLOYMENT.
- [ ] Env validation (e.g. `lib/env.ts`) used at app startup or in health check; DOC in DEPLOYMENT.

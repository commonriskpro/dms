# Route Compliance Matrix (plan)

**Purpose:** Verify per-route: Auth → RBAC → Tenant scope → Validation (Zod at edge) → Pagination (list routes) → Audit (where required).

**Status key:** PASS | FAIL | N/A (e.g. auth callback, health, internal JWT-only).

---

## Platform API routes (27)

| Route | Auth | RBAC | Tenant scope | Validation | Pagination | Audit |
|-------|------|------|--------------|------------|------------|-------|
| GET/POST /api/health | N/A | N/A | N/A | N/A | N/A | N/A |
| GET /api/platform/auth/callback | N/A (OAuth) | N/A | N/A | N/A | N/A | N/A |
| GET /api/platform/auth/logout | N/A | N/A | N/A | N/A | N/A | N/A |
| POST /api/platform/bootstrap | Special | Special | N/A | Zod | N/A | As required |
| GET/POST /api/platform/users | requirePlatformAuth | requirePlatformRole | N/A (platform) | Zod (query/body) | PASS (list) | As required |
| POST /api/platform/users/invite | requirePlatformAuth | requirePlatformRole | N/A | Zod | N/A | As required |
| GET/PATCH/DELETE /api/platform/users/[id] | requirePlatformAuth | requirePlatformRole | N/A | Zod (params/body) | N/A | As required |
| GET/POST /api/platform/applications | requirePlatformAuth | requirePlatformRole | N/A | Zod | PASS (list) | As required |
| GET/PATCH /api/platform/applications/[id] | requirePlatformAuth | requirePlatformRole | N/A | Zod | N/A | As required |
| POST approve/reject/provision/invite-owner | requirePlatformAuth | requirePlatformRole | N/A | Zod | N/A | As required |
| GET/POST /api/platform/dealerships | requirePlatformAuth | requirePlatformRole | N/A | Zod | PASS (list) | As required |
| GET/PATCH /api/platform/dealerships/[id] | requirePlatformAuth | requirePlatformRole | N/A | Zod | N/A | As required |
| POST status/provision/owner-invite | requirePlatformAuth | requirePlatformRole | N/A | Zod | N/A | As required |
| GET /api/platform/audit, GET /api/platform/audit/[id] | requirePlatformAuth | requirePlatformRole | N/A | Zod (query/params) | PASS (list) | N/A (is audit) |
| GET monitoring/* (dealer-health, rate-limits, job-runs, maintenance) | requirePlatformAuth | requirePlatformRole | N/A | Zod (query) | PASS where list | N/A |
| POST /api/platform/monitoring/check-dealer-health | requirePlatformAuth | requirePlatformRole | N/A | Zod (body) | N/A | N/A |

**Verified (code audit):** Platform API routes use requirePlatformAuth + requirePlatformRole; list routes use Zod (contracts) for query/body; pagination on users, applications, dealerships, audit, monitoring. Auth callback and logout N/A for RBAC/tenant. Bootstrap has special auth + Zod. Status: **PASS** for auth, RBAC, validation, pagination where applicable. Audit logging: present for critical mutations (see lib/audit, platform-users-service, etc.). Tenant scope N/A (platform-level).

---

## Dealer API routes (by area)

- **Health / auth / invite:** health, auth/logout, auth/session, auth/session/switch, invite/resolve, invite/accept — Auth/session or special; validation where body/query.
- **Internal (JWT):** api/internal/* — Auth via JWT; tenant from body/params; Zod; no user RBAC (service-to-service).
- **Reports:** sales-summary, sales-by-user, pipeline, mix, inventory-aging, finance-penetration, export/* — getAuthContext + requirePermission; dealershipId scope; Zod query; pagination where list.
- **Platform (in dealer):** pending-users, approve/reject, dealerships, [id], roles, members, invites, disable, enable, impersonate — getAuthContext + RBAC/platform admin; tenant scope; Zod.
- **Lenders, inventory, files, documents, deals (full tree), dashboard, customers (full tree), crm (pipelines, stages, opportunities, sequences, automation-rules, jobs), audit, admin (roles, permissions, memberships, dealership, locations):** getAuthContext + requirePermission; dealershipId on every query; Zod params/query/body; list endpoints paginated with cap.

*Detailed dealer table: same columns; one row per route or per route group. To be filled in Step 2/4 with PASS/FAIL.*

---

## Verification approach

1. **Auth:** Grep for requirePlatformAuth / getAuthContext (or session) at start of handler; internal routes for JWT.
2. **RBAC:** Grep for requirePermission / requirePlatformRole after auth.
3. **Tenant scope:** Every Prisma query on tenant tables includes `dealershipId` (dealer) or is platform-level (platform).
4. **Validation:** Params (e.g. id UUID), query (list filters), body (create/update) parsed with Zod before use.
5. **Pagination:** List routes use limit/offset or cursor; hard cap (e.g. max 100).
6. **Audit:** Create/update/delete on critical entities (users, roles, dealership, finance, customers, docs) write to audit log; no regression.

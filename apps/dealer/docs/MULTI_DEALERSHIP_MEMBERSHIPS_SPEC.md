# Multi-Dealership Memberships + Active Dealership Switching — Spec

## 1. Current-state assessment

### 1.1 Data model (existing)

- **Profile**: User identity (id, email, fullName, avatarUrl). id is the stable user id (Supabase auth id or linked profile id).
- **Membership**: Per-user, per-dealership membership with role. Fields: id, dealershipId, userId, roleId, disabledAt, invitedBy, joinedAt, inviteId, etc. A user can have multiple rows (one per dealership). `disabledAt` null = active membership.
- **Role**: Per-dealership (dealershipId, key, name, isSystem). Permissions come from RolePermission; UserRole links user to roles within a dealership; membership.roleId is the primary role for that dealership.
- **RBAC**: `loadUserPermissions(userId, dealershipId)` resolves permissions from membership role + UserRole + UserPermissionOverride. All protected dealer APIs use `getAuthContext(request)` which yields `dealershipId` and `permissions`.

### 1.2 Active dealership resolution (current)

- **Web (cookie)**: Encrypted cookie `dms_active_dealership` stores dealership id. `getActiveDealershipId(userId, isPlatformAdmin, request)` reads cookie, validates membership (and dealership lifecycle), returns dealership id or null. Platform admin can impersonate any non-CLOSED dealership without membership.
- **Mobile (Bearer)**: When `Authorization: Bearer` is present and cookie is absent, `getActiveDealershipId` returns `getFirstActiveDealershipIdForUser(userId)` — i.e. first membership by `createdAt`. There is no way for the mobile app to change “active” dealership; it always gets the first.
- **Session switch**: `PATCH /api/auth/session/switch` with body `{ dealershipId }` validates membership, calls `setActiveDealershipCookie(dealershipId)`, returns user + activeDealership + permissions. This route uses `requireUser()` (cookie-only), so it does **not** work for Bearer/mobile.

### 1.3 Gaps

- No server-side persistence of “active dealership” for a user. Cookie is web-only; Bearer clients cannot switch.
- No API under `/api/me` that returns list of dealerships (memberships) or current dealership for use by mobile.
- No explicit “set current dealership” API that works with Bearer and persists so subsequent requests use the new dealership.

---

## 2. Goals / non-goals

**Goals:**

- One user can have many dealership memberships; one “active” dealership at a time for API context.
- Mobile (and any Bearer client) can list memberships and set/read active dealership via a minimal, type-safe API.
- Web behavior unchanged: cookie still drives active dealership when present; switch mutation updates both cookie and server-side store so state is consistent.
- Strict tenant isolation: all data access uses the resolved active dealership from server-side logic; no trust of client-passed dealership id for authorization.
- Backward compatibility: single-dealership users see no change in behavior.
- Auditability: dealership switch events are logged.

**Non-goals:**

- Changing RBAC or permission model per dealership (already per-membership).
- Full UI for dealership switcher in dealer web app (get-started and session/switch already exist; optional minimal readout in settings only if useful).
- Mobile UI implementation in this task (backend + minimal integration surface only).

---

## 3. Data model changes

### 3.1 New table: UserActiveDealership

- **Purpose**: Persist the user’s current active dealership so that Bearer (mobile) and any client without cookie can resolve active context after a switch.
- **Columns**:
  - `userId` (UUID, PK, FK to Profile.id)
  - `activeDealershipId` (UUID, FK to Dealership.id)
  - `updatedAt` (DateTime)
- **Uniqueness**: One row per user (PK = userId).
- **On switch**: Upsert by userId; set activeDealershipId and updatedAt. Validate membership before write.
- **Resolution**: When cookie is absent (e.g. Bearer), read this row; if present and membership valid and dealership not CLOSED/inactive, use it; else fall back to first active membership and optionally backfill this table so next time it’s consistent.

### 3.2 No change to Membership

- Membership already models “user belongs to dealership with role.” No new columns required.
- “Default” dealership: not stored. Implicit default = first active membership by createdAt when no row in UserActiveDealership.

---

## 4. Membership model (existing, clarified)

- **Profile**: Global user identity.
- **DealershipMembership** (existing `Membership`): userId, dealershipId, roleId, disabledAt, invitedBy, joinedAt, createdAt, updatedAt. Active when disabledAt is null.
- **Role**: Per dealership; permissions via RolePermission. Membership.roleId is the user’s role in that dealership.
- **Default dealership**: Not stored. Resolution order: cookie → UserActiveDealership → first membership.

---

## 5. Active dealership model

- **Stored in**: (1) Encrypted cookie `dms_active_dealership` (web), (2) table `UserActiveDealership` (server-side, used when cookie absent or for consistency after switch).
- **Resolution order** (in `getActiveDealershipId`):
  1. If request has Bearer and no cookie: read UserActiveDealership for userId. If row exists and membership (userId, activeDealershipId, disabledAt null) exists and dealership is active and not CLOSED → return activeDealershipId.
  2. Else if cookie present: decrypt, validate membership (and dealership), return or clear cookie and fall through.
  3. Else: first active membership by createdAt. Optionally upsert UserActiveDealership to this id so next Bearer request is stable.
  4. Platform admin: when cookie is set, can impersonate without membership; no change to that.
- **Setting active dealership**: Only via explicit mutation (POST /api/me/current-dealership or PATCH /api/auth/session/switch). Both validate membership; both update cookie (when applicable) and UserActiveDealership.

---

## 6. Session / auth resolution model

- **getAuthContext(request)** (unchanged): Calls `requireUserFromRequest(request)` then `requireDealershipContext(userId, request)`. So dealership comes from `getActiveDealershipId(userId, undefined, request)` which now incorporates UserActiveDealership for Bearer.
- **requireDealershipContext**: Throws FORBIDDEN if getActiveDealershipId returns null. No change to signature.
- **RBAC**: Still `loadUserPermissions(userId, dealershipId)` with the resolved dealershipId. No change.

---

## 7. API contract proposal

### 7.1 GET /api/me/dealerships

- **Auth**: Bearer or cookie (requireUserFromRequest). Does **not** require an active dealership.
- **Response**: List of dealerships the user is a member of, with membership metadata sufficient for switcher UI.
- **Shape** (example):
  - `data.dealerships`: Array of `{ dealershipId, dealershipName, roleKey, roleName, isActive }`. `isActive` = (current active dealership id === this dealership id).
- **Use**: Mobile (or web) can show “Switch dealership” list; current selection can be indicated with isActive.

### 7.2 GET /api/me/current-dealership

- **Auth**: Bearer or cookie. Does not require active dealership (so multi-dealership user with none selected can still call this).
- **Response**: Current active dealership and membership metadata, or null if none.
- **Shape**: `data: { dealershipId, dealershipName, roleKey, roleName } | null`. Optionally `availableCount: number` (count of memberships).

### 7.3 POST /api/me/current-dealership

- **Auth**: Bearer or cookie (requireUserFromRequest).
- **Body**: `{ dealershipId: string }` (UUID).
- **Validation**: User must have an active membership (disabledAt null) for that dealership; dealership must be active and not CLOSED.
- **Side effects**: Upsert UserActiveDealership; set cookie (so web stays in sync); emit audit event `auth.dealership_switched`.
- **Response**: New current dealership payload (same shape as GET current-dealership) plus permissions if desired.
- **Errors**: 400 invalid body; 403 not a member or dealership invalid.

---

## 8. Migration / backfill strategy

- **Migration**: Add table `UserActiveDealership` with userId (PK), activeDealershipId, updatedAt. FK to Profile and Dealership. No backfill of rows: “first membership” remains the implicit default until user (or web) explicitly switches. Optionally in a follow-up, backfill one row per user with multiple memberships setting activeDealershipId to the first membership’s dealershipId for consistency; not required for correctness.

---

## 9. Backward compatibility plan

- **Single-dealership users**: No row in UserActiveDealership. Resolution falls through to “first active membership” (unchanged). No change in behavior.
- **Web**: Cookie still set by session/switch; getActiveDealershipId still reads cookie first. We update session/switch to also upsert UserActiveDealership so that if the same user later uses mobile, they see the same active dealership.
- **Existing routes**: No change to getAuthContext or requireDealershipContext semantics; only the implementation of getActiveDealershipId gains the UserActiveDealership read path when cookie is absent.

---

## 10. RBAC implications

- Permissions remain per dealership. After switch, `loadUserPermissions(userId, dealershipId)` is called with the new dealershipId. No change to RBAC logic; only the source of dealershipId is extended (cookie + UserActiveDealership + first membership).

---

## 11. Tenant isolation rules

- All dealer data access continues to use `ctx.dealershipId` from getAuthContext. No route may use a client-supplied dealership id for authorization; switch mutation only accepts dealershipId to **set** context after validating membership.
- Cross-tenant: Impossible by construction because active dealership is always resolved server-side and validated against membership.

---

## 12. Audit / event model

- **Action**: `auth.dealership_switched`
- **Entity**: `UserActiveDealership` or virtual (no entity id required).
- **Metadata**: `{ previousDealershipId?: string, newDealershipId: string }`. previousDealershipId null when first time set.
- **dealershipId**: null (global auth event) or newDealershipId (per spec preference, we can use newDealershipId so it’s scoped).
- **actorId**: userId who switched.

---

## 13. Rollout plan

1. Deploy migration (add UserActiveDealership).
2. Deploy tenant + API changes: getActiveDealershipId reads/writes UserActiveDealership; POST /api/me/current-dealership; GET /api/me/current-dealership; GET /api/me/dealerships; session/switch also upserts UserActiveDealership; audit on switch.
3. No feature flag required; behavior is backward compatible.
4. Mobile (or other clients) can adopt new endpoints when ready.

---

## 14. Acceptance criteria

- Single-dealership user: no regression; active dealership remains their only one.
- Multi-dealership user (web): can switch via existing get-started or session/switch; cookie and UserActiveDealership both updated.
- Multi-dealership user (Bearer): GET /api/me/dealerships returns list; GET /api/me/current-dealership returns current (or null); POST /api/me/current-dealership with valid dealershipId sets active and returns new context; subsequent getAuthContext uses new dealership.
- User cannot set active dealership to a dealership they are not an active member of (403).
- Invalid or CLOSED dealership: 403 or clear error.
- Audit log entry created on successful switch.
- All existing tenant-scoped APIs continue to use resolved active dealership; no cross-tenant leakage.

---

## 15. Files to touch (Steps 2–4)

### Step 2 — Backend

- `apps/dealer/prisma/schema.prisma`: Add model UserActiveDealership.
- `apps/dealer/prisma/migrations/`: New migration.
- `apps/dealer/lib/tenant.ts`: getActiveDealershipId — when no cookie (Bearer), read UserActiveDealership; validate membership; optional fallback to first membership and upsert. New helper: setActiveDealershipForUser(userId, dealershipId) for DB + cookie.
- `apps/dealer/app/api/me/`: New routes: dealerships (GET), current-dealership (GET, POST). Use requireUserFromRequest; current-dealership POST validates membership, upserts UserActiveDealership, sets cookie, audits, returns payload.
- `apps/dealer/app/api/auth/session/switch/route.ts`: After setActiveDealershipCookie, also upsert UserActiveDealership. Optionally use requireUserFromRequest so Bearer can switch via this route too (or leave as web-only and have mobile use POST /api/me/current-dealership).
- `apps/dealer/lib/audit.ts`: No change (auditLog already supports action/entity/metadata).
- Services: No change to dashboard/customers/inventory/deals services; they already use ctx.dealershipId from handler.

### Step 3 — Frontend integration surface

- Optional: dealer web account/settings area shows “Current dealership: X” and “Available: N” from GET /api/me/current-dealership and GET /api/me/dealerships. Only if such a page exists and minimal readout is desired.
- Contract exports: Types for API responses can live in a shared types file or next to the route.

### Step 4 — Security & QA

- Tests: membership listing (GET dealerships); current read (GET current-dealership); switch success (POST); switch forbidden for non-member; auth context after switch; single-dealership backward compat; tenant isolation (e.g. switch then list customers and see only that dealership’s data).
- Docs: Update MOBILE_DEALER_API.md or equivalent with new /api/me endpoints.

---

## 16. Implementation summary (completed)

### Delivered

1. **Spec**: This document (`apps/dealer/docs/MULTI_DEALERSHIP_MEMBERSHIPS_SPEC.md`).
2. **Schema / migration**: `UserActiveDealership` model; migration `20260306150000_add_user_active_dealership`.
3. **Backend**:  
   - `lib/tenant.ts`: `setActiveDealershipForUser`, `getStoredActiveDealershipId`; `getActiveDealershipId` uses UserActiveDealership for Bearer when no cookie, with fallback to first membership and upsert.  
   - `GET /api/me/dealerships`: list memberships with role and `isActive`.  
   - `GET /api/me/current-dealership`: current dealership payload or null + `availableCount`.  
   - `POST /api/me/current-dealership`: validate membership, upsert UserActiveDealership, set cookie, audit `auth.dealership_switched`, return new payload.  
   - `PATCH /api/auth/session/switch`: uses `requireUserFromRequest`, validates dealership (not CLOSED, isActive), calls `setActiveDealershipForUser`, writes same audit event.
4. **Contracts**: `lib/types/me.ts` — Zod schemas and types for dealerships list, current-dealership GET/POST.
5. **Tests**: `app/api/me/dealerships/route.test.ts`, `app/api/me/current-dealership/route.test.ts`, `app/api/auth/session/switch/route.test.ts` (including 403 for non-member, CLOSED, and audit on switch).

### Backward compatibility

- Single-dealership users: no row in UserActiveDealership; resolution falls back to first (and only) membership; behavior unchanged.
- Web: cookie still primary when present; session/switch updates both cookie and UserActiveDealership.

### Commands (from repo root)

- Apply migration (with `DATABASE_URL` set):  
  `cd apps/dealer && npx prisma migrate deploy`
- Run multi-dealership + session switch tests:  
  `cd apps/dealer && npx jest app/api/me app/api/auth/session/switch --no-cache`

### Follow-ups (optional)

- Mobile: use `GET /api/me/dealerships` and `GET /api/me/current-dealership` for switcher UI; call `POST /api/me/current-dealership` to switch; then call `GET /api/me` or other tenant APIs (they use resolved active dealership).
- Docs: add `/api/me/dealerships` and `/api/me/current-dealership` to MOBILE_DEALER_API.md or equivalent.

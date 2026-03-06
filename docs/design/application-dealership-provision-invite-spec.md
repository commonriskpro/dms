# Application → Dealership Provision + Owner Email Invitation (Auto dealershipId)

## 1. Overview

Bridge between **Applications** (intake + approval, `contactEmail`) and **Dealerships** (tenant registry + provisioning). After approval, platform admin can **Provision Dealership** (creates tenant and links to application) and **Invite Owner** (emails `contactEmail` with accept link). Application detail shows status, contactEmail, linked dealership, and invite status.

## 2. Entities and fields

### 2.1 Platform (existing + changes)

- **Application** (existing)
  - Add: `dealershipId` (UUID, nullable, unique) → FK to `PlatformDealership.id`. Set when provision is run; never from client.
- **PlatformDealership** (existing) — registry; status APPROVED → PROVISIONING → PROVISIONED.
- **DealershipMapping** (existing) — platformDealershipId ↔ dealerDealershipId.
- **DealershipInvite** (dealer DB) — existing; reused. Token stored in plaintext (existing pattern); no new invitations table. Invite status resolved via dealer internal API.

### 2.2 State transitions

- **Application:** APPLIED → UNDER_REVIEW → APPROVED | REJECTED. No transition from APPROVED.
- **Provision from application:** Application APPROVED → (create PlatformDealership if not linked) → call dealer provision → create DealershipMapping → set `application.dealershipId`. Idempotent: if `application.dealershipId` already set, return existing dealership.
- **Invite owner:** Application APPROVED; dealershipId set (auto-provision if missing). Create invite in dealer (Owner role) for `application.contactEmail`; send email; one-time token. Invite status: PENDING | ACCEPTED | EXPIRED | CANCELLED.

## 3. API routes and contracts

### 3.1 Platform (all require platform auth + role)

| Method | Path | Description | RBAC |
|--------|------|-------------|------|
| GET | /api/platform/applications/[id] | Detail; include dealershipId, dealership summary, ownerInviteStatus | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT |
| POST | /api/platform/applications/[id]/provision | Create dealership from application; set application.dealershipId; idempotent | PLATFORM_OWNER |
| POST | /api/platform/applications/[id]/invite-owner | Provision if needed; invite owner to contactEmail; send email | PLATFORM_OWNER |

**POST provision response:** `{ dealershipId, displayName, status, dealerDealershipId?, provisionedAt? }`

**POST invite-owner response:** `{ inviteId, status: 'PENDING', expiresAt }` or conflict if already has owner / recent invite.

**GET application/[id] response (extended):** existing fields + `dealershipId?`, `dealership?` (id, displayName, status, dealerDealershipId, provisionedAt), `ownerInviteStatus?` (status, expiresAt?, acceptedAt?, lastSentAt?).

### 3.2 Dealer internal (existing + new)

- **GET /api/internal/dealerships/[dealerDealershipId]/owner-invite-status?email=...** — returns latest owner invite for that email: `{ status, expiresAt?, acceptedAt? }`. Used by platform to show invite status. Auth: internal JWT. Rate limited.

### 3.3 Public invite (existing)

- **GET /api/invite/resolve?token=...** — existing (dealer).
- **POST /api/invite/accept** — existing (dealer).

No new public routes. Invite flow remains in dealer; platform triggers it via owner-invite and sends email via Resend.

## 4. RBAC and security

- All `/api/platform/*` require `requirePlatformAuth()` and `requirePlatformRole(..., ["PLATFORM_OWNER"])` for provision and invite-owner; read roles for GET application.
- `dealershipId` on Application is **server-set only**; never from client.
- Dealer internal owner-invite-status: JWT + rate limit; no PII in response beyond status/expires/acceptedAt.
- Invite: token one-time after accept; expiry enforced; no raw token in logs or UI.

## 5. Edge cases

- **Re-invite:** Allowed; dealer owner-invite is idempotent by idempotency key (same key returns existing invite). New invite creates new token. UI can show "Invite sent" and last sent time.
- **Expiry:** Resolve/accept return 410 or EXPIRED when expired; UI shows Expired.
- **Cancel:** Dealer invite can be cancelled; status CANCELLED; resolve returns 410.
- **Already has owner:** Dealer may return conflict when creating owner invite if membership with Owner already exists; platform returns 409 with message "Dealership already has an owner."
- **Email failure:** If Resend fails, return 502; platform can show "Invite created but email failed; copy link" if we return acceptUrl in response (optional).

## 6. Email integration

- Use **existing** platform Resend wrapper (`lib/email/resend.ts`, `sendOwnerInviteEmail`). Same template and env (`RESEND_API_KEY`, `PLATFORM_SUPPORT_EMAIL`). No new provider.
- Invite-owner flow: platform calls dealer internal owner-invite → gets acceptUrl → sends email via `sendOwnerInviteEmail(toEmail: application.contactEmail, dealershipName, acceptUrl)`.

## 7. Security & QA (implemented)

- **Rate limiting:** Dealer `GET /api/internal/dealerships/[id]/owner-invite-status` uses existing internal rate limit. Invite resolve/accept (dealer) already rate limited.
- **Token/email:** No raw token or PII in platform audit metadata; dealer stores token (existing pattern); platform logs only inviteId in afterState.
- **RBAC:** All platform routes use `requirePlatformRole`; provision and invite-owner require PLATFORM_OWNER; GET application requires PLATFORM_OWNER/COMPLIANCE/SUPPORT.
- **dealershipId:** Set only server-side in application-onboarding; never from client.
- **Role escalation:** Owner invite creates only Owner role (dealer owner-invite flow); no client-supplied role.
- **Quality:** `npm run test` and `npm run build` pass in apps/platform. Smoke checklist: `docs/runbooks/application-dealership-onboarding-smoke.md`.

## 8. Implementation notes

- **Provision from application:** Create PlatformDealership with application.legalName, application.displayName, planKey `"standard"`, limits `{}`. Then call existing `callDealerProvision`; create DealershipMapping; update Application.dealershipId. Idempotent: if application.dealershipId already set, load PlatformDealership + mapping and return.
- **Invite owner:** Resolve application → dealershipId (provision if null) → dealerDealershipId from mapping → `callDealerOwnerInvite(dealerDealershipId, application.contactEmail, platformDealershipId, actorUserId, idempotencyKey)`. On success, send email with acceptUrl. Return invite metadata.
- **Owner invite status:** Dealer exposes GET internal owner-invite-status by dealership + email; platform GET application/[id] calls it when dealershipId set and merges into response.

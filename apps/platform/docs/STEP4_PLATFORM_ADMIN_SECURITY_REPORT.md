# Step 4 — Platform Admin Security Report

## 1. RBAC

| Route / capability | Allowed roles | Verified |
|-------------------|---------------|----------|
| Dashboard GET | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | requirePlatformRole in dashboard/route.ts |
| Reports (growth, funnel, usage) | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | requirePlatformRole in each reports route |
| Billing GET | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | requirePlatformRole in billing/route.ts |
| Dealerships list/detail | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | requirePlatformRole in dealerships routes |
| Dealership invites GET | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | requirePlatformRole in invites/route.ts |
| Dealership invite revoke PATCH | PLATFORM_OWNER, PLATFORM_COMPLIANCE | requirePlatformRole in revoke/route.ts |
| Application list/detail | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | requirePlatformRole in applications routes |
| Application approve/reject | PLATFORM_OWNER, PLATFORM_COMPLIANCE | requirePlatformRole in approve/route.ts, reject/route.ts |
| Application provision, invite-owner | PLATFORM_OWNER | requirePlatformRole (invite-owner, provision) |
| Platform users list/invite/PATCH | PLATFORM_OWNER (write), SUPPORT+ (read) | Existing users routes |
| Audit list/detail | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | Existing audit routes |
| Monitoring | PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT | Existing monitoring routes |

Dealership users (tenant users in dealer app) do not have access to platform-admin; they use dealer app and dealer RBAC. Platform routes require Supabase auth + platform_users row; no dealership-scoped user can call platform APIs unless they are also a platform user.

## 2. Tenant safety

- Platform reads that aggregate across tenants (dashboard, reports, usage, billing) are restricted to platform roles and use only platform DB (Application, PlatformDealership, PlatformAuditLog, etc.).
- Dealership-specific operations (dealership detail, invites list/revoke) use platformDealershipId from URL; dealerDealershipId is resolved via DealershipMapping. No cross-tenant leakage: list invites and revoke are scoped to the single dealership.
- Dealer internal invite list returns data for one dealerDealershipId only (path param). Platform never passes a dealership ID from the client without resolving it from the URL id.

## 3. Invite security

- **Token:** Invite token is generated and stored in dealer DB only (DealershipInvite.token). Platform never stores or logs the raw token. Accept URL is built by dealer and sent by platform via Resend; platform does not expose token in URLs or API responses.
- **List invites:** Dealer internal API returns emailMasked only (maskInviteEmail). Platform GET dealerships/[id]/invites returns that list; no PII.
- **Revoke:** Platform calls dealer internal PATCH with cancel: true and platformActorId; dealer cancels invite and audits with platformActorId in metadata.
- **Expired / revoked / accepted:** Enforced in dealer (resolve, accept). Platform does not implement accept; accept is in dealer app. Single-use enforced in dealer accept flow.
- **Rate limiting:** invite_owner is rate-limited (platform rate-limit.ts). List invites and revoke are not separately rate-limited (low volume); dealer internal rate limit applies to internal routes.

## 4. Validation

- Application approve: params id (from path). Reject: body with applicationRejectRequestSchema (reason).
- Dashboard, reports, billing: query params (limit, offset, months) coerced with bounds.
- Dealership invites GET: platformDealershipId from path; limit/offset/status from query (validated in route).
- Dealership invite revoke PATCH: platformDealershipId, inviteId from path.
- All mutations that accept body use Zod schemas (contracts or route-level). Invalid input returns 422 with validation details.

## 5. Rate limiting

- invite_owner: checkPlatformRateLimit(clientId, "invite_owner") in invite-owner and application invite-owner routes.
- Dealer internal: checkInternalRateLimit on GET invites and PATCH cancel.
- No new platform rate limit for list/revoke in this sprint (can be added if needed).

## 6. Audit logging

| Action | Audit event | Location |
|--------|-------------|----------|
| Dealership created | dealership.created | dealerships POST |
| Application approved | application.approved | applications approve (on state change) |
| Application rejected | application.rejected | applications reject (on state change) |
| Invite sent (owner) | application.owner_invite_sent, dealership.owner_invite.email_sent | application-onboarding, owner-invite route |
| Invite revoked | dealership.invite.revoked | invites/[inviteId]/revoke PATCH |
| Dealership status change | (dealer-side and/or platform if added) | status route |

Platform audit uses platformAuditLog(actorPlatformUserId, action, targetType, targetId, beforeState, afterState, reason). No PII or raw tokens in afterState/beforeState.

## 7. Response hygiene

- handlePlatformApiError: PlatformApiError returns code + message; ZodError returns VALIDATION_ERROR and flattened details; other errors return INTERNAL_ERROR and generic message. No stack traces or raw errors in JSON.
- Production-safe: No sensitive data in error payloads. Not found returns 404 with NOT_FOUND; forbidden returns 403.

## 8. Test coverage (critical paths)

- Approve idempotency: already APPROVED returns 200 without update/audit (approve/route.idempotency.test.ts).
- Reject idempotency: already REJECTED returns 200 without update/audit (reject/route.idempotency.test.ts).
- Dashboard: 403 when no role; 200 with expected shape (dashboard/route.test.ts).
- Dealership invites GET: 422 when not provisioned; 200 when dealer returns data (invites/route.test.ts).
- Existing RBAC tests: invite-owner, applications, dealerships, users (various .rbac.test.ts files).

Recommendation: Add a test for revoke PATCH (mock callDealerRevokeInvite, expect 204 and platformAuditLog) and for invites GET when dealer returns 502 (platform returns 502).

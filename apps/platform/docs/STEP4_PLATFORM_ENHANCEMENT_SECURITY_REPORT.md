# Step 4 — Platform Enhancement Phase: Security Report

## Verification summary

### 1. Platform user enrichment

- **Read-only:** Enrichment (email, displayName, lastSignInAt) is from Supabase Admin API only; no writes to platform DB. Display-only in API response.
- **Graceful failure:** Per-user lookup failure returns null/empty for that user; list does not fail. No sensitive provider internals exposed.
- **Server-only:** Supabase Admin client and enrichment run server-side only.

### 2. Monitoring

- **Platform-only:** GET /api/platform/monitoring/events requires requirePlatformAuth and requirePlatformRole (OWNER/COMPLIANCE/SUPPORT). No dealer access.
- **No data leakage:** Response contains only audit action/targetType/targetId/createdAt and summary counts; redaction applied to beforeState/afterState via existing redact().
- **Filters:** Query params (limit, offset, dateFrom, dateTo, action) validated with Zod.

### 3. Billing

- **RBAC:** PATCH /api/platform/dealerships/[id] for planKey/limits requires PLATFORM_OWNER or PLATFORM_COMPLIANCE only.
- **Validation:** planKey allowlist (starter, standard, enterprise); limits record with max 20 keys; values number/string/boolean.
- **Audit:** Every plan update logs dealership.plan_updated with beforeState/afterState (no PII).

### 4. Impersonation / support session

- **Start:** POST /api/platform/impersonation/start requires PLATFORM_OWNER only. Target platformDealershipId validated; dealerDealershipId resolved via DealershipMapping (no client-supplied dealer id). JWT signed with INTERNAL_API_JWT_SECRET; aud support_session; 2h TTL.
- **Audit:** impersonation.started logged with targetDealershipId and dealerDealershipId (no PII).
- **Dealer consume:** GET /api/support-session/consume verifies JWT (aud, iss, exp); rejects invalid/expired; sets httpOnly, secure, sameSite strict cookie. Dealership must exist and not CLOSED.
- **Session distinction:** getSessionContextOrNull returns isSupportSession and supportSessionPlatformUserId; dealer UI shows SupportSessionBanner. No merge with normal dealer auth.
- **End:** POST /api/support-session/end clears cookie only; no token in response. Expired cookie ignored on next request.
- **No privilege escalation:** Support session does not grant dealer roles; context is dealership-only for viewing. Platform RBAC unchanged.
- **Last-owner:** Unchanged; platform user disable/demote logic not modified.

### 5. Response hygiene

- No raw tokens in API responses (redirectUrl contains token in query for one-time consume only).
- Error responses use existing handlePlatformApiError / errorResponse; no stack traces or internal details.
- Serializers: audit beforeState/afterState redacted; monitoring events redacted.

### 6. Test coverage

- Jest: platform user list (with enrichment mock), enrichment fallback, monitoring events, impersonation start (422, 404, 200 + audit). Dealer support-session consume/end not unit-tested in this phase; manual smoke recommended.

---

## Risks / follow-ups

- Support session does not yet allow tenant API access (getAuthContext still requires real user). Session + banner only; full “view as” API access is a possible follow-up.
- Plan key allowlist is hardcoded; consider env or config if more plans added.

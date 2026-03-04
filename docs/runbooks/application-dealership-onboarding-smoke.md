# Smoke checklist: Application → Dealership provision + Owner invite

Use after deploying the application onboarding flow. Requires platform app, dealer app, dealer internal API and Resend (or copy-link fallback) configured.

## Prerequisites

- Platform DB migrated (`application.dealership_id` column present).
- Dealer DB has Owner role and invite flow working.
- `DEALER_INTERNAL_API_URL`, `INTERNAL_API_JWT_SECRET` set for platform.
- Platform user with PLATFORM_OWNER role.
- (Optional) `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM` for owner invite email.

## Manual test steps

1. **Create and approve application**
   - In platform app, go to **Applications**.
   - Create a new application (legal name, display name, contact email).
   - Open the application; click **Approve** (as PLATFORM_OWNER or PLATFORM_COMPLIANCE).
   - Confirm status is **APPROVED**.

2. **Provision dealership**
   - On the same application (or from list), click **Provision Dealership**.
   - Expect success toast and **Linked dealership** to appear with display name and status (e.g. PROVISIONED).
   - **Open Dealership** button appears; click it and confirm you land on the dealership detail page in platform.

3. **Invite owner**
   - On the application, click **Invite Owner**.
   - Expect success toast ("Invite sent to contact email").
   - **Owner invite** shows status **PENDING** (and expiry if set).
   - If Resend is configured, contact email receives the invite; otherwise use dealer app or support to obtain the accept link for testing.

4. **Accept invite**
   - Open the accept link (e.g. `https://<dealer-app>/accept-invite?token=...`) in a browser.
   - Sign in or sign up with the **contact email** used on the application.
   - Accept the invite; expect redirect into dealer app with that dealership active as Owner.

5. **Login as owner**
   - Log in to the dealer app with the same user; confirm the dealership is available and user has Owner permissions (e.g. Dealership, Users, Roles in sidebar).

## Idempotency

- **Provision** again on the same application: expect same dealership (no duplicate); success response with existing dealershipId.
- **Invite owner** again: dealer may return existing invite or create new one; platform shows success and owner invite status updates.

## RBAC

- As a user **without** PLATFORM_OWNER (e.g. PLATFORM_SUPPORT), open an approved application: **Provision Dealership** and **Invite Owner** must not be visible (or disabled).
- Call `POST /api/platform/applications/<id>/provision` or `.../invite-owner` as non-owner: expect **403 Forbidden**.

## Quality gates

- `pnpm lint` and `pnpm test` and `pnpm build` pass in `apps/platform` and `apps/dealer`.
- No raw token or PII in platform audit logs for application.provision / application.owner_invite_sent.

---

## Invite flow smoke checklist

Use after deploying invite-signup flow (per `docs/specs/invite-signup-flow-spec.md`). Dealer app only.

- **Resolve (GET /api/invite/resolve?token=...)**  
  - Valid token: 200, `data.inviteId`, `data.dealershipName`, `data.roleName`, optional `data.emailMasked` (masked, not full email).  
  - No token in response body or in any log/Sentry.

- **Accept — signup path (POST /api/invite/accept, no auth, body: token + email + password + fullName?)**  
  - Creates user (Supabase), profile, membership for **invite’s dealership only**; marks invite ACCEPTED.  
  - 200 with `data.membershipId`, `data.dealershipId` (from invite).  
  - Client can then `signInWithPassword` and redirect.

- **Accept — authenticated path (POST /api/invite/accept, auth, body: token only)**  
  - Same success shape; idempotent if user already has membership (200, `alreadyHadMembership: true`).  
  - Actor email must match invite email (403 INVITE_EMAIL_MISMATCH otherwise).

- **410 Gone**  
  - Expired invite (`expiresAt` in past or status EXPIRED/CANCELLED).  
  - Already accepted (one-time use for resolve; accept returns 410 for different user/email when invite already ACCEPTED).

- **409 Conflict**  
  - Signup path: email already registered → `EMAIL_ALREADY_REGISTERED`; show “Already have an account? Sign in” and use authenticated flow.

- **No token or password in logs**  
  - No invite token or password in app logs, audit metadata, or Sentry.  
  - Audit for `platform.invite.accepted`: metadata only `inviteId`, `membershipId`, `dealershipId`, `roleId`, `acceptedByUserId`.

- **Tenant isolation**  
  - `dealershipId` never from request body or query; membership always created for `invite.dealershipId`.  
  - Manual check: send body with wrong `dealershipId` on signup; confirm membership is for invite’s dealership only.

- **Rate limiting**  
  - Resolve: per-client (e.g. 60/min). Accept: per-client (e.g. 10/min) and per-token (hashed, e.g. 5 per 15 min).  
  - Excess requests return 429 RATE_LIMITED.

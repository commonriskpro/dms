# Step: Email Owner Invite (Resend, Platform → Dealer)

## Goal

Production-ready email sending for Dealer Owner Invites using Resend. Platform sends the invite email; dealer app does not have Resend keys. No PII in logs/audit; idempotency/dedupe within 5 minutes.

---

## 1. Email flow

1. **Platform UI** calls `POST /api/platform/dealerships/[id]/owner-invite` with `{ email }`.
2. **Platform backend**:
   - Validates body (Zod), enforces PLATFORM_OWNER.
   - Looks up dealership mapping → `dealerDealershipId`.
   - Calls **dealer internal** `POST /api/internal/dealerships/{dealerDealershipId}/owner-invite` (existing) with JWT, Idempotency-Key, body `{ email, platformDealershipId, platformActorId }`.
   - Dealer returns `{ inviteId, invitedEmail, createdAt, acceptUrl }`.
3. **Dedupe**: If a row exists in `PlatformEmailLog` for same `platformDealershipId` + `recipientHash` (sha256 of lowercased trimmed email) within last 5 minutes, **do not** send another email. Return `200` with `{ ok: true, alreadySentRecently: true, acceptUrl }`.
4. **Send email**: Platform sends email via **Resend** to `invitedEmail` with body containing `acceptUrl` (subject/body per template below).
5. **Log**: Insert `PlatformEmailLog` row (type `OWNER_INVITE`, `recipientHash`, `sentAt`, `requestId`). Never store raw email or token.

---

## 2. Idempotency / anti-spam

- **Window**: 5 minutes.
- **Key**: `platformDealershipId` + `recipientHash` (sha256(lowercase(trim(email)))).
- If a send for that key occurred within the last 5 minutes: skip Resend, return `200` with `alreadySentRecently: true` and `acceptUrl` (from dealer response).
- Platform stores minimal “email delivery log” in `PlatformEmailLog`: no token, no raw email; only `recipientHash`, `platformDealershipId`, `type`, `sentAt`, `requestId`.

---

## 3. Audit requirements

- **Platform audit** (append-only):
  - **Action** (one of):
    - `dealership.owner_invite.email_sent` — email sent via Resend.
    - `dealership.owner_invite.email_skipped_recent` — deduped (already sent within 5 min).
    - `dealership.owner_invite.email_failed` — Resend failed.
  - **Fields**: `actorPlatformUserId`, `targetType`: `dealership`, `targetId`: `platformDealershipId`, `afterState` may include `recipientHash` (hashed email only), `requestId`. **Do not** store `acceptUrl`, token, or raw email.
  - On dealer call failure: audit with `dealerCallFailed: true` (no PII).

---

## 4. Resend

- **Env** (platform only):
  - `RESEND_API_KEY` — required in production when owner-invite email is used.
  - `PLATFORM_EMAIL_FROM` — e.g. `"Platform <noreply@yourdomain.com>"`.
  - `PLATFORM_SUPPORT_EMAIL` — optional; used in email footer.
- **Usage**: Server-only in `apps/platform`. Dealer app must **not** reference Resend or these keys.
- **Optional link in footer**: Use `NEXT_PUBLIC_APP_URL` (platform) or `NEXT_PUBLIC_PLATFORM_URL` for “Manage your account” link in email if desired.

---

## 5. Email template

- **Subject**: `You've been invited to manage <Dealership Name>` (use `displayName` or `legalName`).
- **Body**:
  - Dealership display name / legal name.
  - Clear CTA button/link: **Accept invite** → `acceptUrl`.
  - Expiration note if dealer invite has expiry (e.g. “This link expires in 7 days” if applicable).
  - Support contact: “Questions? Contact support at {PLATFORM_SUPPORT_EMAIL}” or generic “Contact support.”
- **Format**: HTML with plain-text fallback. No tracking pixels by default.

---

## 6. Vercel-only runbook

- **Env vars** (Platform project in Vercel):
  - `RESEND_API_KEY` — from Resend dashboard.
  - `PLATFORM_EMAIL_FROM` — e.g. `Platform <noreply@yourdomain.com>` (must be verified domain in Resend).
  - `PLATFORM_SUPPORT_EMAIL` (optional) — e.g. `support@yourdomain.com`.
- **Resend**: Verify sending domain (SPF/DKIM) in Resend dashboard.
- **Test**: From platform: create dealership → provision → Send owner invite → check inbox → open acceptUrl → accept in dealer.

---

## 8. Deployed-only test checklist (Vercel)

1. **Set env vars** (Platform project in Vercel): `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM` (e.g. `Platform <noreply@yourdomain.com>`), optionally `PLATFORM_SUPPORT_EMAIL`.
2. **Resend**: Verify sending domain (SPF/DKIM) in Resend dashboard.
3. **E2E**: Log in to platform → create dealership → provision → open dealership → Send Owner Invite → enter email → Send. Confirm toast "Invite email sent." and acceptUrl shown.
4. **Inbox**: Check invitee inbox for email with subject "You've been invited to manage &lt;Dealership Name&gt;" and working Accept button/link.
5. **Accept**: Open acceptUrl in browser → sign in or sign up → Accept → land on dealer dashboard.
6. **Dedupe**: Send owner invite to same email again within 5 minutes → toast "Invite already sent recently. Link re-shown.", no second email sent.
7. **Health**: Ensure `/api/platform/health` (or platform health route) does not expose `RESEND_API_KEY` or email config; it may report env validation pass/fail only.

---

## 7. Contracts

- **Platform owner-invite response**: `ok`, `dealerDealershipId`, `inviteId`, `acceptUrl` (optional), `alreadySentRecently` (optional boolean).
- **Dealer internal** response remains: `inviteId`, `invitedEmail`, `createdAt`, `acceptUrl` (optional). No change required on dealer side for email flow; platform consumes `acceptUrl` and optionally `invitedEmail` for sending only (never stored in platform DB/audit as plain text).

# Platform Onboarding Status API

This runbook describes how to use the **Onboarding Status** API to see where an application’s onboarding is stuck in one call, without leaking tokens or raw email.

## Endpoint

**GET** `/api/platform/applications/[id]/onboarding-status`

- **Auth:** Platform session required. Caller must have a platform admin role (`PLATFORM_OWNER`, `PLATFORM_COMPLIANCE`, or `PLATFORM_SUPPORT`).
- **Params:** `id` — application UUID (path).

## How to call

1. **From Platform UI (future):** Use the same session/cookies as other platform API calls. No body; GET with application id in the path.

2. **From curl (support/debug):**
   - Obtain a platform session cookie (e.g. log in to platform, then copy `Cookie` header or use a tool that sends cookies).
   - Example (replace `APPLICATION_ID` and base URL):
     ```bash
     curl -s -H "Cookie: <platform-session-cookie>" \
       "https://<platform-host>/api/platform/applications/APPLICATION_ID/onboarding-status"
     ```

3. **Response shape:** Always `{ data: { ... } }`. Never contains `token`, `acceptUrl`, or raw `contactEmail`.

## Response fields

| Field | Description |
|-------|-------------|
| `applicationId` | Application UUID. |
| `applicationStatus` | `APPLIED` \| `UNDER_REVIEW` \| `APPROVED` \| `REJECTED`. |
| `contactEmailMasked` | Safe mask only (e.g. `o***@acme.com`). Optional. |
| `contactEmailHash` | Deterministic hash of contact email (no raw email). |
| `platformDealershipId` | Linked platform dealership UUID, or `null`. |
| `platformDealershipStatus` | e.g. `PROVISIONED`, `ACTIVE`, or `null`. |
| `mapping` | `{ dealerDealershipId, provisionedAt }` if provisioned; else `null`. |
| `ownerInvite` | `{ status, invitedAt?, expiresAt?, acceptedAt? }` or `null`. Status: `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED`, or `UNKNOWN`. |
| `ownerJoined` | `true` only when `ownerInvite.status === "ACCEPTED"`. |
| `nextAction` | Recommended next step (see below). |
| `timeline` | Optional list of audit events (action, createdAt, actorIdTail) for this application. |

## Meaning of `nextAction`

Use `nextAction` to see where onboarding is stuck and what to do next:

| Value | Meaning |
|-------|--------|
| `NONE` | Application not approved, or onboarding complete (owner joined). No action needed for onboarding. |
| `PROVISION` | Application is approved but no dealership is linked or no mapping exists. **Action:** Run “Provision Dealership” (POST provision). |
| `INVITE_OWNER` | Provisioned but no owner invite (or status unknown). **Action:** Run “Invite Owner” (POST invite-owner). |
| `WAIT_FOR_ACCEPT` | Owner invite is PENDING. **Action:** Wait for the owner to accept the invite (or check email delivery). |
| `RESEND_INVITE` | Invite expired or cancelled. **Action:** Resend invite (call invite-owner again if supported). |

Support can refresh the endpoint; dealer internal status calls are cached for 15 seconds to avoid spamming the dealer app.

## Privacy rules

- **No tokens** — Invite tokens and accept URLs are never returned or logged in this API.
- **No raw email** — Only `contactEmailMasked` and/or `contactEmailHash` are returned. Raw email is used only in server-to-server calls to the dealer (owner-invite-status) and is never exposed in the response.
- **Timeline** — Only safe fields (action, createdAt, actorIdTail); no `beforeState`/`afterState` that might contain PII.

## Example responses

**1) Approved, not provisioned**

```json
{
  "data": {
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "applicationStatus": "APPROVED",
    "contactEmailMasked": "o***@acme.com",
    "contactEmailHash": "a1b2c3d4e5f6...",
    "platformDealershipId": null,
    "platformDealershipStatus": null,
    "mapping": null,
    "ownerInvite": null,
    "ownerJoined": false,
    "nextAction": "PROVISION",
    "timeline": []
  }
}
```

**2) Provisioned, invite pending**

```json
{
  "data": {
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "applicationStatus": "APPROVED",
    "contactEmailMasked": "o***@acme.com",
    "contactEmailHash": "a1b2c3d4e5f6...",
    "platformDealershipId": "660e8400-e29b-41d4-a716-446655440001",
    "platformDealershipStatus": "PROVISIONED",
    "mapping": {
      "dealerDealershipId": "770e8400-e29b-41d4-a716-446655440002",
      "provisionedAt": "2025-03-01T12:00:00.000Z"
    },
    "ownerInvite": {
      "status": "PENDING",
      "expiresAt": null,
      "acceptedAt": null
    },
    "ownerJoined": false,
    "nextAction": "WAIT_FOR_ACCEPT",
    "timeline": [
      { "eventType": "application.approved", "createdAt": "2025-02-28T10:00:00.000Z", "actorIdTail": "abc123" },
      { "eventType": "application.provision", "createdAt": "2025-03-01T12:00:00.000Z", "actorIdTail": "abc123" }
    ]
  }
}
```

**3) Invite accepted (ownerJoined true)**

```json
{
  "data": {
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "applicationStatus": "APPROVED",
    "contactEmailMasked": "o***@acme.com",
    "contactEmailHash": "a1b2c3d4e5f6...",
    "platformDealershipId": "660e8400-e29b-41d4-a716-446655440001",
    "platformDealershipStatus": "PROVISIONED",
    "mapping": {
      "dealerDealershipId": "770e8400-e29b-41d4-a716-446655440002",
      "provisionedAt": "2025-03-01T12:00:00.000Z"
    },
    "ownerInvite": {
      "status": "ACCEPTED",
      "expiresAt": null,
      "acceptedAt": "2025-03-03T14:30:00.000Z"
    },
    "ownerJoined": true,
    "nextAction": "NONE",
    "timeline": []
  }
}
```

## Errors

- **401** — Not authenticated (no valid platform session).
- **403** — Authenticated but not a platform admin (insufficient role).
- **404** — Application not found (invalid or deleted `id`).
- **422** — Invalid `id` (e.g. not a UUID).

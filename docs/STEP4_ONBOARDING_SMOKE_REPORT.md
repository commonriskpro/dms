# Step 4 — Onboarding Flow Smoke Report

Manual steps to verify the cross-app onboarding flow and negative cases.

---

## Prerequisites

- Platform app running (e.g. port 3001)
- Dealer app running (e.g. port 3000)
- Platform admin logged in
- Dealer DB and Platform DB migrated and seeded as needed

---

## 1) Happy path: Create application → Approve → Provision → Invite owner

1. **Platform:** Create a new application (legal name, display name, contact email).
2. **Platform:** Approve the application (role PLATFORM_OWNER or COMPLIANCE).
3. **Platform:** Open application detail; confirm **Onboarding Status** panel shows Application: APPROVED, Next Action: PROVISION.
4. **Platform:** Click **Provision Dealership**. Confirm success; panel shows Dealership: PROVISIONED, Next Action: INVITE_OWNER or WAIT_FOR_ACCEPT.
5. **Platform:** Click **Invite Owner**. Confirm **"Invite sent successfully"** (or equivalent) and no silent failure.
6. **Platform:** Check onboarding status panel: Owner Invite: PENDING, Next Action: WAIT_FOR_ACCEPT. Timeline shows APPLICATION_APPROVED, DEALERSHIP_PROVISIONED, OWNER_INVITE_SENT (or equivalent actions). **No email or token in UI.**

---

## 2) Happy path: Open invite link → Accept → Dashboard → Refresh

1. **Dealer:** Use the invite link from email (or copy accept URL with token).
2. **Dealer:** Open `/accept-invite?token=...` in browser.
3. **Not logged in:** Complete signup (email, password, confirm, optional full name). Submit. Confirm **full-page redirect** to `/dashboard?switchDealership=<dealershipId>`.
4. **Logged in:** Click **Accept invite**. Confirm **full-page redirect** to `/dashboard?switchDealership=<dealershipId>`.
5. **Dashboard:** After redirect, confirm active dealership is set and welcome card shows correct dealership name. **No "no active dealership" message.**
6. **Refresh** the dashboard page. Confirm still logged in and same active dealership.

---

## 3) Negative: Reuse token (replay)

1. Use an invite link that was already accepted.
2. Open same link again (or POST /api/invite/accept with same token).
3. **Expected:** 410 Gone (or equivalent) with code INVITE_ALREADY_ACCEPTED; no success response.

---

## 4) Negative: Expired token

1. Use an invite link that has expired (or manually set invite to EXPIRED in DB for testing).
2. Open link or call resolve/accept.
3. **Expected:** 410 with INVITE_EXPIRED (resolve) or 410 on accept; no success.

---

## 5) Negative: Session switch to unauthorized dealership

1. Log in as a user who is a member of dealership A only.
2. Call `PATCH /api/auth/session/switch` with body `{ "dealershipId": "<random-or-other-dealership-uuid>" }` (no membership).
3. **Expected:** 403 Forbidden, message like "Not a member of this dealership". No leak of whether the UUID exists.

---

## Sign-off

| Step | Result |
|------|--------|
| 1) Create → Approve → Provision → Invite | |
| 2) Accept → Dashboard → Refresh | |
| 3) Reuse token → 410 | |
| 4) Expired token → 410 | |
| 5) Switch to unauthorized → 403 | |

Complete after manual run; update table with Pass/Fail and date.

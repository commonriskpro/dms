# Step 4 — Platform User Management Smoke Report

Manual smoke checklist for Platform User Management. Run with platform app and at least one platform user (PLATFORM_OWNER).

## Access

- [ ] Unauthenticated: opening /platform/users redirects to login or returns 401.
- [ ] Authenticated user with no platform_users row sees forbidden/bootstrap.
- [ ] Disabled platform user (disabledAt set) cannot access /platform; receives 403 or is redirected (same as “not in platform_users”).
- [ ] Active platform user (OWNER, COMPLIANCE, or SUPPORT) can open /platform/users and see the list (or empty state).

## Page

- [ ] Title is "Users" and description is "Internal platform staff and access control...".
- [ ] Card title "Users" with Role filter, Search by ID, and (for Owner) Invite user and Add user.
- [ ] Empty state shows "No platform users yet." and "Add by user ID or invite by email (Owner only)." with Add user / Invite user buttons when current user is Owner.

## List (when users exist)

- [ ] Table columns: User ID (truncated + Copy), Role (badge or dropdown), Status (Active/Disabled badge), Created, Actions (for Owner).
- [ ] Role filter and search by ID work; pagination works when total > limit.
- [ ] Non-owner sees role as read-only badge (Owner, Compliance, Support).

## Actions (Owner only)

- [ ] Add user: opens dialog; entering valid UUID and role and submitting adds the user (or upserts). List updates.
- [ ] Invite user: opens dialog; entering email and role sends invite (or syncs role if user exists). List updates.
- [ ] Change role: dropdown changes role; confirm dialog when demoting an owner. Success toast and list refresh.
- [ ] Disable: button disables user; confirm when disabling an owner. Status becomes Disabled; Enable button appears.
- [ ] Enable: button re-enables user. Status becomes Active.

## Safety

- [ ] Demoting the last PLATFORM_OWNER returns 409 (or toast with "Cannot remove the last platform owner").
- [ ] Disabling the last PLATFORM_OWNER returns 409 or equivalent message.
- [ ] Logging in as a disabled user does not grant access to platform (403 or redirect).

## Audit

- [ ] After role change or disable/enable, audit log (e.g. /platform/audit) shows corresponding event (platform_user.role_changed, platform_user.disabled, platform_user.enabled).

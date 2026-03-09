# Step 4 — Platform Admin Smoke Report

Manual smoke checklist for platform-admin after completion sprint. Run with platform and dealer apps running and at least one platform user and one application/dealership.

## Authentication

- [ ] Unauthenticated access to /platform redirects to login.
- [ ] Authenticated user without platform_users row sees forbidden/bootstrap.
- [ ] Platform user (SUPPORT or above) can open /platform and see dashboard.

## Dashboard (/platform)

- [ ] Dashboard loads and shows KPI cards (dealerships, applications, users, etc.).
- [ ] Recent applications table shows up to 10 rows with link to detail.
- [ ] Recent audit table shows entries with action and target.
- [ ] Quick links navigate to Dealerships, Applications, Monitoring, Reports, Audit.

## Dealerships

- [ ] List loads with status filter and pagination.
- [ ] Clicking a row or View opens dealership detail.
- [ ] Detail shows Registry (status, provision, owner invite), Invites section (if provisioned), Plan, Activity link.
- [ ] Send Owner Invite opens modal; submitting sends invite (or shows copy link).
- [ ] Invites section lists invites with email masked; Revoke works for PENDING (and list updates).
- [ ] Activity link goes to audit with targetType=dealership&targetId=id.

## Applications

- [ ] List loads with status filter; New Application creates an application.
- [ ] Application detail shows Approve/Reject for APPLIED; Provision and Invite Owner for APPROVED.
- [ ] Approve: status becomes APPROVED; second approve returns success without duplicate audit.
- [ ] Reject: reason required; status becomes REJECTED; second reject returns success without duplicate audit.
- [ ] Invite Owner (when approved) provisions if needed and sends invite.

## Reports (/platform/reports)

- [ ] Reports page loads; Application funnel shows counts by status.
- [ ] Dealership growth shows monthly counts (or empty).
- [ ] Tenant usage overview shows dealerships with plan and link to detail.

## Billing (/platform/billing)

- [ ] Billing page loads; table shows dealerships with plan key and limits (or empty).
- [ ] View link goes to dealership detail.

## Monitoring & Audit

- [ ] Monitoring page shows health and daily telemetry (or placeholders).
- [ ] Audit page loads with filters; detail opens for an entry.

## Platform users

- [ ] Users page lists platform users; invite by email and role change work (owner).

## Negative / security

- [ ] Logging in as a dealership-only user (no platform_users row) does not allow access to /platform/* (forbidden or redirect).
- [ ] Revoke invite returns 409 if invite is not PENDING (dealer enforces).

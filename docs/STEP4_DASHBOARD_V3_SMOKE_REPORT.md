# Step 4 — Dashboard V3.1 Smoke Report

**Feature:** Dealer Dashboard V3.1  
**Scope:** Dealer app

---

## What Was Smoke-Tested

- Dashboard page load (server-first, no client fetch on mount).
- Tenant scoping: data reflects active dealership only.
- RBAC: widgets and Quick Actions respect permissions.
- Refresh: explicit refresh only (router.refresh), no auto-polling.
- No sensitive data in visible UI or network payload.

---

## Manual Smoke Checklist

Use this on **local** and **Vercel preview** after deployment.

### Prerequisites

- Logged in as a user with at least one of `customers.read` or `crm.read`.
- Active dealership selected (cookie/session).

### Local

- [ ] **Access:** Open `/dashboard`. Page loads without error; no blank screen.
- [ ] **No fetch on load:** In DevTools Network, filter by Fetch/XHR on first load; no dashboard-data request on page load (data comes from RSC).
- [ ] **Metrics:** At least one metric card shows (Inventory, Leads, Deals, or BHPH) if you have the corresponding permission.
- [ ] **Widgets:** Customer Tasks, Inventory Alerts, Deal Pipeline, etc. show according to permissions; empty or zero when no permission.
- [ ] **Quick Actions:** With only read permissions, "No actions available." or no Add Vehicle/Add Lead/Start Deal. With write permissions, those links appear and point to `/inventory/new`, `/customers/new`, `/deals/new`.
- [ ] **Last updated / Refresh:** "Last updated" text and "Refresh" button visible; clicking Refresh reloads the page (or revalidates) and updates "Last updated."
- [ ] **Switch dealership:** If your app has a dealership switcher, switch to another dealership; dashboard data should change to the new dealership (no data from previous).
- [ ] **No PII in UI:** No email addresses, tokens, or raw cookies visible in the dashboard content.
- [ ] **Console:** No uncaught errors; no stack traces or sensitive data in console.

### Vercel Preview

- [ ] Same as Local: `/dashboard` loads, server-first, metrics and widgets by permission, Quick Actions gated, Refresh works.
- [ ] Verify no cross-tenant data when switching dealership (if applicable).
- [ ] Check Vercel function logs (if accessible): dashboard logs should show only requestId, tails, loadTimeMs, widgetCounts; no email, token, cookie, or full ids.

---

## How to Reproduce Failures

- **Blank dashboard:** Ensure session has `activeDealershipId` and at least `customers.read` or `crm.read`; check server logs for `dashboard_v3_load_error`.
- **Wrong data:** Confirm active dealership in session/cookie matches the dealership you expect; re-check tenant scoping in service if data appears from another dealer.
- **Sensitive data:** Search page source and network response for `@`, `token`, `cookie`, `authorization`, `bearer`, `supabase`; must not appear in payload or visible HTML.

---

## Result

- Manual smoke: run the checklist above on one local and one Vercel preview run.
- Document any failure in "Known issues" and retest after fix.

**Status:** Checklist ready for executor; no automated smoke in this repo (manual only).

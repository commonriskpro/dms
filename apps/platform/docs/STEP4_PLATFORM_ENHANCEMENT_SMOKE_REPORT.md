# Step 4 — Platform Enhancement Phase: Smoke Report

## Suggested manual checks

### Platform app (apps/platform)

1. **Users**
   - Open /platform/users. Table shows Name, Email, Last sign-in columns (or "—" when unavailable). Role, Status, Created, Actions unchanged.
   - Filter by role; search by ID. No errors.

2. **Monitoring**
   - Open /platform/monitoring. "Recent events" card shows Last 24h summary (approved/rejected counts) and Recent audit table. Refresh works.

3. **Billing**
   - Open /platform/billing. Table shows View / Edit plan link. Open a dealership.

4. **Dealership detail**
   - On a provisioned dealership, Plan card has "Edit plan". Click: dialog with plan key and limits JSON. Save updates and refetch.
   - "Support session" card and "Open as dealer" visible for PLATFORM_OWNER when dealership is provisioned. Click: confirm dialog → redirect to dealer app support-session consume URL.

5. **Impersonation start**
   - As PLATFORM_OWNER, click "Open as dealer" on a provisioned dealership, confirm. Browser redirects to dealer app /api/support-session/consume?token=... then to dealer home.

### Dealer app (apps/dealer)

6. **Support session banner**
   - After step 5, dealer app shows prominent banner: "Support session — viewing as [Dealership name]" and "End support session" button.
   - Click "End support session". Banner disappears; session cleared; redirect to /.

7. **Session**
   - With support session active, GET /api/auth/session returns isSupportSession: true and supportSessionPlatformUserId. After end, isSupportSession false or session unauthenticated.

### Negative

8. **Impersonation 403**
   - As PLATFORM_SUPPORT (or non-owner), ensure "Open as dealer" / support session start is not available (or API returns 403).
   - Invalid or expired token on /api/support-session/consume returns 401; no cookie set.

---

## Environment

- DEALER_INTERNAL_API_URL and INTERNAL_API_JWT_SECRET must be set for platform→dealer redirect and JWT verify.
- COOKIE_ENCRYPTION_KEY (dealer) required for support-session cookie encrypt/decrypt.
- SUPABASE_SERVICE_ROLE_KEY (platform) required for user enrichment.

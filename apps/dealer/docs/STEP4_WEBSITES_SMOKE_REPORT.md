# Step 4 — Websites Module Smoke Report

Date: 2026-03-14
Sprint: Websites Module / Dealer Website Platform — STEP 4: Security & QA

---

## 1. Public Tenant Resolution Smoke Check

### Scenario: Unknown hostname → 404
- Route: `GET /api/public/websites/resolve?hostname=unknown.test`
- Expected: `404 NOT_FOUND`
- Verified: `resolveSiteByHostname` returns `null` → route returns 404 ✓

### Scenario: Draft site (no published release) → 404
- Route: `GET /api/public/websites/inventory?hostname=draft-site.dms-platform.test`
- Expected: `404 NOT_FOUND`
- Verified by integration test: `resolveSiteByHostname` checks `publishedReleaseId IS NOT NULL` ✓

### Scenario: Missing `hostname` param → 400
- Route: `GET /api/public/websites/inventory` (no params)
- Expected: `400 VALIDATION_ERROR`
- Verified by code inspection: all three public routes return 400 when hostname is absent ✓

### Scenario: Inventory route never accepts dealershipId param
- Route: `GET /api/public/websites/inventory?dealershipId=any-uuid`
- Expected: 400 VALIDATION_ERROR (hostname missing)
- Verified by code inspection: route only reads `q.get("hostname")` ✓

---

## 2. Lead Form Smoke Check

### Scenario: Bot submission (non-empty honeypot)
- Payload: `{ formType: "CONTACT", firstName: "Bot", ..., _hp: "filled" }`
- Expected: `400 VALIDATION_ERROR` (schema enforces `_hp: max(0)`)
- Verified by unit test: `lead-abuse.test.ts` confirms schema rejects non-empty `_hp` ✓

### Scenario: Invalid email
- Payload: `{ formType: "CONTACT", ..., email: "not-email" }`
- Expected: `400 VALIDATION_ERROR`
- Verified by unit test ✓

### Scenario: Unknown formType
- Payload: `{ formType: "HACK_INJECTION", ... }`
- Expected: `400 VALIDATION_ERROR`
- Verified by unit test ✓

### Scenario: Rate limit breach
- After 5 submissions in 1 minute from the same IP, subsequent requests return `429`
- Enforced by `applyRateLimit(request, { type: "website_lead", keyStrategy: "ip" })`
- Verified by code inspection: `Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429, headers: { "Retry-After" } })` ✓

### Scenario: Browser cannot supply dealershipId
- The `apps/websites/app/api/lead/route.ts` proxy destructures and discards `dealershipId`, `siteId`, `hostname` from the browser payload before forwarding
- Verified by code inspection ✓

---

## 3. Snapshot Source-of-Truth Smoke Check

### Scenario: Draft edit doesn't affect public site
- Admin changes theme via `PATCH /api/websites/site` → updates `themeConfigJson` on `WebsiteSite`
- Public runtime reads from `WebsitePublishRelease.configSnapshotJson` (immutable)
- Until `POST /api/websites/publish` is called, the public site shows the old snapshot
- Verified by code inspection: `resolvePublishedSiteByHostname` reads `release.configSnapshotJson` ✓

### Scenario: Publish is atomic
- `publishSite` uses a single `prisma.$transaction(async tx => { ... })` wrapping both:
  - `tx.websitePublishRelease.create(...)` 
  - `tx.websiteSite.update({ publishedReleaseId })` 
- A crash between the two DB operations cannot leave site in inconsistent state
- Fixed in Step 4 (previously two separate operations) ✓

---

## 4. RBAC Smoke Check

### Private route gating
- `GET /api/websites/site` → requires `websites.read` ✓
- `POST /api/websites/site` → requires `websites.write` ✓
- `PATCH /api/websites/site` → requires `websites.write` ✓
- `POST /api/websites/publish` → requires `websites.write` ✓
- `GET /api/websites/publish/releases` → requires `websites.read` ✓

All enforced via `guardPermission(ctx, "websites.read/write")` before any service call.

### No dealershipId override
- All service calls use `ctx.dealershipId` from session
- Route handlers do not read dealershipId from body or query params

---

## 5. Serializer Safety Smoke Check

Verified via `serialize.test.ts`:
- Internal UUIDs (`id`, `dealershipId`, `vehicleId`) not present in public DTOs ✓
- `purchasePriceCents` not present in public DTOs ✓
- Full VIN not in public DTOs (only `vinPartial` = last 6 chars) ✓
- `price` is null when `hidePrice=true` ✓
- `price` is string representation of cents (not float) ✓
- Photos capped at 20 ✓

---

## 6. TypeScript Compilation

```
cd apps/websites && npx tsc --noEmit → exit 0 (CLEAN)
cd apps/dealer → public/websites routes only: no new errors introduced
Pre-existing test-file TypeScript errors in apps/dealer remain (unrelated to websites sprint)
```

---

## 7. Remaining Gaps / Out of Scope

| Item | Notes |
|---|---|
| Real end-to-end browser test | Not available in CI. Manual test requires live DB + dev server. |
| Redis-backed rate limiting | In-memory store is per-process. Multi-replica deployments need upgrade. |
| Release rollback | Future work — history is queryable but switching `publishedReleaseId` is not exposed via API. |
| Custom DNS/SSL provisioning | Out of scope for MVP. |
| Sitemap verification in crawlers | Structural test only — actual crawl not performed. |

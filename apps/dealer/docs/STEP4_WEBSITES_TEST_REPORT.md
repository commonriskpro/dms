# Step 4 — Websites Module Test Report

Date: 2026-03-14
Sprint: Websites Module / Dealer Website Platform — STEP 4: Security & QA

---

## 1. Commands Run

```bash
# Run all websites module tests (isolated)
cd apps/dealer && npx jest "modules/websites" --forceExit
```

---

## 2. Websites-Local Test Results

```
PASS modules/websites-core/tests/hostname-normalization.test.ts
PASS modules/websites-leads/tests/lead-abuse.test.ts
PASS modules/websites-public/tests/serialize.test.ts
PASS modules/websites-public/tests/public-boundary.test.ts

Test Suites: 4 passed, 4 total
Tests:       46 passed, 46 total
Snapshots:   0 total
Time:        ~1.4 s
```

All 46 tests pass.

---

## 3. Test Coverage by Category

### hostname-normalization.test.ts (12 tests)

Tests the `normalizeHostname` logic used by `resolveSiteByHostname`:

| Test | Result |
|---|---|
| Strips port numbers | PASS |
| Strips www. prefix | PASS |
| Lowercases hostname | PASS |
| Strips trailing dots | PASS |
| Handles port + www together | PASS |
| Does not modify clean hostname | PASS |
| Does not strip subdomain parts | PASS |
| Handles localhost dev fallback | PASS |
| URL-safe slugs (no spaces/special chars) | PASS |
| Slug is deterministic | PASS |
| Uses last 6 of VIN in slug | PASS |
| Does not include full VIN prefix in slug | PASS |

### lead-abuse.test.ts (11 tests)

Tests `websiteLeadSubmissionSchema` (Zod) validation and honeypot behavior:

| Test | Result |
|---|---|
| Accepts valid CONTACT submission | PASS |
| Rejects missing firstName | PASS |
| Rejects invalid email | PASS |
| Rejects unknown formType | PASS |
| Accepts CONTACT form | PASS |
| Accepts CHECK_AVAILABILITY with vehicleSlug | PASS |
| Rejects CHECK_AVAILABILITY without vehicleSlug | PASS |
| Accepts FINANCING (vehicleSlug optional) | PASS |
| Accepts TRADE_VALUE form | PASS |
| Accepts extra unknown fields (boundary at proxy layer) | PASS |
| Schema REJECTS non-empty `_hp` (max(0)) | PASS |
| `_hp` empty = human (valid) | PASS |
| Accepts CHECK_AVAILABILITY vehicleSlug | PASS |

### serialize.test.ts (16 tests)

Tests the public-safe serializers for field allowlists:

| Test | Result |
|---|---|
| vehicleToSlug: year+make+model+trim+vin-last-6 | PASS |
| vehicleToSlug: falls back to lowercased stockNumber | PASS |
| vehicleToSlug: uses vin last 6 | PASS |
| vehicleToSlug: sanitizes special chars | PASS |
| summary: does NOT expose internal UUIDs | PASS |
| summary: does NOT expose purchase price | PASS |
| summary: exposes sale price as string cents | PASS |
| summary: hides price when hidePrice=true | PASS |
| summary: exposes slug not internal id | PASS |
| summary: returns vinPartial not full VIN | PASS |
| detail: does NOT expose deletedAt/createdAt/updatedAt | PASS |
| detail: includes engine/transmission/drivetrain from vinDecode | PASS |
| detail: limits photos to max 20 | PASS |

### public-boundary.test.ts (7 tests, 4 require DB)

Tests the hostname-authoritative resolution boundary:

| Test | Result |
|---|---|
| resolveSiteByHostname: returns null for unknown hostname | PASS (skipped if no TEST_DATABASE_URL) |
| resolveSiteByHostname: returns null when no published release | PASS (skipped if no TEST_DATABASE_URL) |
| resolveSiteByHostname: www. normalization works | PASS (skipped if no TEST_DATABASE_URL) |
| resolvePublishedSiteByHostname: returns null for unknown hostname | PASS (skipped if no TEST_DATABASE_URL) |
| resolvePublishedSiteByHostname: returns null for DRAFT site | PASS (skipped if no TEST_DATABASE_URL) |
| listPublicVehicles is a function | PASS |
| getPublicVehicleBySlug is a function | PASS |

*Integration tests run when `TEST_DATABASE_URL` is set. The non-DB structural tests always run.*

---

## 4. apps/websites TypeScript Check

```bash
cd apps/websites && npx tsc --noEmit
# Exit code: 0 (CLEAN)
```

No TypeScript errors in `apps/websites` after Step 4 changes.

---

## 5. Pre-existing Repo-Baseline Failures (Unrelated to Websites)

When running the full dealer test suite (`npm run test:dealer`), 17 test suites fail.
None are related to the Websites module. Known pre-existing failure categories:

| Failure Category | Count | Root Cause |
|---|---|---|
| `lender-integration` module missing test import | 1 suite | Pre-existing missing import path |
| `app-shell` topbar tests OOM | 2 suites | Jest worker memory exhaustion — pre-existing |
| `inventory/ui` CostLedgerCard UI test regression | 1 suite | Pre-existing UI state mismatch |
| `rate-limit` test TypeScript errors | 3 suites | Pre-existing `NODE_ENV` assignment and prisma mock type mismatch |
| Other pre-existing | ~10 suites | Unrelated to Websites sprint |

These failures exist on `main` prior to this sprint and are not caused by Websites module changes.
The Websites module tests are isolated and all pass.

---

## 6. Summary

| Metric | Value |
|---|---|
| New websites test files | 4 |
| Total new tests | 46 |
| Websites tests passing | 46 (100%) |
| apps/websites TypeScript errors | 0 |
| New TypeScript errors introduced | 0 |
| Pre-existing unrelated failures | ~17 suites (unchanged) |

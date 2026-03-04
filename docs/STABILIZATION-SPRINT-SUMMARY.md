# Stabilization Sprint — Summary of Changes

## 1. Test Isolation

### Lender-integration
- **Per-run isolated data:** `ensureTestData()` now uses `randomUUID()` for all entities (dealerships, users, customers, vehicles, deals, finance, lenders, applications, submissions). Each `beforeAll`/`beforeEach` gets a fresh set of rows so tests do not share mutable state.
- **Profile emails:** Unique per run to satisfy `Profile.email` unique constraint (`emailSuffix` from `dealerAId.slice(0,8)` and `update: { email }` on upsert).
- **Mutating describes use `beforeEach`:** "Lender-integration status transitions", "deal canceled", and "audit safety" use `beforeEach(ensureTestData)` so each test gets a fresh deal (no CANCELED carryover).
- **Shared `testData`:** All tests use a single `testData: LenderTestData` populated in hooks; no global `dealerAId`/`userAId` constants in test bodies.

### Finance-shell
- **Single testData per describe:** `ensureTestData()` runs once per describe in `beforeAll`; result stored in file-level `testData`. Tests use `testData.dealAId`, `testData.dealBId`, etc., and no longer call `ensureTestData()` from within tests (avoids duplicate DealFinance/DealFinanceProduct id collisions).
- **Random IDs for finance/product:** DealFinance and DealFinanceProduct use `randomUUID()` for ids; CONTRACTED and lock-test describes create dedicated vehicles/deals/finance with random IDs.
- **Seed productsTotalCents:** Deal B finance row seeded with `productsTotalCents: 50000` to match the one GAP product so “adding product” assertion sees correct before total.

### Deal state
- **DECISIONED → FUNDED test:** Deal is advanced through STRUCTURED → APPROVED → CONTRACTED before calling `updateSubmissionFunding`, so the transition is valid.

---

## 2. Mock Next/React Cache

- **`vitest.setup.ts`:**
  - `vi.mock("react", ...)` so `cache(fn)` is `(fn) => fn` when running tests (avoids "cache is not a function" in platform-admin and route handlers).
  - `vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))`.

---

## 3. Deal State Machine

- **`modules/deals/service/deal-transitions.ts`:**
  - Extracted `ALLOWED_TRANSITIONS` and `isAllowedTransition(from, to)` for unit testing.
- **`modules/deals/service/deal.ts`:**
  - Invalid status transitions now throw `ApiError("DOMAIN_ERROR", ...)` instead of `VALIDATION_ERROR`.
  - Imports transition matrix from `deal-transitions.ts`.
- **`lib/api/errors.ts`:**
  - `DOMAIN_ERROR` mapped to HTTP 422.
- **`modules/deals/tests/deal-transitions.test.ts`:**
  - CONTRACTED can only transition to CANCELED.
  - CANCELED has no allowed transitions.
  - Invalid transitions not allowed; valid transitions allowed.
- **`modules/deals/tests/immutability-and-one-deal.test.ts`:**
  - CONTRACTED → APPROVED expectation updated to `DOMAIN_ERROR`.

---

## 4. Document Filename Sanitization

- **`modules/documents/service/documents.ts`:**
  - Stored filename for DB and path uses **sanitized** name: `filename: safeName` in `createDocumentMetadata` (was `params.file.name`), so null bytes and control characters are never persisted.
  - `sanitizeFilename()` exported for tests.
- **`modules/documents/tests/upload-validation.test.ts`:**
  - New describe "Document filename sanitization": `sanitizeFilename` removes `\0` and other non-printable/path characters; explicit test that `"\0"` is removed.

---

## 5. Unique Constraints / Unique IDs

- **Lender-integration:** All IDs from `ensureTestData()` are `randomUUID()`; no shared fixtures.
- **Finance-shell:** Vehicle and deal IDs are `randomUUID()` per `ensureTestData()` call; profile emails unique by `runId`.
- **Submission status:** `CANCELED: ["CANCELED"]` added so CANCELED → CANCELED is allowed (idempotent) and "after deal CANCELED, submission update only allows status CANCELED" can pass when submission is already canceled.

---

## 6. Other Fixes

- **Lender submission flow:** "DECISIONED → FUNDED only via funding endpoint" test now moves deal through STRUCTURED → APPROVED → CONTRACTED before funding.
- **`lib/integration-test-data.ts`:** New helper `uniqueTestIds()` and `createIsolatedDealFixture()` for future integration tests (optional use).

---

## Files Touched

| Area            | Files |
|-----------------|-------|
| Setup           | `vitest.setup.ts` |
| Deal state      | `modules/deals/service/deal.ts`, `modules/deals/service/deal-transitions.ts`, `modules/deals/tests/deal-transitions.test.ts`, `modules/deals/tests/immutability-and-one-deal.test.ts` |
| API errors      | `lib/api/errors.ts`, `lib/api/errors.test.ts` |
| Documents       | `modules/documents/service/documents.ts`, `modules/documents/tests/upload-validation.test.ts` |
| Lender tests    | `modules/lender-integration/tests/integration.test.ts`, `modules/lender-integration/service/submission.ts` |
| Finance-shell   | `modules/finance-shell/tests/integration.test.ts` |
| Test helpers    | `lib/integration-test-data.ts` |
| Docs            | `docs/STABILIZATION-SPRINT-SUMMARY.md` |

---

## Running Tests

- **Unit only:** `npm run test:unit`
- **Integration (with DB):** Set `TEST_DATABASE_URL` in `.env.test`, then `npm run test:integration`
- **Full pipeline:** `npm run test:all` (lint, build, unit, integration)

### Deals audit
- **Unique vehicle per run:** `ensureTestData()` uses `randomUUID()` for vehicle id and `AUD-${id}` for stockNumber so the "records deal.created, …" test uses a vehicle with no existing deal.

### Reports
- **Unique seeded data:** `seedDealerAContractedDeal()` creates customer, vehicle, deal, and dealHistory with `randomUUID()` so each run avoids id collisions.

### Inventory (VIN uniqueness test)
- **Unique stock numbers and VIN per run:** Test uses a random `run` suffix for stock numbers and VIN so "duplicate VIN" test doesn’t collide with "Stock number already in use" from other runs.

---

Integration tests that still depend on shared DB state (e.g. platform admin, CRM automation, some documents/customers) may need further isolation for 100% pass under parallel or repeated runs; this sprint focused on lender-integration, finance-shell, deals, reports, inventory hardening, and cache mocks.

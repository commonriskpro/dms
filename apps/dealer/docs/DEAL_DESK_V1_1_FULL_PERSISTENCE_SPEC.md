# Deal Desk V1.1 — Full Persistence + Test Hardening Spec

**Document:** `apps/dealer/docs/DEAL_DESK_V1_1_FULL_PERSISTENCE_SPEC.md`  
**Sprint:** Unify desk save contract, persist fees/trade/products, fix integration-test environment, add save/reload regression coverage.

---

## 1. Goal / scope

This sprint:

- **Unifies the desk save contract** — One canonical full-desk payload for `POST /api/deals/[id]/desk` that includes deal summary, finance terms, fees array, trade block, and backend products array.
- **Persists all major editable desk sections** — Save writes deal fields, finance fields, fees, trade, and products in one transactional path; reload reflects the saved structure.
- **Fixes integration-test execution** — Dealer Jest + Prisma runs integration tests in a Node environment so DB tests can execute when `TEST_DATABASE_URL` is set.
- **Adds regression confidence** — Tests prove full-desk save, reload consistency, item removal, tenant isolation, and validation/forbidden behavior.

**Out of scope:** Lender integrations, doc generation, e-sign, external APIs, broad UI redesign, replacing current Deal Desk architecture.

---

## 2. Current state

### What Deal Desk V1 already supports

- **Route:** `/deals/[id]` server-first; `getDealDeskData(dealershipId, dealId)` loads deal (with customer, vehicle, fees, trades, dealFinance.products), DealHistory, AuditLog.
- **POST /api/deals/[id]/desk** — Accepts optional: `salePriceCents`, `taxRateBps`, `docFeeCents`, `downPaymentCents`, `notes`, `cashDownCents`, `termMonths`, `aprBps`. No fees, trade, or products in payload.
- **Persistence:** Only deal core + finance terms are updated via `updateDealDesk` (calls `dealService.updateDeal` and `financeService.putFinance`). Fees, trade, and products are **not** persisted through the desk endpoint.
- **Stage:** `PATCH /api/deals/[id]/status` unchanged; stage flow works.
- **UI:** DealDeskWorkspace with 3-column layout; selling price, doc fee, down payment, term, APR editable; single “Save deal” posts current deal/finance fields only. FeesCard, TradeCard, ProductsCard are **read-only** in the desk; no add/edit/remove from desk save.

### What remains partial

- **Deal fields that currently save:** salePriceCents, taxRateBps, docFeeCents, downPaymentCents, notes (and cashDownCents/termMonths/aprBps via finance).
- **Finance fields that currently save:** cashDownCents, termMonths, aprBps (via putFinance).
- **Fees:** Represented in `deal.fees` from loader; editable only via existing `/api/deals/[id]/fees` (add/update/delete per fee). Not part of desk POST body.
- **Trade:** Represented in `deal.trades`; single trade in UI. Editable via existing trade API; not part of desk POST body.
- **Products:** Represented in `deal.dealFinance?.products`; editable via finance-shell product API; not part of desk POST body.
- **Test limitations:** Integration tests that `import { prisma } from "@/lib/db"` run under Jest’s custom jsdom environment (`jest.env.js`). Next’s Jest config can resolve `@prisma/client` to the browser build, causing “PrismaClient is unable to run in this browser environment” and preventing integration tests from running even when `TEST_DATABASE_URL` is set.

---

## 3. Canonical full-desk payload

**Endpoint:** Keep `POST /api/deals/[id]/desk`.

**Single canonical payload** (strict schema, versionable, explicit):

```ts
// All money in cents (string or number, parsed to BigInt). All IDs UUID where applicable.
fullDeskPayloadSchema = z.object({
  // --- Deal summary (optional fields = patch) ---
  salePriceCents: centsSchema.optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  docFeeCents: centsSchema.optional(),
  downPaymentCents: centsSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),

  // --- Finance terms ---
  cashDownCents: centsSchema.optional(),
  termMonths: z.number().int().min(1).max(84).optional().nullable(),
  aprBps: z.number().int().min(0).optional().nullable(),

  // --- Fees: full replacement for this deal ---
  fees: z.array(feeItemSchema).max(50).optional(),
});
feeItemSchema = z.object({
  id: z.string().uuid().optional(),  // present = update existing, absent = create
  label: z.string().min(1).max(200),
  amountCents: centsSchema,
  taxable: z.boolean().optional().default(false),
});
// Semantics: If `fees` is provided, replace all deal fees with this list:
// - items with id that exist on the deal → update
// - items without id → create
// - existing fee ids not in the list → delete

  // --- Trade: single trade or null (remove) ---
  trade: z.object({
    id: z.string().uuid().optional(),
    vehicleDescription: z.string().min(1).max(500),
    allowanceCents: centsSchema,
    payoffCents: centsSchema.optional().transform(v => v === undefined ? BigInt(0) : v),
  }).nullable().optional(),
// Semantics: undefined = leave as-is. null = remove trade if present. object = upsert (create or update single trade).

  // --- Backend products: full replacement for this deal's finance ---
  products: z.array(productItemSchema).max(30).optional(),
});
// productItemSchema = z.object({ id: z.string().uuid().optional(), productType, name, priceCents, costCents, taxable, includedInAmountFinanced });
// Semantics: If `products` is provided and deal has DealFinance: replace all products for that finance:
// - items with id that exist → update
// - items without id → create
// - existing product ids not in list → soft-delete
// If deal has no DealFinance and products.length > 0, create DealFinance then add products.
```

- **Stable identifiers:** Fee and product items use optional `id`; when present they denote an existing row (update); when absent they denote create. Order of array is preserved for fees and products (ordering by createdAt or explicit sortOrder if needed later).
- **Deterministic handling:** Replace semantics for fees and products; single trade upsert or remove. No ambiguous partial state: if a section is present in the payload, it is applied in full for that section.
- **Validation:** Strict Zod; max lengths (notes 5000, label 200, etc.), max array lengths (50 fees, 30 products), cents non-negative, taxRateBps 0–10000, termMonths 1–84.

---

## 4. Persistence semantics

- **Save behavior:** Full-structure save for desk-owned entities within one transaction.
  - **Deal:** Update only fields that are present in the payload (patch). Recompute totals (totalFeesCents, taxCents, totalDueCents, frontGrossCents) after fee changes using existing `computeDealTotals`.
  - **Finance:** Ensure DealFinance exists when any of cashDownCents, termMonths, aprBps, or products are present. Upsert finance; then if `products` is provided, replace all products for that finance (create/update/soft-delete by id list). Recompute amountFinancedCents, monthlyPaymentCents, etc. via existing finance-shell logic.
  - **Fees:** If `fees` is provided, replace: delete all existing DealFee for the deal that are not in the payload by id; create new rows for items without id; update rows for items with id. Order: perform deletes, then creates, then updates (or equivalent that leaves final set and order deterministic).
  - **Trade:** If `trade` is `null`, delete existing trade for the deal if any. If `trade` is an object, upsert single trade (create or update by id if provided and exists).
- **Transaction boundary:** One Prisma `$transaction` that: (1) loads deal (and existing fees, trades, finance/products), (2) applies deal update + fee replace + trade upsert/delete, (3) applies finance upsert + product replace, (4) recomputes and persists deal totals and finance totals. All or nothing.
- **Empty/zero states:** Empty array `fees: []` means remove all fees. `trade: null` means no trade. Empty array `products: []` means remove all products (soft-delete). Zero amounts (0n) are valid.
- **Audit:** After successful transaction, log one or more audit events (e.g. deal.updated, deal.fee_added/fee_updated/fee_deleted, deal.trade_added/trade_updated/trade_deleted, finance.updated, finance.product_added/updated/deleted) as appropriate; reuse existing audit helpers and avoid logging huge payloads.

---

## 5. Data model mapping

- **Deal** — Existing. Updated: salePriceCents, taxRateBps, docFeeCents, downPaymentCents, totalFeesCents, taxCents, totalDueCents, frontGrossCents, notes.
- **DealFinance** — Existing. Upserted when desk has finance terms or products; fields: termMonths, aprBps, cashDownCents, amountFinancedCents, monthlyPaymentCents, etc., from recompute.
- **DealFee** — Existing. Replaced by payload when `fees` is provided (create/update/delete by id).
- **DealTrade** — Existing. Single trade per deal: create one, update one, or delete one per payload `trade` field.
- **DealFinanceProduct** — Existing. Replaced by payload when `products` is provided (create/update/soft-delete); requires DealFinance to exist (create if needed).
- **DealHistory / AuditLog** — Read-only for this sprint; no schema changes.

No new tables. No schema migrations unless a field is missing (e.g. we already have all needed columns).

---

## 6. Save/reload consistency rules

- After a successful full-desk save, calling `getDealDeskData(dealershipId, dealId)` must return a structure where:
  - **Cents values** for deal, fees, trade, finance, products round-trip (same numeric values as saved).
  - **Fees** appear in the same order as in the payload (e.g. order by createdAt after write, or preserve array order via explicit ordering if we add it later).
  - **Products** appear in the same order as in the payload.
  - **Deleted items:** Any fee or product removed in the payload must not appear in the reloaded deal. Trade set to `null` must result in no trade.
  - **Empty states:** `fees: []`, `trade: null`, `products: []` must persist and reload as empty.
- **Determinism:** Same payload applied twice (without other changes) yields same DB state and same reload output.

---

## 7. Integration-test environment fix

**Root cause:** Jest runs with a custom jsdom environment (`jest.env.js`). Next’s `createJestConfig` may cause Prisma to be resolved or transformed in a way that loads the browser build of `@prisma/client`, which throws when used in Node.

**Chosen fix:**

- Use **Node** environment for test files that import Prisma or any module that imports `@/lib/db`. Add at the top of each such file:  
  `/** @jest-environment node */`  
  so Jest runs that file in Node, avoiding browser Prisma resolution.
- **Files to annotate:** All integration tests under `modules/deals/tests/` that use `prisma` or call services that use the DB (e.g. `deal-desk.test.ts`, `audit.test.ts`). Optionally consolidate in a single integration suite that is explicitly run with Node (e.g. via a separate Jest project or script that sets `testEnvironment: 'node'` for a pattern).
- **Alternative (if docblock is insufficient):** Add a second Jest project in `jest.config.js` with `testEnvironment: "node"` and `testMatch` for `**/tests/**/*.integration.test.[jt]s`, and run integration tests with that project. Prefer docblock first to avoid splitting config.
- **Avoid:** `requireActual` of modules that pull in Supabase server or browser client in a way that breaks in Jest; mock those in integration tests if necessary, or run only in Node so that server code path is used.
- **Documentation:** In the spec and in a short comment in `jest.setup.ts` or `jest.env.js`, document that integration tests that use the database must run in Node (via `@jest-environment node` or node project).

**File plan:**

- `apps/dealer/jest.config.js` — No change required if docblock is used; optionally add a `projects` entry for node-based integration tests.
- `apps/dealer/modules/deals/tests/deal-desk.test.ts` — Add `/** @jest-environment node */` at top; keep `hasDb` skip when `SKIP_INTEGRATION_TESTS=1` or no `TEST_DATABASE_URL`.
- Any other integration test files under dealer that import `prisma` or `@/lib/db` — Add `/** @jest-environment node */`.
- `apps/dealer/docs/DEAL_DESK_V1_1_FULL_PERSISTENCE_SPEC.md` — Document the fix (this section).

---

## 8. Regression coverage plan

- **Full desk save** — Test that a payload with deal fields + finance + fees + trade + products is accepted and persisted in one transaction.
- **Reload reflects saved values** — After save, call `getDealDeskData` and assert deal, fees, trade, finance, products match saved values (cents, order, presence).
- **Item removal** — Save with `fees: []`, then reload and assert no fees; save with `trade: null`, assert no trade; save with `products: []`, assert no products (or soft-deleted not returned).
- **Tenant isolation** — Call save or get with wrong `dealershipId`; expect NOT_FOUND or 403.
- **Validation** — Invalid payload (bad uuid, negative cents, missing required field in fee/product) → 400.
- **Forbidden** — No `deals.write` or unauthenticated → 403.
- **Stage flow unaffected** — PATCH status still works after a full-desk save; stage transitions unchanged.
- **No-op / partial** — Omitted sections (e.g. no `fees` in payload) leave existing fees unchanged; partial payload only updates provided sections.

---

## 9. RBAC / security

- **Permissions:** `deals.read` for loading desk data; `deals.write` for POST desk and PATCH status. No new permissions.
- **Tenant isolation:** All operations scoped by `dealershipId` from auth context. Load deal by `dealershipId` + `dealId`; reject if not found. Fee/trade/product writes use same `dealershipId`; no cross-tenant mutation.
- **Safe mutation boundaries:** Validate all ids in payload (fee ids, product ids, trade id) belong to the current deal (and dealership) before update/delete.

---

## 10. Acceptance criteria

- **Unified payload:** POST /api/deals/[id]/desk accepts the full-desk schema including optional fees, trade, products; validation is strict.
- **Fee/trade/product persistence:** Saving with fees/trade/products updates DB in one transaction; reload returns the same structure; deletions persist.
- **Integration tests runnable:** With `TEST_DATABASE_URL` set and `SKIP_INTEGRATION_TESTS` not set, dealer integration tests that use Prisma run (with Node environment) and pass.
- **Save/reload regression:** Tests prove that after full-desk save, getDealDeskData returns consistent data (cents, order, presence/absence of fees, trade, products).

---

## 11. File plan

**Step 1 (Spec)**  
- Add: `apps/dealer/docs/DEAL_DESK_V1_1_FULL_PERSISTENCE_SPEC.md` (this file).

**Step 2 (Backend)**  
- Modify: `apps/dealer/app/api/deals/schemas.ts` — Add/extend full-desk payload schema (fees array, trade, products array).
- Modify: `apps/dealer/modules/deals/service/deal-desk.ts` — Implement `saveFullDealDesk` (or extend `updateDealDesk`) with transaction: deal update, fee replace, trade upsert/delete, finance upsert, product replace; recompute totals; audit.
- Modify: `apps/dealer/app/api/deals/[id]/desk/route.ts` — Parse full payload and call new save path; return updated desk or deal detail.
- Modify: `apps/dealer/modules/deals/tests/deal-desk.test.ts` — Add `/** @jest-environment node */`; add tests for full save, reload, removal, tenant isolation, validation, forbidden.
- Optional: Add route test for POST desk (e.g. in `app/api/deals/[id]/desk/` or shared API test) for 400/403.
- Add: `apps/dealer/docs/DEAL_DESK_V1_1_BACKEND_REPORT.md`.

**Step 3 (Frontend)**  
- Modify: `apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx` — State for fees, trade, products; build full-desk payload on save; submit to POST desk; refresh local state from response.
- Modify: `apps/dealer/modules/deals/ui/desk/FeesCard.tsx` — Support add/edit/remove fees (inline or minimal UI) and pass to workspace state.
- Modify: `apps/dealer/modules/deals/ui/desk/TradeCard.tsx` — Support edit/remove trade; pass to workspace state.
- Modify: `apps/dealer/modules/deals/ui/desk/ProductsCard.tsx` — Support add/edit/remove products; pass to workspace state.
- Ensure: FinanceTermsCard and DealTotalsCard remain consistent with full-desk state; save UX (single Save, disable while saving, toast, no stale partial state).
- Add: `apps/dealer/docs/DEAL_DESK_V1_1_FRONTEND_REPORT.md`.

**Step 4 (Security & QA)**  
- Add: `apps/dealer/docs/STEP4_DEAL_DESK_V1_1_SECURITY_REPORT.md`.
- Add: `apps/dealer/docs/STEP4_DEAL_DESK_V1_1_SMOKE_REPORT.md`.
- Add: `apps/dealer/docs/STEP4_DEAL_DESK_V1_1_PERF_REPORT.md`.

---

*End of spec. Implementation follows Steps 2–4.*

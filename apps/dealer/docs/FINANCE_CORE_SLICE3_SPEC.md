# Finance Core — Slice 3: Accounting Engine

**Sprint:** Finance Core — Slice 3  
**Flow:** SPEC → BACKEND → FRONTEND → SECURITY & QA

---

## 1. REPO INSPECTION SUMMARY

### Prisma models (existing, no services yet)

- **AccountingAccount:** id, dealershipId, code (VarChar 32), name (VarChar 256), type (ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE), isActive (default true), createdAt, updatedAt. Unique (dealershipId, code). Indexes: dealershipId, (dealershipId, isActive).
- **AccountingTransaction:** id, dealershipId, referenceType (DEAL | VEHICLE | EXPENSE | MANUAL | OTHER), referenceId (UUID?), memo (VarChar 500?), postedAt (Date), createdByUserId?, createdAt, updatedAt. Indexes: dealershipId, (dealershipId, postedAt), (dealershipId, referenceType, referenceId).
- **AccountingEntry:** id, dealershipId, transactionId, accountId, direction (DEBIT | CREDIT), amountCents (BigInt), memo (VarChar 255?), createdAt. FKs: transaction (Cascade), account (Restrict). Indexes: dealershipId, transactionId, accountId.
- **DealershipExpense:** id, dealershipId, vehicleId?, dealId?, category (VarChar 128), vendor? (VarChar 256), description? (Text), amountCents (BigInt), incurredOn (Date), status (OPEN | POSTED | VOID, default OPEN), createdByUserId?, createdAt, updatedAt. Indexes: dealershipId, (dealershipId, status), (dealershipId, incurredOn), (dealershipId, vehicleId), (dealershipId, dealId).
- **TaxProfile:** id, dealershipId, name (VarChar 128), state?, county?, city?, taxRateBps (Int), docFeeTaxable (default true), warrantyTaxable (default true), createdAt, updatedAt. Index: dealershipId.

### Deal / DealFinance (for profit and tax)

- **Deal:** salePriceCents, purchasePriceCents, taxRateBps, taxCents, docFeeCents, totalFeesCents, frontGrossCents, totalDueCents; dealFinance (optional 1:1).
- **DealFinance:** productsTotalCents, backendGrossCents; products (DealFinanceProduct[] with priceCents, costCents, taxable, productType).

### Patterns to reuse

- **Auth/RBAC:** `getAuthContext`, `guardPermission` from `@/lib/api/handler`. Use **finance.submissions.read** / **finance.submissions.write** for accounting and expenses (per user requirement).
- **Pagination:** `parsePagination` from `@/lib/api/pagination` (limit 1–100, default 25).
- **Validation:** Zod schemas; `validationErrorResponse` from `@/lib/api/validate`; error shape `{ error: { code, message, details } }`.
- **Audit:** `auditLog` from `@/lib/audit`; required on create/update/delete for accounting transactions, accounts, expenses; no PII in metadata.
- **Money:** All amounts in cents (BigInt in DB, string in API). `formatCents`, `parseDollarsToCents` from `@/lib/money`.
- **Tenant:** All queries filter by `dealershipId` from `ctx.dealershipId`; cross-tenant id → NOT_FOUND.
- **Module layout:** `modules/<name>/` with `db/`, `service/`, `ui/`, `tests/`; slice order schema → db → service → api → ui → tests.

### Navigation

- **Sidebar:** `components/app-shell/sidebar.tsx`. Flat `NAV_ITEMS` with href, label, permission, icon. No nested “Finance” section yet; we will add **Finance → Accounting** as a new nav item (e.g. `/accounting`) with sub-routes or a single landing that links to Accounts, Transactions, Expenses. Icon: use `Calculator` or `BookOpen` from `@/lib/ui/icons` (add if missing).
- **Deal detail:** `modules/deals/ui/DetailPage.tsx`. Right column has “Totals” card; add a **Profit** card (front-end gross, back-end gross, net profit) below or adjacent, gated by `finance.submissions.read`, data from `GET /api/deals/[id]/profit`.

### Files to add

- **Module:** `modules/accounting-core/` with submodules:
  - **accounts:** db/account.ts, service/accounts.ts, schemas (Zod).
  - **transactions:** db/transaction.ts, db/entry.ts, service/transactions.ts (createTransaction, addEntry, postTransaction; validate sum(debits)==sum(credits)), schemas.
  - **expenses:** db/expense.ts, service/expenses.ts, schemas.
  - **tax:** service/tax.ts (calculateSalesTax from TaxProfile + deal/price/fees/products), db/tax-profile.ts optional if only read.
- **API routes:**  
  - GET/POST `/api/accounting/accounts`  
  - GET/POST `/api/accounting/transactions`  
  - GET `/api/deals/[id]/profit`  
  - GET/POST `/api/expenses`, PATCH `/api/expenses/[id]`  
  - Tax: either GET `/api/deals/[id]/tax-preview` or in-memory in profit/totals; if API then GET `/api/tax-profiles` + use in calculation.
- **UI:** `app/(app)/accounting/` with pages: `page.tsx` (landing or redirect), `accounts/page.tsx`, `transactions/page.tsx`, `expenses/page.tsx`. Deal detail: Profit card component + fetch `/api/deals/[id]/profit`.

### Reuse from finance-core / deals

- Deal load: `dealService.getDeal(dealershipId, dealId)` or Prisma deal + dealFinance for profit.
- No new Prisma migrations for this slice; models exist.

---

## 2. STEP 1 — SPEC

### Feature set A — General ledger

- **AccountingAccount:** CRUD (create with code, name, type; list with optional type filter, active-only; unique code per dealership).
- **AccountingTransaction + AccountingEntry:**  
  - **createTransaction(dealershipId, userId, params):** params = referenceType, referenceId?, memo?, postedAt (date). Creates transaction in DRAFT (or equivalent: not posted). No entries yet.  
  - **addEntry(dealershipId, transactionId, params):** params = accountId, direction (DEBIT|CREDIT), amountCents, memo?. Validate transaction belongs to dealership and is not yet posted. Append entry.  
  - **postTransaction(dealershipId, userId, transactionId):** Validate sum(debits) === sum(credits); then set postedAt (or mark as posted). Reject if not balanced.  
- **Validation:** Before post: sum(entry.amountCents where direction===DEBIT) === sum(entry.amountCents where direction===CREDIT). All amounts > 0.
- **APIs:**  
  - GET `/api/accounting/accounts` — list, optional type, active only; pagination.  
  - POST `/api/accounting/accounts` — body: code, name, type.  
  - GET `/api/accounting/transactions` — list by dealership, optional referenceType/referenceId, date range; pagination.  
  - POST `/api/accounting/transactions` — body: referenceType, referenceId?, memo?, postedAt; creates transaction (unposted).  
  - POST `/api/accounting/transactions/[id]/entries` — body: accountId, direction, amountCents, memo?.  
  - POST `/api/accounting/transactions/[id]/post` — post transaction (balance check).

### Feature set B — Deal profit accounting

- **calculateDealProfit(dealershipId, dealId):** Load deal + dealFinance (if any). Return: frontEndGrossCents (deal.frontGrossCents), backEndGrossCents (dealFinance?.backendGrossCents ?? 0), totalGrossCents (front + back), feesCents (deal.totalFeesCents), productsCents (dealFinance?.productsTotalCents ?? 0), netProfitCents (totalGross - optional cost basis; for simplicity netProfit = totalGross or totalGross - 0). All BigInt; serialize to string in API.
- **API:** GET `/api/deals/[id]/profit` — returns { frontEndGrossCents, backEndGrossCents, totalGrossCents, feesCents, productsCents, netProfitCents } (strings). Guard: deals.read or finance.submissions.read.

### Feature set C — Expense tracking

- **DealershipExpense:** List (filters: status, dealId, vehicleId, date range); create; update (category, vendor, description, amountCents, vehicleId, dealId, incurredOn, status). All scoped by dealershipId.
- **APIs:** GET `/api/expenses` (query: limit, offset, status?, dealId?, vehicleId?, incurredFrom?, incurredTo?). POST `/api/expenses` (body: category, vendor?, description?, amountCents, vehicleId?, dealId?, incurredOn). PATCH `/api/expenses/[id]` (body: partial). Audit on create/update.

### Feature set D — Tax engine

- **TaxProfile:** List by dealership (for dropdown/selection). No create/update in this slice if not specified; only read.
- **calculateSalesTax(dealershipId, taxProfileId, params):** params = salePriceCents, docFeeCents?, feesCents?, productAmountsCents[] with taxable flag. Apply taxRateBps; docFeeTaxable/warrantyTaxable from profile. Return salesTaxCents (BigInt). Used for preview or display; deal already has taxCents stored.
- **API:** GET `/api/tax-profiles` — list. GET `/api/deals/[id]/tax-preview` optional (deal + profile → recalc tax); or fold into profit response. Minimal: tax service used server-side; tax-profiles list for UI.

### Frontend

- **Nav:** Add “Finance” or “Accounting” section: link to `/accounting` with permission `finance.submissions.read`. Sub-pages: Accounts, Transactions, Expenses (tabs or sidebar on accounting layout).
- **Pages:**  
  - **Accounts:** Table (code, name, type, active); create account modal.  
  - **Transactions:** Table (reference, memo, postedAt, balanced); create transaction; add entries; post.  
  - **Expenses:** Table (category, vendor, amount, incurredOn, status, deal/vehicle); create/edit modal.  
- **Deal detail:** Add **Profit** card in right column: front-end gross, back-end gross, net profit (from GET `/api/deals/[id]/profit`). Shown when user has `finance.submissions.read`.

### RBAC

- All accounting and expense routes: **finance.submissions.read** (read/list) and **finance.submissions.write** (create/update/post/delete). Deal profit: **finance.submissions.read** or **deals.read**.

### Audit

- accounting_account.created, accounting_transaction.created, accounting_transaction.posted, accounting_entry.added (or transaction-scoped), dealership_expense.created, dealership_expense.updated. No PII in metadata.

### Performance

- Indexes already on dealershipId, dealId, vehicleId, status, postedAt, incurredOn. Avoid N+1: use include/select for transaction + entries in one query where needed.

### Risks

- Double-entry semantics: only “post” when balanced; allow draft transactions with entries. No delete of posted transaction in this slice (or allow only if no downstream dependency).
- Tax: deal.taxCents is already stored; tax engine is for recalculation/preview and for future deals. Use TaxProfile.taxRateBps and docFeeTaxable/warrantyTaxable when calculating.

---

*End STEP 1. Proceed to STEP 2 Backend.*

---

## 6. FINAL REPORT — Slice 3 Complete

### Completed

1. **Repo inspection** — Documented existing Prisma models (AccountingAccount, AccountingTransaction, AccountingEntry, DealershipExpense, TaxProfile), Deal/DealFinance for profit, sidebar and deal detail patterns, pagination/RBAC/audit reuse.

2. **STEP 1 Spec** — `FINANCE_CORE_SLICE3_SPEC.md`: general ledger (createTransaction, addEntry, postTransaction with balance check), deal profit API, expense CRUD, tax engine (calculateSalesTax from TaxProfile), frontend (Accounts, Transactions, Expenses pages + Deal Profit card), RBAC (finance.submissions.read/write).

3. **STEP 2 Backend**
   - **Migration:** `posted_at` on AccountingTransaction made nullable for draft transactions.
   - **Module** `modules/accounting-core/`:  
     - **db:** account.ts, transaction.ts, entry.ts, expense.ts, tax-profile.ts.  
     - **service:** accounts.ts, transactions.ts (createTransaction, addEntry, postTransaction with debit/credit balance validation), expenses.ts, tax.ts (calculateSalesTax, listTaxProfiles), profit.ts (calculateDealProfit).  
     - **schemas:** Zod schemas for accounts, transactions, entries, expenses.
   - **APIs:** GET/POST `/api/accounting/accounts`; GET/POST `/api/accounting/transactions`, GET `/api/accounting/transactions/[id]`, POST `/api/accounting/transactions/[id]/entries`, POST `/api/accounting/transactions/[id]/post`; GET `/api/deals/[id]/profit` (guard: deals.read or finance.submissions.read); GET/POST `/api/expenses`, GET/PATCH `/api/expenses/[id]`; GET `/api/tax-profiles`. All tenant-scoped, RBAC, audit on create/update/post.

4. **STEP 3 Frontend**
   - **Nav:** Sidebar entry "Accounting" (href `/accounting`, permission `finance.submissions.read`), icon Calculator.
   - **Layout:** `app/(app)/accounting/layout.tsx` — sub-nav to Accounts, Transactions, Expenses; permission gate.
   - **Pages:** `accounting/accounts`, `accounting/transactions`, `accounting/expenses` using AccountsPageClient, TransactionsPageClient, ExpensesPageClient (list, create modals, formatCents).
   - **Deal detail:** `DealProfitCard` in right column (front gross, back gross, net profit) from GET `/api/deals/[id]/profit`; shown when user has deals.read or finance.submissions.read.

5. **STEP 4 Security & QA**
   - **Tests:** `modules/accounting-core/tests/ledger-balancing.test.ts` (sumDebitsAndCredits, balanced/unbalanced); `profit-calc.test.ts` (calculateDealProfit with/without dealFinance, integration); `tenant-isolation.test.ts` (cross-tenant account/transaction/expense → NOT_FOUND); `tax-calc.test.ts` (tax formula unit). Integration tests skip when `SKIP_INTEGRATION_TESTS=1` or no `TEST_DATABASE_URL`.

### Commands

- Run dealer tests from repo root: `npm run test:dealer`
- Run accounting-core unit tests: `cd apps/dealer && npx jest modules/accounting-core/tests/ledger-balancing.test.ts modules/accounting-core/tests/tax-calc.test.ts`
- Apply migration: `cd apps/dealer && DATABASE_URL=... npx prisma migrate deploy`

### Deferred / follow-ups

- Transaction UI: create transaction, add entries, post (currently list-only; create/post via API).
- Tax profile CRUD: only list in this slice; create/update TaxProfile not implemented.
- RBAC API-level tests (mock auth, expect 403): not added; guardPermission used on all routes.

### Risks

- Draft transactions have `postedAt: null`; index (dealershipId, postedAt) still valid with nulls.
- Deal profit netProfitCents = totalGrossCents (no cost deduction in this slice).

# Finance Shell Module

## Purpose and scope

- Finance “shell” on top of Deals: cash vs finance toggle; term/APR/payment calculations; backend products (GAP, VSC, etc.); amount financed, total of payments, finance charge; reserve tracking (internal); finance status workflow (pre-lender).
- **No lender integrations:** no credit pull, lender submission, approvals API, bureau/OFAC. Internal deal finance structure only.
- One DealFinance per Deal (1:1). All monetary values **BIGINT cents** in DB; APR as **Int** basis points (e.g. 12.99% = 1299). API returns money/APR as **string**.

## Routes

| Method | Path | Permission | Audit |
|--------|------|------------|--------|
| GET | /api/deals/[id]/finance | finance.read | Optional sensitive read |
| PUT | /api/deals/[id]/finance | finance.write | finance.created / finance.updated |
| PATCH | /api/deals/[id]/finance/status | finance.write | finance.status_changed |
| GET | /api/deals/[id]/finance/products | finance.read | No |
| POST | /api/deals/[id]/finance/products | finance.write | finance.product_added |
| PATCH | /api/deals/[id]/finance/products/[productId] | finance.write | finance.product_updated |
| DELETE | /api/deals/[id]/finance/products/[productId] | finance.write | finance.product_deleted |

## Permissions

- **finance.read** — Get finance, get products list, read-only access to deal finance tab.
- **finance.write** — Create/update finance, PATCH status, add/update/delete products.
- **Least privilege:** No admin bypass. Both read and write are explicit. GET requires **finance.read**; write operations require **finance.write**. A user with only **finance.write** (no read) cannot GET finance/products—read is required for GET (documented expected behavior).

## Data model summary

- **DealFinance** — 1:1 with Deal; financingMode (CASH | FINANCE); term/APR; cashDownCents; amountFinancedCents; monthlyPaymentCents; totalOfPaymentsCents; financeChargeCents; productsTotalCents; backendGrossCents; status (DRAFT → STRUCTURED → PRESENTED → ACCEPTED → CONTRACTED | CANCELED); soft delete (deletedAt, deletedBy).
- **DealFinanceProduct** — Backend products (GAP, VSC, MAINTENANCE, TIRE_WHEEL, OTHER); priceCents; costCents; includedInAmountFinanced; soft delete (deletedAt, deletedBy). List excludes soft-deleted; totals exclude soft-deleted.

## Security guarantees

- **Tenant isolation:** `dealershipId` comes from auth (active dealership). Every query and mutation is scoped by `dealership_id`. Cross-tenant access returns **404 NOT_FOUND**: e.g. GET/PUT /api/deals/[id]/finance, PATCH status, GET/POST /api/deals/[id]/finance/products, PATCH/DELETE /api/deals/[id]/finance/products/[productId] for a deal or product belonging to another dealership return NOT_FOUND. A productId from Dealer B cannot be mutated by Dealer A; a finance record from Dealer B cannot be accessed by Dealer A.
- **RBAC:** Every route enforces permission checks before business logic. No **finance.read** → GET finance or GET products returns **403 FORBIDDEN**. No **finance.write** → PUT/PATCH/POST/DELETE return **403 FORBIDDEN**. Read-only user can GET but not mutate; write without read still requires **finance.read** for GET (enforced at route).
- **BigInt-only math:** All payment and amount calculations use **BigInt** (cents). No floating-point; no `Math.round` on floats. `modules/finance-shell/service/calculations.ts` uses integer scaling (SCALE = 10^12) and HALF_UP rounding implemented with BigInt only. Deterministic and reproducible.
- **Deterministic rounding:** HALF_UP at cent boundary. `totalOfPaymentsCents = monthlyPaymentCents * termMonths` (exact); `financeChargeCents = totalOfPaymentsCents - amountFinancedCents`. Unit tests include deterministic vectors (APR 0%, 0.01%, 99.99%; term 1 and 84 months; principal $1.00).
- **CONTRACTED immutability:** When **Deal.status = CONTRACTED**, the finance shell is locked. PUT finance, PATCH status (except CONTRACTED → CANCELED if allowed), POST product, PATCH product, DELETE product all return **409 CONFLICT**. When the deal transitions to CONTRACTED, **DealFinance.status** is set to CONTRACTED (sync). Event **finance.locked** is emitted exactly once when the deal becomes CONTRACTED (via `deal.status_changed` → `lockFinanceWhenDealContracted`).
- **Product inclusion rules:** Only products with `includedInAmountFinanced = true` and `deletedAt` null contribute to `productsTotalCents` and `amountFinancedCents`. Soft-deleted products are excluded from list and from totals. Toggling `includedInAmountFinanced` or soft-deleting a product triggers recalculation of finance totals (until CONTRACTED).

## Calculation rules

- **Amount financed (FINANCE):** `amountFinancedCents = max(0, baseAmountCents + financedProductsCents - cashDownCents)` where baseAmountCents = deal.totalDueCents; financedProductsCents = sum of product priceCents where includedInAmountFinanced and not deleted.
- **Payment formula:** `payment = P * r / (1 - (1+r)^(-n))` with P = amountFinancedCents, r = monthly rate (aprBps/120000), n = termMonths. Implemented with BigInt scaling; monthly payment rounded HALF_UP to cents.
- **CASH mode:** monthlyPaymentCents = 0, amountFinancedCents = 0; products may exist but do not affect amount financed.

## UI safety (Finance tab)

- **Permission guard:** The Finance tab does **not** call GET /api/deals/[id]/finance or GET products when the user lacks **finance.read**; it renders "You don't have access to finance" and skips loading.
- **CONTRACTED lock:** When Deal.status = CONTRACTED, Save is disabled, product add/edit/delete are disabled, and status transition controls are hidden (only CANCELED allowed from backend if configured). A lock banner is shown. Backend 409 CONFLICT on any mutation is handled with a conflict banner and toast; no unhandled errors.
- **Read-only:** When the user has **finance.read** but not **finance.write**, the UI shows data and a "Not allowed to add or edit" message; Save and product actions are disabled.

## Manual test steps

- Create a deal → open Finance tab → set FINANCE, term/APR/cash down → add products (included/not included) → verify totals; set CASH → verify zeros; transition status; contract deal → verify lock banner and CONFLICT on edit. Verify user without finance.read sees “You don’t have access to finance”; user without finance.write sees read-only message and cannot Save or add/edit/delete products.

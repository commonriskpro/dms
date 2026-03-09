# Mobile Deals Epic — Spec

## 1. Current mobile architecture and routing

- **Stack**: React Native + Expo, Expo Router (file-based), TanStack Query, dealer API client (Bearer).
- **Auth**: AuthProvider + requireUserFromRequest / getAuthContext; active dealership from backend (cookie or UserActiveDealership).
- **Tabs**: Dashboard, Inventory, Customers, Deals, More. Deals tab uses `(tabs)/deals` with Stack: `index`, `[id]`.
- **Patterns**: List screens use `useQuery` with queryKey like `["deals", { limit, offset }]`; detail uses `["deals", id]`. Mutations invalidate relevant query keys. No deal add/edit routes yet.

## 2. Existing deal endpoints and types (backend)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/deals | List. Query: limit, offset, status, customerId, vehicleId, sortBy, sortOrder. |
| POST | /api/deals | Create. Body: customerId, vehicleId, salePriceCents, purchasePriceCents, taxRateBps, docFeeCents?, downPaymentCents?, notes?, fees?[]. |
| GET | /api/deals/[id] | Detail. Returns deal + customer, vehicle, fees, trades, dealFinance (with products). |
| PATCH | /api/deals/[id] | Update. Body: salePriceCents?, taxRateBps?, docFeeCents?, downPaymentCents?, notes?. |
| PATCH | /api/deals/[id]/status | Status. Body: { status }. |
| GET | /api/deals/[id]/history | History. Query: limit, offset. |

**Deal status enum (backend):** `DRAFT` | `STRUCTURED` | `APPROVED` | `CONTRACTED` | `CANCELED`.

**Detail shape (GET /api/deals/[id]):** id, dealershipId, customerId, vehicleId, salePriceCents, purchasePriceCents, taxRateBps, taxCents, docFeeCents, downPaymentCents, totalFeesCents, totalDueCents, frontGrossCents, status, notes, createdAt, updatedAt, deletedAt, deletedBy, customer?, vehicle?, fees?, trades?, dealFinance?.

**Create body:** customerId (uuid), vehicleId (uuid), salePriceCents, purchasePriceCents, taxRateBps (0–10000), docFeeCents (optional), downPaymentCents (optional), notes (optional), fees (optional array: label, amountCents, taxable?).

## 3. Target mobile deal experience

- **Deal list**: Rows with customer name, vehicle title (year/make/model or stock), status badge, sale/total amount, updated date. Tap → detail. Add button → create.
- **Deal detail**: Mobile deal desk — stacked cards: Overview (ref, status, updated), Parties (customer + vehicle), Pricing (sale, tax, doc fee), Fees (line items), Finance (down, financed, payment if dealFinance exists), Status (current + allowed transitions), Notes/Activity (history if supported). Edit button → edit screen.
- **Create deal**: Single form — customer picker, vehicle picker, sale price, purchase price, tax rate (bps), doc fee, down payment, notes, optional fee line items. Submit → POST create → invalidate list → navigate to deal detail.
- **Edit deal**: Same form prefilled; PATCH on submit; invalidate detail + list; navigate back to detail.
- **Customer/vehicle association**: Pick from existing customers and inventory (same dealership). Simple searchable list/sheet; show selected summary in form and on detail.

## 4. Screen map

| Route | Screen | Description |
|-------|--------|-------------|
| (tabs)/deals | DealsListScreen | List with search (if API supports), add FAB/button. |
| (tabs)/deals/add | AddDealScreen | Create form; on success → navigate to /deals/[id]. |
| (tabs)/deals/[id] | DealDetailScreen | Deal desk cards; edit button → edit. |
| (tabs)/deals/edit/[id] | EditDealScreen | Edit form; on success → navigate back to /deals/[id]. |

## 5. Deal desk UX (mobile)

- **Header**: Deal reference (e.g. Deal #abc12345), status badge, Edit button.
- **Sections (cards):**  
  1. Overview — id slice, status, updatedAt.  
  2. Parties — Customer (name, id); Vehicle (year make model, stock).  
  3. Pricing — Sale price, tax, doc fee, subtotal/total.  
  4. Fees — List of fee label + amount (from deal.fees).  
  5. Finance — Down payment, amount financed, monthly payment (from dealFinance when present).  
  6. Status — Current status; buttons for allowed next statuses (backend-driven).  
  7. Notes / Activity — History list (GET history) or shell if not wired.

## 6. Create / edit workflow

- **Create**: Required customer + vehicle (pick from list). Required: salePriceCents, purchasePriceCents, taxRateBps. Optional: docFeeCents, downPaymentCents, notes, fees[]. On success: invalidate `["deals"]`, navigate to `/(tabs)/deals/[newId]`.
- **Edit**: Prefill from deal detail. PATCH only fields that backend accepts (salePriceCents, taxRateBps, docFeeCents, downPaymentCents, notes). Customer/vehicle not changed in this epic (backend may not support). On success: invalidate `["deals"]`, `["deals", id]`; navigate back to detail.

## 7. Customer + vehicle linking

- **Customer picker**: Reuse `api.listCustomers({ search, limit, offset })`. Searchable list; on select store customerId + display name. Show selected as chip/card in form and in detail Parties card.
- **Vehicle picker**: Reuse `api.listInventory({ search, limit, offset })`. Same pattern. Show year/make/model + stock. Ensure selected vehicle and customer belong to current dealership (API is tenant-scoped).

## 8. Pricing / fees / finance data model

- **Backend supports:** salePriceCents, purchasePriceCents, taxRateBps, taxCents (computed), docFeeCents, downPaymentCents, totalFeesCents, totalDueCents, frontGrossCents; fees[] (id, label, amountCents, taxable); dealFinance (amountFinancedCents, monthlyPaymentCents, etc.). No client-side fabrication of unsupported fields.
- **Mobile:** Display only what API returns. For create, send only create body fields. For edit, send only PATCH body fields. Financed amount / payment come from dealFinance when present.

## 9. Deal stage / status workflow

- **Backend:** PATCH /api/deals/[id]/status with `{ status: DealStatus }`. Backend enforces allowed transitions.
- **Mobile:** Show current status; show buttons for target statuses. Call PATCH status on tap; on success invalidate deal detail and list. If backend returns 400 (invalid transition), show error.

## 10. Edge cases

- No customer/vehicle selected on create → validation error.
- Deal not found / 404 → "Deal not found" message; 403 → "You don't have access."
- Invalid numeric input (negative, non-numeric) → block or coerce per backend (cents non-negative, taxRateBps 0–10000).
- Status transition not allowed → show API error.
- Switching dealership → deals list/detail refetched by active dealership (queries already scoped by auth); no stale cross-tenant data.

## 11. Acceptance criteria

- [ ] Deal list shows customer, vehicle, status, amount; tap → detail; add → create.
- [ ] Deal detail shows all desk sections from API data; edit → edit screen.
- [ ] Create deal: pick customer + vehicle, set pricing; submit creates deal and navigates to detail.
- [ ] Edit deal: prefilled form; submit updates deal; back to detail with fresh data.
- [ ] Customer and vehicle pickers use existing list APIs; selection clear.
- [ ] Pricing/fees/finance reflect backend only; no fabricated finance.
- [ ] Status update via PATCH status; invalid transition handled.
- [ ] Query invalidation after create, update, status change.
- [ ] Tenant scoping: no cross-dealership data; switching dealership invalidates/refetches.

## 12. Files to touch

**Step 2 — Data / API**  
- `src/features/deals/types.ts` — DealDetail, DealListItem, DealStatus, create/update payloads.  
- `src/api/endpoints.ts` — getDealById return type; createDeal, updateDeal, updateDealStatus; getDealHistory.  
- `src/features/deals/hooks.ts` — useDeal, useDealsList, useCreateDeal, useUpdateDeal, useUpdateDealStatus, useDealHistory.

**Step 3 — Screens / components**  
- `app/(tabs)/deals/_layout.tsx` — Add add, edit/[id] screens.  
- `app/(tabs)/deals/index.tsx` — Use DealsListScreen or inline list with add button.  
- `app/(tabs)/deals/[id].tsx` — Use DealDetailScreen (cards).  
- `app/(tabs)/deals/add.tsx` — AddDealScreen.  
- `app/(tabs)/deals/edit/[id].tsx` — EditDealScreen.  
- `src/features/deals/components/` — DealHeaderCard, DealPartiesCard, DealPricingCard, DealFeesCard, DealFinanceCard, DealStatusCard, DealForm, CustomerPickerField, VehiclePickerField.  
- Optional: `DealActivityCard` (history) or shell.

**Step 4 — QA / tests**  
- `src/features/deals/__tests__/` — form validation, money format/parse, detail mapping, pickers.

---

## 13. Implementation deliverables (completed)

### Files added

- `apps/mobile/docs/MOBILE_DEALS_EPIC_SPEC.md`
- `apps/mobile/src/features/deals/types.ts`
- `apps/mobile/src/features/deals/utils.ts`
- `apps/mobile/src/features/deals/hooks.ts`
- `apps/mobile/src/features/deals/components/DealHeaderCard.tsx`
- `apps/mobile/src/features/deals/components/DealPartiesCard.tsx`
- `apps/mobile/src/features/deals/components/DealPricingCard.tsx`
- `apps/mobile/src/features/deals/components/DealFeesCard.tsx`
- `apps/mobile/src/features/deals/components/DealFinanceCard.tsx`
- `apps/mobile/src/features/deals/components/DealStatusCard.tsx`
- `apps/mobile/src/features/deals/components/DealActivityCard.tsx`
- `apps/mobile/src/features/deals/components/DealForm.tsx`
- `apps/mobile/src/features/deals/components/CustomerPickerField.tsx`
- `apps/mobile/src/features/deals/components/VehiclePickerField.tsx`
- `apps/mobile/src/features/deals/__tests__/utils.test.ts`
- `apps/mobile/src/features/deals/__tests__/form-validation.test.ts`
- `apps/mobile/app/(tabs)/deals/add.tsx`
- `apps/mobile/app/(tabs)/deals/edit/[id].tsx`

### Files changed

- `apps/mobile/src/api/endpoints.ts` — Deal types from features/deals; listDeals (vehicleId, sortBy, sortOrder); getDealById typed; createDeal, updateDeal, updateDealStatus, getDealHistory.
- `apps/mobile/app/(tabs)/deals/_layout.tsx` — Stack screens add, edit/[id].
- `apps/mobile/app/(tabs)/deals/index.tsx` — Use useDealsList; row shows customer, vehicle, status, amount, updated; Add deal button.
- `apps/mobile/app/(tabs)/deals/[id].tsx` — Full deal detail with DealHeaderCard, DealPartiesCard, DealPricingCard, DealFeesCard, DealFinanceCard, DealStatusCard, DealActivityCard; Edit → edit screen; status change mutation.

### What is fully working

- Deal list with customer, vehicle, status badge, amount, updated date; pull to refresh; Add deal button.
- Deal detail: overview, parties, pricing, fees, finance (from API), status with transition buttons, activity (history).
- Create deal: customer picker, vehicle picker, sale/purchase price, tax rate, doc fee, down payment, notes; submit → POST → navigate to detail; list invalidated.
- Edit deal: prefilled form (sale, tax, doc fee, down payment, notes); submit → PATCH → navigate back to detail; detail and list invalidated.
- Status workflow: Move to Draft/Structured/Approved/Contracted/Canceled per allowed next; PATCH status; invalidation.
- Customer/vehicle pickers: searchable modal lists using listCustomers and listInventory.
- All data dealership-scoped via existing auth; no cross-tenant use; switching dealership invalidates queries (deals in list/detail refetched).

### Backend dependencies

- **Used:** GET/POST /api/deals, GET/PATCH /api/deals/[id], PATCH /api/deals/[id]/status, GET /api/deals/[id]/history. All implemented in dealer app.
- **Not wired (future):** Deal notes API (if added); lender applications; documents/signatures. Activity card uses history only.

### Routes created

- `(tabs)/deals` — list
- `(tabs)/deals/add` — create deal
- `(tabs)/deals/[id]` — deal detail
- `(tabs)/deals/edit/[id]` — edit deal

### Commands to run/test

From repo root:

```bash
cd apps/mobile && npm run test
```

Manual: Open Deals tab → list → tap deal → detail → Edit → change values → Save → back to detail. Add deal → pick customer + vehicle → set prices → Create → land on new deal detail. Change status from detail. Switch dealership (More) → deals list refreshes to new dealership.

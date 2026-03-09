# Finance Core — Slice 4: Reporting & Exports

**Sprint:** Finance Core — Slice 4  
**Flow:** SPEC → BACKEND → FRONTEND → SECURITY & QA

---

## 1. REPO INSPECTION SUMMARY

### Existing reports module (`modules/reports/`)

- **Services:** sales-summary, sales-by-user, inventory-aging, finance-penetration, mix, pipeline, export (sales CSV, inventory CSV).
- **DB:** `db/sales.ts` — listContractedDealsInRange, getFirstContractedHistoryByDeal, getDisplayNamesForUserIds, listContractedDealsForExport; `db/inventory.ts` — listVehiclesForAging, listVehiclesForExport.
- **API routes:** GET `/api/reports/sales-summary`, `/api/reports/sales-by-user`, `/api/reports/inventory-aging`, `/api/reports/finance-penetration`, `/api/reports/mix`, `/api/reports/pipeline`; GET `/api/reports/export/sales`, `/api/reports/export/inventory`. All use `guardPermission(ctx, "reports.read")` or `reports.export`.
- **UI:** Single `ReportsPage.tsx` with tabs/sections, DateRangePicker, ExportButtons, Recharts. Permission: reports.read, reports.export.
- **Date range:** `lib/reports/date-range.ts` — getDateRangeForPreset, getTodayInTz, REPORTS_DEFAULT_TIMEZONE (America/New_York). Schemas in `app/api/reports/schemas.ts` (from/to, max 2 years).

### Data available for new reports

- **Deals:** Deal (salePriceCents, purchasePriceCents, frontGrossCents, totalFeesCents, createdAt, status, vehicleId, customerId); DealFinance (backendGrossCents, productsTotalCents). CONTRACTED deals in range via reports/db/sales. Salesperson = DealHistory.changedBy for first toStatus=CONTRACTED.
- **Inventory:** Vehicle (auctionCostCents, transportCostCents, reconCostCents, miscCostCents, salePriceCents, createdAt); inventory/service/vehicle totalCostCents, projectedGrossCents. Sold vehicles = deals with status CONTRACTED and vehicleId.
- **Accounting:** accounting-core — listTransactions (posted only or all), listAccounts. Transactions have postedAt, referenceType, referenceId, entries (accountId, direction, amountCents).

### Patterns to reuse

- **RBAC:** Slice 4 uses **finance.submissions.read** (and reports.export for CSV if we align; spec says finance.submissions.read).
- **Tenant:** All queries by dealershipId from ctx.
- **Export:** reports/service/export.ts — escapeCsvCell, date range; response Content-Type text/csv or application/octet-stream with CSV body.
- **Frontend:** Reports page uses apiFetch, DateRangePicker, Card/Table, Pagination, ExportButtons. New pages can follow same pattern under /reports/profit, /reports/inventory-roi, /reports/salespeople.

### Files to add

- **Module:** `modules/reporting-core/` (new) with submodules:
  - **profit:** getDealerProfitReport(dealershipId, from, to, salespersonId?). Uses deals + dealFinance; salesperson from DealHistory.
  - **inventory-roi:** getInventoryRoiReport(dealershipId, from?, to?). CONTRACTED deals with vehicle; vehicle cost (totalCostCents), recon cost, sale price, gross profit, days in stock.
  - **salesperson:** getSalespersonPerformance(dealershipId, from, to). Deals closed, gross profit, average profit per deal, conversion (optional: need pipeline data).
  - **exports:** exportAccountingTransactions(dealershipId, from, to, accountId?, format: csv | quickbooks). Uses accounting-core listTransactions + entries.
- **API routes:** GET `/api/reports/dealer-profit`, GET `/api/reports/inventory-roi`, GET `/api/reports/salesperson-performance`, GET `/api/accounting/export`.
- **Frontend:** `app/(app)/reports/profit/page.tsx`, `reports/inventory-roi/page.tsx`, `reports/salespeople/page.tsx`; shared date filters and CSV export. Extend reports section (add links from main reports page or sidebar).

### Reuse decisions

- Use existing `reports/db/sales.ts` (listContractedDealsInRange, getFirstContractedHistoryByDeal, getDisplayNamesForUserIds). Extend or add reporting-core db layer for deal+dealFinance+vehicle joins if needed.
- Dealer profit: aggregate CONTRACTED deals in date range; include dealFinance.backendGrossCents for total gross; net = total gross (or minus costs if we have them). Filter by salespersonId = changedBy from first CONTRACTED history.
- Inventory ROI: only sold vehicles (CONTRACTED deal per vehicle). Purchase cost = vehicle totalCostCents; recon = reconCostCents; sale price = deal.salePriceCents; gross profit = salePriceCents - totalCostCents; days in stock = deal.createdAt - vehicle.createdAt.
- Salesperson performance: same as sales-by-user but add backend gross if available, average profit, and optionally conversion (contracted / total deals touched).
- Accounting export: list posted transactions in date range (optionally by accountId); CSV columns: date, transaction id, account code, account name, debit, credit, memo; QuickBooks = similar CSV format (IIF or CSV mapping).

---

## 2. STEP 1 — SPEC

### Feature set A — Dealer profit report

- **Service:** getDealerProfitReport(dealershipId, params: { from, to, salespersonId? }).
- **Metrics:** profit per deal (frontGross + backendGross), profit per salesperson (group by changedBy), profit per month (group by month of deal.createdAt or first CONTRACTED date), total gross (sum front + back), total net (same as total gross in this slice).
- **Endpoint:** GET `/api/reports/dealer-profit?from=&to=&salespersonId=`. Response: summary (totalGrossCents, totalNetCents, dealCount, byMonth?: [], bySalesperson?: []) and optional rows (per-deal) for table.
- **Filters:** date range (from, to), optional salespersonId (user id who closed deal).

### Feature set B — Inventory ROI report

- **Service:** getInventoryRoiReport(dealershipId, params: { from?, to? }). Sold vehicles only (CONTRACTED deals with vehicleId). Per row: vehicleId, stockNumber, vin, purchaseCostCents (totalCostCents), reconCostCents, salePriceCents, grossProfitCents, daysInStock.
- **Endpoint:** GET `/api/reports/inventory-roi?from=&to=`. Response: data[] with metrics, summary (totalPurchaseCost, totalSalePrice, totalGrossProfit, avgDaysInStock).

### Feature set C — Salesperson performance report

- **Service:** getSalespersonPerformance(dealershipId, from, to). Reuse sales-by-user pattern: CONTRACTED deals in range, first CONTRACTED history → changedBy. Metrics per salesperson: dealsClosed, grossProfitCents (front + back), averageProfitPerDealCents, conversionRate (optional: contracted / created-or-touched; if no pipeline, omit or use deal count only).
- **Endpoint:** GET `/api/reports/salesperson-performance?from=&to=&limit=&offset=`. Response: data[], meta (total, limit, offset).

### Feature set D — Accounting exports

- **Service:** exportAccountingTransactions(dealershipId, params: { from, to, accountId?, format: 'csv' | 'quickbooks' }). List posted transactions (postedAt in range); optionally filter entries by accountId. CSV: Date, TransactionId, AccountCode, AccountName, Debit, Credit, Memo. QuickBooks: same or IIF-style columns.
- **Endpoint:** GET `/api/accounting/export?from=&to=&accountId=&format=csv`. Response: CSV file (Content-Disposition attachment) or JSON for quickbooks format.

### Frontend

- **Pages:** /reports/profit, /reports/inventory-roi, /reports/salespeople. Each: summary cards, data table, date range filter (reuse DateRangePicker or same presets), CSV export button.
- **Navigation:** Add links from main Reports page to these sub-pages, or add to sidebar under Reports. Permission: finance.submissions.read (and reports.export for export if we keep consistency).

### RBAC

- All new report endpoints and accounting export: **finance.submissions.read**. Export actions may also require **reports.export** per existing pattern; spec says finance.submissions.read.

### Performance

- Use date range and optional filters to limit result sets. Paginate dealer-profit rows and salesperson-performance. Inventory ROI and accounting export may return larger sets; cap or paginate (e.g. max 1000 rows for export).

### Risks

- Salesperson = first DealHistory changedBy for CONTRACTED; if no history row, attribute to null/unknown.
- Inventory ROI: one vehicle could have multiple deals (e.g. unwound); use latest CONTRACTED deal per vehicle in range or first CONTRACTED in range.
- Accounting export: only posted transactions (postedAt not null).

---

*End STEP 1. Proceed to STEP 2 Backend.*

---

## 6. FINAL REPORT — Slice 4 Complete

### Completed

1. **Repo inspection** — Documented reports module (sales-by-user, export, date-range), Deal/DealFinance/Vehicle and accounting-core, data available for profit/ROI/salesperson/export.

2. **STEP 1 Spec** — `FINANCE_CORE_SLICE4_SPEC.md`: dealer profit report, inventory ROI, salesperson performance, accounting export (CSV/QuickBooks), APIs, frontend pages, RBAC (finance.submissions.read).

3. **STEP 2 Backend**
   - **Module** `modules/reporting-core/`:  
     - **db:** deals.ts (listContractedDealsWithFinance, getFirstContractedHistoryByDeal, getDisplayNamesForUserIds), inventory-roi.ts (listSoldVehiclesRoi).  
     - **service:** dealer-profit.ts (getDealerProfitReport: summary, byMonth, bySalesperson, rows; filter salespersonId), inventory-roi.ts (getInventoryRoiReport), salesperson-performance.ts (getSalespersonPerformance, paginated), accounting-export.ts (exportAccountingTransactions, CSV/quickbooks, escapeCsvCell).  
     - **schemas:** Zod query schemas (date range, salespersonId, accountId, format).
   - **APIs:** GET `/api/reports/dealer-profit?from=&to=&salespersonId=`, GET `/api/reports/inventory-roi?from=&to=`, GET `/api/reports/salesperson-performance?from=&to=&limit=&offset=`, GET `/api/accounting/export?from=&to=&accountId=&format=csv`. All tenant-scoped, guardPermission(ctx, "finance.submissions.read").

4. **STEP 3 Frontend**
   - **Pages:** /reports/profit (DealerProfitReportPage), /reports/inventory-roi (InventoryRoiReportPage), /reports/salespeople (SalespersonPerformanceReportPage). Each: DateRangePicker, summary cards, table, Export CSV (client-side from report data).
   - **Reports home:** "Finance reports" block with links to Dealer profit, Inventory ROI, Salesperson performance (when finance.submissions.read).
   - **Accounting:** Transactions page has Export card (from/to date, Download CSV) calling GET /api/accounting/export.

5. **STEP 4 Security & QA**
   - **Tests:** dealer-profit.test.ts (getDealerProfitReport returns summary and rows; integration). export-format.test.ts (escapeCsvCell; unit). tenant-isolation.test.ts (dealer A gets only A data; integration). Integration tests skip when SKIP_INTEGRATION_TESTS=1 or no TEST_DATABASE_URL.

### Commands

- Run dealer tests: `npm run test:dealer` (from repo root).
- Run reporting-core unit test: `cd apps/dealer && npx jest modules/reporting-core/tests/export-format.test.ts`

### Deferred / follow-ups

- Conversion rate in salesperson performance (would need pipeline/deal-created-by data).
- QuickBooks IIF format details if required; currently CSV with same columns.
- Pagination/cap on accounting export for very large result sets.

### Risks

- Inventory ROI uses deal.createdAt for date range; soldAt could use first CONTRACTED history date if preferred.
- Accounting export returns all posted transactions in range; consider max rows or streaming for large datasets.

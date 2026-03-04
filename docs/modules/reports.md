# Reports Module

## Purpose and scope

- Reporting endpoints and UI-ready report definitions using existing modules (Deals, Inventory, Finance shell, Customers). No OLAP warehouse in v1.
- In-app reports: sales summary, sales by user, inventory aging, finance penetration, cash vs finance mix, pipeline (trend). Export: sales CSV, inventory CSV.
- Multi-tenant: `dealershipId` from auth only. RBAC: `reports.read` for all GET report routes; `reports.export` for export routes only. Export does **not** require `reports.read`—only `reports.export` is checked on export endpoints.

## Routes

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| GET | /api/reports/sales-summary | Sales summary (date range): totals, averages, optional groupBy | reports.read |
| GET | /api/reports/sales-by-user | Paginated breakdown by salesperson | reports.read |
| GET | /api/reports/inventory-aging | Inventory aging: counts, buckets, value | reports.read |
| GET | /api/reports/finance-penetration | Finance penetration % and backend gross | reports.read |
| GET | /api/reports/mix | Cash vs finance mix | reports.read |
| GET | /api/reports/pipeline | Deals by status, trend contracted per day/week | reports.read |
| GET | /api/reports/export/sales | Export sales report (CSV) | reports.export |
| GET | /api/reports/export/inventory | Export inventory aging (CSV) | reports.export |

## Permissions

- **reports.read** — View all in-app reports. Required for every GET report route **except** export.
- **reports.export** — Export reports to CSV. Required for GET /api/reports/export/*. Export routes require **reports.export only**; `reports.read` is not required for export. UI typically shows export buttons only when user has `reports.export`.

## Security guarantees

- **Tenant isolation:** Every report and export is scoped by `dealershipId` from auth (active dealership). No client-supplied `dealershipId`. Cross-tenant: Dealer B receives zero/empty results for all report endpoints and export; no data from Dealer A is ever returned to B.
- **RBAC:** No admin bypass. Missing `reports.read` → 403 on all GET report routes (sales-summary, sales-by-user, inventory-aging, finance-penetration, mix, pipeline). Missing `reports.export` → 403 on GET export/sales and export/inventory.
- **Input validation:** All query params validated with Zod at the edge. Date range: `from` ≤ `to`, max 2 years. List endpoints: `limit` min 1, max 100. Invalid input → 400 VALIDATION_ERROR.
- **Audit:** Only **export** actions are audited (`report.exported`). In-app report views are not audited. Audit metadata: reportName, from/to/asOf, format; no PII.

## Tenant isolation

- All underlying Deal, DealFinance, Vehicle, Customer queries filter by `dealershipId` from auth.
- Integration tests: Dealer A has CONTRACTED deals; Dealer B calls sales-summary, sales-by-user, inventory-aging, finance-penetration, mix, pipeline → zero or empty for B. Dealer B calls export/sales with range covering A’s deals → CSV with only header (no A data).

## Money integrity

- All money in API responses is **string cents** (e.g. `"123456"` = 1234.56 dollars). No raw numbers for money in responses.
- **Average front gross:** Computed with HALF_UP rounding in integer math: `(totalCents*2 + count) / (2*count)` so that e.g. 7 cents over 2 deals → 4 cents.
- **Penetration:** 0/N → 0%, N/N → 100%. Integer percent; zero total yields 0.
- **Inventory value:** Sum of (purchasePrice + reconditioningCost + otherCosts) converted to cents; Prisma Decimal handled via `toNumber()` then rounded to cents; result as string. No float used for money in service layer where BigInt is available.
- **Days to close:** Average rounded to 1 decimal place (half-up). Null when no history rows.

## Export safety

- **CSV escaping:** Values containing comma, quote, or newline are quoted; internal quotes doubled. Unit test: value with comma → CSV cell properly quoted.
- **Filename:** Built from validated `from`/`to`/`asOf`; sanitized to `[0-9-]` only before use in Content-Disposition to prevent path/header injection.
- **PII:** Export CSV contains only allowed fields (e.g. date, dealId, customerName, salePriceCents, frontGrossCents, financingMode for sales; vin, stockNumber, status, daysInInventory, purchaseValueCents for inventory). No SSN, DOB, income, or raw paths in CSV.
- **Rate limiting:** Export endpoints use `report_export` rate limit (per client identifier, in-memory; production should use shared store). Consistent with `@/lib/api/rate-limit`.

## Known limitations

- **Timezone:** Date range filtering uses UTC day boundaries (`from`/`to` as ISO dates). Optional `timezone` query param is accepted but date bucketing in v1 is server/UTC; grouping by “day” in a specific IANA timezone (e.g. America/New_York) is not applied. For a deal created at 23:30 UTC, it may be counted on the next calendar day in a timezone-aware view; current implementation counts by UTC date. Document in manual tests if behavior is critical.
- **Rate limit identifier:** Export rate limit uses client identifier from `x-forwarded-for` or default; not per-user. For production, consider per-user or per-dealership limits with a shared backend (e.g. Redis).

## Manual test checklist

1. **Tenant isolation:** As Dealer B, call GET sales-summary, sales-by-user, inventory-aging, finance-penetration, mix, pipeline with a range where Dealer A has deals. Expect zero totals or empty arrays. Call GET export/sales with same range; expect CSV with header only.
2. **RBAC:** Without `reports.read`, all GET report routes → 403. With `reports.read` only, export routes → 403. With `reports.export` only, export routes succeed; in-app report routes → 403 unless user also has `reports.read`.
3. **Validation:** from > to → 400. Date range > 2 years → 400. sales-by-user limit=101 → 400.
4. **Export:** Trigger export/sales and export/inventory; verify CSV download, filename safe, and audit `report.exported` with no PII in metadata.
5. **No fetch without permission:** With `reports.read` false, open Reports page; verify no /api/reports/* requests in network tab.

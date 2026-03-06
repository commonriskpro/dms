# Reports Module — Full SPEC (Step 1/4)

**Module:** reports  
**Scope:** Reporting endpoints and UI-ready report definitions using existing modules (Deals, Inventory, Finance shell, Customers). Multi-tenant (dealershipId from auth only), RBAC enforced, deterministic money (BIGINT cents where applicable; API returns strings), fast (indexes + aggregation strategy), auditable only when exporting (optional). No OLAP warehouse in v1.

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards, deals-spec.md, finance-shell-spec.md, inventory-spec.md, customers-spec.md, core-platform-spec.md.

---

## 1) Prisma Schema + Indexes + Constraints

### 1.1 New Tables (Reports Module)

Reports module **does not own** Deal, DealFinance, Vehicle, or Customer. It reads them via service layer or shared DB access scoped by `dealership_id`. No new business tables required for v1 report *data*.

**Optional (performance only):** If aggregation performance requires it, introduce a **DailyRollup** (or similar) table later; not in v1 scope. v1 uses direct Postgres aggregates (groupBy, sum, count) on existing tables.

### 1.2 Audit: Export-Only

- **No** report-specific Prisma models for report definitions (v1: report types are fixed in code).
- **Audit:** Only **export** actions are audited. No audit for in-app report views (read-only aggregates; no PII in response by design).
- Audit event: `report.exported` — metadata: `reportName`, `from`/`to`/`asOf`, `format`; no PII. Stored in existing **AuditLog** (core-platform); no new audit table.

### 1.3 Index Requirements (Existing Tables)

Reports rely on existing modules’ indexes. The following must exist (add in deals/inventory/finance/customers if not present):

| Table / index | Purpose for reports |
|---------------|---------------------|
| Deal: `@@index([dealershipId])` | Tenant scoping |
| Deal: `@@index([dealershipId, status])` | Filter CONTRACTED; exclude CANCELED |
| Deal: `@@index([dealershipId, createdAt])` | Date-range filters; time-bounded aggregates |
| Deal: `@@index([dealershipId, deletedAt])` | Exclude soft-deleted |
| Deal: `@@index([dealershipId, customerId])` | Join to Customer (leadSource) |
| Deal: `@@index([dealershipId, vehicleId])` | Join to Vehicle (location) |
| DealHistory: `@@index([dealershipId, dealId, createdAt])` | Days-to-close (first CONTRACTED event) |
| DealFinance: `@@index([dealershipId])`, `@@index([dealershipId, dealId])` (unique dealId) | Join to Deal; finance penetration / mix |
| Vehicle: `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])` | Inventory aging; days in stock |
| Vehicle: `@@index([dealershipId, locationId])` | Aging by location (optional) |
| Customer: `@@index([dealershipId, leadSource])` | Sales by lead source (via Deal.customerId) |

No new Prisma models in reports module for v1. No new migrations from reports module unless a future DailyRollup is added.

---

## 2) REST API Routes + Zod Schemas (Contracts Only)

### 2.1 Conventions

- **Auth:** `dealershipId` from auth/session (active dealership) only. Never from client body or path.
- **Method:** GET only for report and export routes.
- **Query params:** `from`, `to` (ISO 8601 date or date-time); `asOf` (ISO date for point-in-time); `groupBy`; `timezone` (IANA, optional, for date bucketing); pagination `limit`/`offset` where applicable.
- **Pagination:** List-style endpoints (e.g. sales-by-user) use `limit` (default 25, max 100), `offset` (0-based). Response includes `meta: { total, limit, offset }`.
- **Money:** All money in API responses as **string** (cents). e.g. `"123456"` = 1234.56 dollars.
- **Error shape:** `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, RATE_LIMITED, INTERNAL.
- **Rate limiting:** Export endpoints MUST be rate-limited (e.g. per user/dealership); in-app report GETs may be rate-limited at a higher threshold.

### 2.2 Route Table

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| GET | /api/reports/sales-summary | Sales summary (date range): totals, averages, optional groupBy | reports.read |
| GET | /api/reports/sales-by-user | Paginated breakdown by salesperson (from DealHistory or inferred) | reports.read |
| GET | /api/reports/inventory-aging | Inventory aging: counts by status, buckets, avg days, value | reports.read |
| GET | /api/reports/finance-penetration | Finance penetration (date range): %, APR, term, products, backend gross | reports.read |
| GET | /api/reports/mix | Cash vs finance mix (date range): by financingMode | reports.read |
| GET | /api/reports/pipeline | (Optional v1-lite) Deals by status; trend contracted per day/week | reports.read |
| GET | /api/reports/export/sales | Export sales report (CSV) | reports.export |
| GET | /api/reports/export/inventory | Export inventory aging (CSV) | reports.export |

### 2.3 Query / Params / Body Zod Schemas (Names and Shapes)

- **salesSummaryQuerySchema:**  
  `from` (string, ISO date, required), `to` (string, ISO date, required), `groupBy?` (enum: `none` | `salesperson` | `location` | `leadSource`), `timezone?` (string, IANA).  
  Validation: from ≤ to; date range reasonable (e.g. max 2 years).

- **salesByUserQuerySchema:**  
  `from` (string, ISO date, required), `to` (string, ISO date, required), `limit` (number, min 1, max 100, default 25), `offset` (number, min 0, default 0), `timezone?` (string).

- **inventoryAgingQuerySchema:**  
  `asOf` (string, ISO date, optional; default server date today in dealership timezone), `timezone?` (string).

- **financePenetrationQuerySchema:**  
  `from` (string, ISO date, required), `to` (string, ISO date, required), `timezone?` (string).

- **mixQuerySchema:**  
  `from` (string, ISO date, required), `to` (string, ISO date, required), `timezone?` (string).

- **pipelineQuerySchema (optional):**  
  `from` (string, ISO date, required), `to` (string, ISO date, required), `groupBy?` (enum: `day` | `week`), `timezone?` (string).

- **exportSalesQuerySchema:**  
  `from` (string, ISO date, required), `to` (string, ISO date, required), `format` (enum: `csv`, required).

- **exportInventoryQuerySchema:**  
  `asOf` (string, ISO date, optional), `format` (enum: `csv`, required).

No request body for any report or export route. Params only where applicable (e.g. export path may include report type; query carries from/to/format).

### 2.4 Response Shapes (Success)

- **GET /api/reports/sales-summary**  
  `{ data: { totalDealsCount: number, totalSaleVolumeCents: string, totalFrontGrossCents: string, averageFrontGrossCents: string, averageDaysToClose: number | null, breakdown?: { bySalesperson?: Array<{ userId?, displayName?, dealCount, saleVolumeCents, frontGrossCents }>, byLocation?: Array<{ locationId?, locationName?, dealCount, saleVolumeCents, frontGrossCents }>, byLeadSource?: Array<{ leadSource?, dealCount, saleVolumeCents, frontGrossCents }> } } }`  
  Money fields as string (cents). `breakdown` present when `groupBy` is set; at most one of the three breakdowns per request (by groupBy value).

- **GET /api/reports/sales-by-user**  
  `{ data: Array<{ userId?, displayName?, dealCount, saleVolumeCents: string, frontGrossCents: string }>, meta: { total, limit, offset } }`.

- **GET /api/reports/inventory-aging**  
  `{ data: { byStatus: Array<{ status, count }>, averageDaysInInventory: number, agingBuckets: { bucket0_15: number, bucket16_30: number, bucket31_60: number, bucket61_90: number, bucket90Plus: number }, totalInventoryValueCents: string, totalListPriceCents?: string } }`.  
  Value from sum of acquisition cost (Vehicle purchasePrice + reconditioningCost + otherCosts) converted to cents; listPrice optional.

- **GET /api/reports/finance-penetration**  
  `{ data: { contractedCount: number, financedCount: number, financePenetrationPercent: number, averageAprBps: number | null, averageTermMonths: number | null, totalProductsSoldCents: string, totalBackendGrossCents: string, productsPenetrationPercent: number } }`.

- **GET /api/reports/mix**  
  `{ data: { byMode: Array<{ financingMode: "CASH" | "FINANCE" | "UNKNOWN", dealCount: number, saleVolumeCents: string, frontGrossCents: string, averageGrossCents: string }> } }`.

- **GET /api/reports/pipeline (optional)**  
  `{ data: { byStatus: Array<{ status, count }>, trend?: Array<{ period: string, contractedCount: number }> } }`.  
  `period` is date or week label per groupBy.

- **GET /api/reports/export/sales**  
  Response: CSV file (Content-Type, Content-Disposition attachment); filename includes report name and date range. No JSON body.

- **GET /api/reports/export/inventory**  
  Response: CSV file; filename includes report name and asOf date.

### 2.5 Example JSON (In-App Responses)

**Sales summary (no groupBy):**
```json
{
  "data": {
    "totalDealsCount": 42,
    "totalSaleVolumeCents": "12500000",
    "totalFrontGrossCents": "310000",
    "averageFrontGrossCents": "7380",
    "averageDaysToClose": 5.2
  }
}
```

**Sales summary (groupBy: leadSource):**
```json
{
  "data": {
    "totalDealsCount": 42,
    "totalSaleVolumeCents": "12500000",
    "totalFrontGrossCents": "310000",
    "averageFrontGrossCents": "7380",
    "averageDaysToClose": 5.2,
    "breakdown": {
      "byLeadSource": [
        { "leadSource": "Website", "dealCount": 20, "saleVolumeCents": "6000000", "frontGrossCents": "150000" },
        { "leadSource": "Walk-in", "dealCount": 15, "saleVolumeCents": "4500000", "frontGrossCents": "110000" }
      ]
    }
  }
}
```

**Inventory aging:**
```json
{
  "data": {
    "byStatus": [
      { "status": "AVAILABLE", "count": 85 },
      { "status": "PENDING", "count": 12 }
    ],
    "averageDaysInInventory": 28,
    "agingBuckets": { "bucket0_15": 40, "bucket16_30": 25, "bucket31_60": 15, "bucket61_90": 10, "bucket90Plus": 7 },
    "totalInventoryValueCents": "250000000",
    "totalListPriceCents": "275000000"
  }
}
```

**Finance penetration:**
```json
{
  "data": {
    "contractedCount": 50,
    "financedCount": 38,
    "financePenetrationPercent": 76,
    "averageAprBps": 899,
    "averageTermMonths": 72,
    "totalProductsSoldCents": "45000",
    "totalBackendGrossCents": "32000",
    "productsPenetrationPercent": 62
  }
}
```

**Mix:**
```json
{
  "data": {
    "byMode": [
      { "financingMode": "FINANCE", "dealCount": 38, "saleVolumeCents": "9500000", "frontGrossCents": "240000", "averageGrossCents": "6315" },
      { "financingMode": "CASH", "dealCount": 10, "saleVolumeCents": "2500000", "frontGrossCents": "60000", "averageGrossCents": "6000" },
      { "financingMode": "UNKNOWN", "dealCount": 2, "saleVolumeCents": "500000", "frontGrossCents": "10000", "averageGrossCents": "5000" }
    ]
  }
}
```

---

## 3) RBAC Matrix + Tenant Scoping Rules

### 3.1 Permissions (v1)

- **reports.read** — View all in-app reports (sales summary, sales-by-user, inventory aging, finance penetration, mix, pipeline). Required for every GET report route except export.
- **reports.export** — Export reports to CSV. Required for GET /api/reports/export/*.

### 3.2 Route → Permission

| Route | Permission |
|-------|------------|
| GET /api/reports/sales-summary | reports.read |
| GET /api/reports/sales-by-user | reports.read |
| GET /api/reports/inventory-aging | reports.read |
| GET /api/reports/finance-penetration | reports.read |
| GET /api/reports/mix | reports.read |
| GET /api/reports/pipeline | reports.read |
| GET /api/reports/export/sales | reports.export |
| GET /api/reports/export/inventory | reports.export |

Least privilege: no admin bypass; both permissions explicit. Users with only `reports.read` cannot call export; export buttons in UI must be gated by `reports.export`.

### 3.3 Tenant Scoping

- Every report and export is scoped by `dealershipId` from auth (active dealership). No client-supplied dealershipId.
- Cross-tenant access forbidden: no endpoint returns or mutates another tenant’s data. All underlying Deal, DealFinance, Vehicle, Customer queries filter by that dealershipId.

### 3.4 Sensitive Reads

- Report responses are aggregates/summaries; no PII in response. Export CSV may contain row-level data (e.g. deal counts by user, vehicle counts by bucket); still no SSN/DOB/income. Only **export** is audit-logged (`report.exported`).

---

## 4) Events Emitted / Consumed

### 4.1 Emitted

- **report.exported** — When an export completes successfully. Payload (for audit): `reportName`, `from`/`to`/`asOf`, `format`, `dealershipId`, `actorId`. No PII.

### 4.2 Consumed

- None in v1. Reports read current state from Deal, DealFinance, Vehicle, Customer via service or DB layer; no subscription to deal/finance/inventory events required for v1.

---

## 5) Data & Aggregation Strategy

### 5.1 Source-of-Truth Tables and Fields

| Report | Source tables | Key fields |
|--------|----------------|------------|
| Sales summary | Deal, DealHistory, Customer, Vehicle, DealershipLocation | Deal: status, salePriceCents, frontGrossCents, createdAt; DealHistory: toStatus, changedBy, createdAt; Customer: leadSource; Vehicle: locationId |
| Sales by user | Deal, DealHistory, Profile | Deal (CONTRACTED); salesperson = DealHistory.changedBy where toStatus=CONTRACTED (or first/last per deal); fallback: null/“Unassigned” |
| Inventory aging | Vehicle | status, createdAt, purchasePrice, reconditioningCost, otherCosts, listPrice, locationId |
| Finance penetration | Deal, DealFinance | Deal.status=CONTRACTED; DealFinance.financingMode, aprBps, termMonths, productsTotalCents, backendGrossCents |
| Cash vs finance mix | Deal, DealFinance | Deal.status=CONTRACTED; Deal.salePriceCents, frontGrossCents; DealFinance.financingMode |
| Pipeline | Deal, DealHistory | Deal.status; DealHistory for contracted-at date (trend by day/week) |

### 5.2 Filtering Rules

- **Deals for “sold/closed” metrics:** `Deal.status = CONTRACTED`; exclude `Deal.status = CANCELED` and `Deal.deletedAt IS NOT NULL`.
- **Finance:** If a contracted deal has no DealFinance row, treat as **CASH/UNKNOWN** for mix; for penetration, count as “not financed” (no financingMode=FINANCE).
- **Inventory:** Exclude soft-deleted vehicles (`Vehicle.deletedAt IS NULL`). “Available” for value = status AVAILABLE (or include PENDING per business rule; spec: available only for total inventory value, or document both).

### 5.3 Missing Finance Row

- Treat as **CASH** or **UNKNOWN** in Cash vs Finance mix; in Finance penetration, such deals are not “financed” and do not contribute to average APR/term or products totals.

### 5.4 Index Requirements (Exact)

- **Deal:** `(dealershipId, status)`, `(dealershipId, createdAt)`, `(dealershipId, deletedAt)`, `(dealershipId, customerId)`, `(dealershipId, vehicleId)`.
- **DealHistory:** `(dealershipId, dealId, createdAt)` for “contracted at” and changedBy (salesperson).
- **DealFinance:** `(dealershipId, dealId)` (unique); join to Deal by dealId.
- **Vehicle:** `(dealershipId, status)`, `(dealershipId, createdAt)`, `(dealershipId, locationId)`.
- **Customer:** `(dealershipId, leadSource)` (for leadSource breakdown via Deal.customerId).

### 5.5 Query Approach (v1)

- Simple Postgres aggregates: `groupBy`, `sum`, `count`, `avg` on the above tables with `dealershipId` and date/status filters. No OLAP warehouse. Optional **DailyRollup** table only if performance demands it later; not in v1.

### 5.6 Days-to-Close

- From Deal.createdAt to the **first** DealHistory.createdAt where toStatus = CONTRACTED for that deal. If no such history row, use Deal.updatedAt when status = CONTRACTED, or null.

### 5.7 Salesperson Attribution

- Prefer DealHistory.changedBy where toStatus = CONTRACTED (one row per deal). If multiple CONTRACTED rows (shouldn’t happen), use first or last by createdAt (document choice). If no DealHistory or no changedBy, attribute to “Unassigned” / null.

### 5.8 Inventory Value

- Sum of (Vehicle.purchasePrice + COALESCE(reconditioningCost,0) + COALESCE(otherCosts,0)) for vehicles in scope (e.g. status = AVAILABLE). Vehicle stores Decimal; convert to cents for API (string). Optional: total list price (listPrice) in cents.

---

## 6) API Contracts Summary (No Code)

- **GET only.** Query params: from, to, asOf, groupBy, timezone; pagination (limit, offset) where applicable.
- **Standard error shape:** `{ error: { code, message, details? } }`.
- **Money:** Always string cents in responses.
- **Rate limit:** Export endpoints MUST be rate-limited (e.g. N requests per minute per user or dealership).
- **Core routes:** See §2.2. Export routes require `reports.export`; all others require `reports.read`.

---

## 7) UI Screen Map

- **Reports landing page** (e.g. `/reports`)
  - **Date range picker:** Presets: Today, Last 7, Last 30, MTD, QTD, YTD, Custom (from/to).
  - **Summary cards:** Sales volume (totalSaleVolumeCents), Front gross (totalFrontGrossCents), Deals contracted (totalDealsCount), Finance penetration %.
  - **Charts:** Deals per day/week (from pipeline or sales summary trend); gross per period if available.
  - **Tables:** Sales by user (paginated); Inventory aging buckets (table or bar).
  - **Export buttons:** Only visible when user has `reports.export`; trigger GET /api/reports/export/sales or /inventory with from/to/asOf and format=csv; download file.
- **Permission gates:** Entire reports section requires `reports.read`; export buttons require `reports.export`. Show loading, empty, and error states; use shared components (e.g. recharts for charts).

---

## 8) Audit (Export Only)

- **Action:** `report.exported`.
- **Metadata:** reportName, from, to, asOf (for inventory), format. No PII.
- **When:** After successful generation and response of export (CSV). Write to AuditLog (core-platform).

---

## 9) Module Boundary

- **Owns:** No Prisma models in v1. Owns report service layer and route handlers: `/modules/reports/{service, ui, tests}`; routes under `/app/api/reports/**`. Report logic = pure functions per report type (sales summary, inventory aging, etc.) calling deals/inventory/finance/customers services or read-only DB with dealershipId.
- **Depends on:** core-platform (RBAC, audit, Dealership); deals (Deal, DealHistory); finance-shell (DealFinance); inventory (Vehicle); customers (Customer). No direct DB access to another module’s tables from reports DB layer—use module services or shared read scoped by dealershipId.
- **Shared:** Permissions `reports.read`, `reports.export` (seed in core-platform).

---

## Backend Checklist

- [ ] No new Prisma models for v1; rely on existing Deal, DealFinance, Vehicle, Customer and indexes listed in §1.3.
- [ ] Report service: pure functions per report (salesSummary, salesByUser, inventoryAging, financePenetration, mix, pipeline) in `/modules/reports/service`; each returns the response shape above; money as string cents; dealershipId from argument (injected by route).
- [ ] Routes under `/app/api/reports/**`: GET only; Zod for query (and params if any); requirePermission(reports.read or reports.export); resolve dealershipId from auth; call service; return JSON or CSV; rate limit export.
- [ ] Tenant scoping: every service call and query scoped by dealershipId from auth.
- [ ] Unit tests: calculation helpers (e.g. days-to-close, penetration %, aging buckets) with fixed inputs; money as string cents.
- [ ] Integration tests: tenant isolation (Dealer A cannot see Dealer B report data); RBAC (no reports.read → 403; no reports.export → 403 on export).
- [ ] Audit: on export success, write AuditLog row with action report.exported and metadata (reportName, from/to/asOf, format); no PII.
- [ ] Docs: `/docs/modules/reports.md` — purpose, scope, routes, permissions, data sources, manual test steps.

---

## Frontend Checklist

- [ ] `/reports` under AppShell; permission gate `reports.read` (redirect or hide nav if missing).
- [ ] Date range picker: Today, Last 7, Last 30, MTD, QTD, YTD, Custom; pass from/to as ISO to API.
- [ ] Summary cards: Sales volume, Front gross, Deals contracted, Finance penetration; loading/empty/error states.
- [ ] Charts (e.g. recharts): deals per day/week; gross per period where applicable.
- [ ] Tables: Sales by user (paginated, limit/offset); Inventory aging buckets.
- [ ] Export buttons: visible only with `reports.export`; trigger GET export URL with format=csv; trigger file download; handle rate limit (4xx) with message.
- [ ] Loading, empty, error states on all sections; accessibility (labels, keyboard, focus); shared components.

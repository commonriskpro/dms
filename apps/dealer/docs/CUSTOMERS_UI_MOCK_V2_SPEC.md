# Customers Page UI — UPDATED Mock Spec (V2)

**Project:** DMS Dealer App  
**Module:** Customers list page  
**Reference:** UPDATED Customer List mock (header, 5 KPI cards, **updated** filter/search row, table, pagination)  
**Stack:** Next.js App Router, Tailwind + shadcn/ui, design tokens only (no Tailwind palette colors).

---

## 1. Layout Grid and Spacing

- **Overall:** Two-column layout. Left: app sidebar (existing AppShell). Right: main content area with vertical stack.
- **Main content structure (top to bottom):**
  1. **Page header** — title "Customer List" left; action buttons right. Height consistent with other list pages. Vertical spacing below: `var(--space-grid)` or equivalent (e.g. gap-4).
  2. **Summary cards row** — 5 cards in a single horizontal row. Equal-width cards; gap between cards: `var(--space-grid)`.
  3. **Filter/Search row (UPDATED)** — full width, single row:
     - **Left:** Advanced Filters dropdown.
     - **Center:** Wide search input with placeholder "Search by name, email, phone, VIN…" and an **attached** blue (accent) search button (input + button form one control).
     - **Right:** Create Filters button + Save Search dropdown.
     - **No** compact pagination in this row; pagination lives only in the table card.
  4. **Table card** — single card containing:
     - **Top strip:** left: "Showing 1 to 10 of X entries"; right: **compact pagination** (page numbers + arrows).
     - **Table** — header row, then body rows.
     - **Bottom strip:** full-width pagination row (page numbers + arrows).
- **Spacing rules:** Use `--space-page-x`, `--space-page-y` for page padding; `--space-grid` for gaps between sections and between cards. Internal card padding and radii per tokens.

---

## 2. Component Map and Responsibilities

### 2.1 CustomersPageShell

- **Purpose:** Wraps the entire customers main content (excluding sidebar). Provides background and page padding.
- **Props:** `children: React.ReactNode`, optional `className?: string`
- **Behavior:** Uses `PageShell` (or equivalent) with `bg-[var(--page-bg)]`, `px-[var(--space-page-x)]`, `py-[var(--space-page-y)]`. Single column stack.
- **Token usage:** `--page-bg`, `--space-page-x`, `--space-page-y`

### 2.2 CustomersPageHeader

- **Purpose:** Row with page title and primary actions.
- **Props:**
  - `title: React.ReactNode` — "Customer List" (e.g. `text-2xl` or token `typography.pageTitle`)
  - `actions?: React.ReactNode` — right-aligned flex group
- **Actions (in order, left to right):**
  1. **Add Customer** — primary button (accent), "+" icon left, label "Add Customer". Links to `/customers/new` (intercepting modal).
  2. **Bulk Actions** — secondary button, list icon left, chevron-down right (dropdown). Content: e.g. Export, Assign.
  3. **Refresh** — secondary button, refresh icon, label "Refresh". Triggers server refresh (e.g. `router.refresh()`).
  4. **Small icon dropdown** — icon-only button with grid/table icon + chevron-down (view options dropdown).
- **Token usage:** `--text`, `--accent`, `--surface`, `--border`, `--radius-button`

### 2.3 CustomersSummaryCardsRow (5 cards)

- **Purpose:** One row of five KPI summary cards.
- **Props:** The five metrics (see Data contracts):
  - `totalCustomers`, `totalLeads`, `activeCustomers`, `activeCount`, `inactiveCustomers`
- **Card structure (each):** Container: rounded card, border, surface bg, padding. Top: small label (e.g. "Customers", "Leads"). Middle: large number (bold, large font). Bottom-right: small colored icon/badge (token-based).
- **Layout:** 5 equal columns; gap `var(--space-grid)`.
- **Token usage:** `--radius-card`, `--border`, `--surface`, `--shadow-card`, `--text`, `--text-soft`, semantic accent vars for icons.

### 2.4 CustomersFilterSearchBar (UPDATED)

- **Purpose:** Filter and search controls in one horizontal bar. **Must match UPDATED mock layout.**
- **Layout (left to right):**
  - **Left:** Advanced Filters dropdown (button opening a dropdown for status, source, etc.).
  - **Center:** Wide search input with placeholder "Search by name, email, phone, VIN…" and an **attached** blue search button (same height as input; button immediately adjacent to input, no gap; visually one control). Submitting (Enter or search button click) updates URL `search` param and triggers server-driven reload.
  - **Right:** Create Filters button + Save Search dropdown.
- **No pagination in this bar.** Optional: filter chips below or inline for active filters (e.g. status, search term) with remove (X).
- **Token usage:** `--surface`, `--border`, `--text`, `--text-soft`, `--radius-button`, `--radius-input`, `--accent` for search button.

### 2.5 CustomersTableCard

- **Purpose:** Card containing top info row, table, and bottom pagination.
- **Structure:**
  - **Top row:** flex; left: "Showing 1 to 10 of X entries" (small text); right: compact pagination (page numbers + prev/next). Border below.
  - **Table:** Sticky header; sortable headers where applicable. Body: one row per customer (see columns below).
  - **Bottom row:** Full pagination (page numbers + arrows). Border-top.
- **Token usage:** `--radius-card`, `--border`, `--surface`, `--text`, `--text-soft`, table recipes (`tableHeaderRow`, `tableRowHover`, `tableHeadCell`, `tableCell`).

### 2.6 Table row (CustomersRow) — columns

- **Checkbox** — row selection.
- **Name** — Avatar (circular) + name (bold) + email (smaller, muted) + chevron.
- **Contact** — Primary phone; secondary line: alternate email if different.
- **Type** — Badge (Lead / Customer / Inactive) from status.
- **Status** — Status badge (semantic tokens).
- **Vehicles** — Stacked list of vehicle strings (e.g. "2019 Silverado", "2022 Tacoma"); placeholder "—" if backend does not provide.
- **Last Visit** — Date string (e.g. "04/21/24"); placeholder if not available.
- **Deals** — Count + optional small badge; placeholder "—" if not available.
- **Source** — Lead source text.
- **Chevron** — Right-aligned chevron for navigation.
- **Interaction:** Row click (or chevron) navigates to `/customers/profile/[id]` (intercepting modal).

---

## 3. Exact Layout Rules (UPDATED search row)

- **Filter/Search row:** One row, three zones:
  - Left zone: Advanced Filters dropdown only.
  - Center zone: **Wide** search input (flex-grow or min-width) + **attached** search button (blue/accent, same height as input, no gap between input and button). Placeholder: "Search by name, email, phone, VIN…". VIN may be placeholder-only if backend does not support VIN on customers.
  - Right zone: Create Filters button, then Save Search dropdown.
- **Table card:** Top strip (entries label + compact pagination) → table → bottom pagination. No pagination in the filter row.

---

## 4. Token Usage Rules

- **No hardcoded Tailwind palette colors.** Use only:
  - `var(--page-bg)`, `var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--panel)`, `var(--muted)`
  - `var(--text)`, `var(--text-soft)`, `var(--muted-text)`
  - `var(--border)`, `var(--ring)`
  - `var(--accent)`, `var(--accent-hover)`, and semantic accents (e.g. `--accent-leads`, `--success`, `--warning`) from globals.css
- **Radius:** `var(--radius-card)`, `var(--radius-button)`, `var(--radius-input)`
- **Shadow:** `var(--shadow-card)`, `var(--shadow-card-hover)`
- **Spacing:** `var(--space-page-x)`, `var(--space-page-y)`, `var(--space-grid)`
- Use shared recipes from `@/lib/ui/recipes/layout`, `@/lib/ui/recipes/table`, `@/lib/ui/recipes/badge` where applicable.

---

## 5. Data Contracts

### 5.1 Summary metrics (server)

Required for the 5 KPI cards:

- `totalCustomers: number`
- `totalLeads: number`
- `activeCustomers: number`
- `activeCount: number`
- `inactiveCustomers: number`

Loaded server-side (e.g. `getCustomerSummaryMetrics(dealershipId)`). No client fetch for initial load.

### 5.2 Paginated list (server)

- `data: CustomerListItem[]`
- `meta: { total: number; limit: number; offset: number }`

List API must support: `limit`, `offset`, `sortBy`, `sortOrder`, `status`, `leadSource`, `assignedTo`, `search`. Search applies to name, email, phone (and VIN in placeholder if not in schema). Zod query schema whitelists `sortBy` and caps `limit`.

### 5.3 CustomerListItem (table row)

Must support table columns. Minimum: `id`, `name`, `status`, `leadSource`, `assignedTo`, `assignedToProfile`, `primaryPhone`, `primaryEmail`, `createdAt`, `updatedAt`. Optional/extended for mock parity:

- **Type:** Derived from `status` (LEAD → "Lead", ACTIVE/SOLD → "Customer", INACTIVE → "Inactive").
- **Status:** Primary = status; secondary = first tag if backend has `tags`.
- **Vehicles:** `vehicles?: string[]` — if absent, show "—".
- **Last Visit:** `lastVisit?: string` (ISO or formatted) — if absent, use `updatedAt` or "—".
- **Deals:** `dealsCount?: number` — if absent, show "—".
- **Source:** `leadSource` display value.
- **Avatar:** Optional `avatarUrl` or initials from `name`.

---

## 6. Must Match Mock Checklist (including UPDATED search row)

- [ ] **Header:** Title "Customer List"; actions in order: Add Customer, Bulk Actions, Refresh, small icon dropdown. Primary = accent; secondary = surface + border.
- [ ] **Summary cards:** Five cards; identical dimensions and spacing; large number prominent; label above; small icon/badge bottom-right.
- [ ] **Filter/Search row (UPDATED):** Left: Advanced Filters dropdown. Center: **Wide search input** with placeholder "Search by name, email, phone, VIN…" and **attached blue search button** (no gap; one visual unit). Right: Create Filters button + Save Search dropdown. **No pagination in this row.**
- [ ] **Table card:** Top strip: "Showing 1 to 10 of X entries" left; compact pagination right. Table with header row; uniform row height; subtle row borders.
- [ ] **Table columns:** Checkbox, Name (avatar + name + email + chevron), Contact, Type badge, Status badge, Vehicles (stacked or "—"), Last Visit, Deals, Source, chevron. Text left-aligned; numbers/dates consistent.
- [ ] **Badges:** Type and Status use token-based badge styles (no arbitrary Tailwind colors).
- [ ] **Avatars:** Circular; consistent size; fallback initials when no image.
- [ ] **Bottom pagination:** Below table; page numbers + arrows; current page accent.
- [ ] **Spacing:** Consistent vertical rhythm (e.g. gap-4); card padding uniform.
- [ ] **Rounded corners and borders:** All cards, buttons, inputs, badges use token radii and `--border`.

---

## 7. Navigation and Server-First

- **Row click / chevron:** Navigate to `/customers/profile/[id]`. Intercepting route shows detail modal.
- **Add Customer:** Navigate to `/customers/new`. Intercepting route shows create modal.
- **Refresh:** `router.refresh()` (server re-fetches; no client fetch-on-mount for list/summary).
- **Search:** Submit updates URL `search` (and resets `offset` to 0). Page is server-rendered with new params; server loads data and passes `initialData`. No client fetch for initial load.
- **Filters / pagination:** Update URL query params; server-driven. No client fetch-on-mount.

---

## 8. Modal Architecture (Option B)

- **Full-page routes:** `customers/page.tsx` (list), `customers/new/page.tsx` (create), `customers/[id]/page.tsx` (detail).
- **Intercepting modal routes:** `@modal/default.tsx` (null), `@modal/(.)customers/new/page.tsx`, `@modal/(.)customers/profile/[id]/page.tsx`.
- **Rules:** `/customers/new` never fetches a customer record. `/customers/profile/[id]` server-loads by UUID and passes `initialData` to modal client.

---

## 9. RBAC

- List: `customers.read`. Create UI + POST: `customers.create` (or `customers.write`). Detail: `customers.read`; update: `customers.update` or `customers.write`. Enforce on server loads and API routes.

---

## 10. Suggested shadcn Components

- **Card** (or DMSCard) — summary cards, table card container
- **Button** — Add Customer, Bulk Actions, Refresh, icon dropdown, Advanced Filters, Create Filters, Save Search, search button, pagination
- **DropdownMenu** — Bulk Actions, Save Search, Advanced Filters, view options
- **Input** — search (with attached Button for search submit)
- **Table**, **TableHeader**, **TableBody**, **TableRow**, **TableCell**, **TableHead**
- **Checkbox** — row selection
- **Badge** — Type, Status
- **Avatar** — customer photo/initials
- **Pagination** — bottom table pagination; custom compact pagination for top strip

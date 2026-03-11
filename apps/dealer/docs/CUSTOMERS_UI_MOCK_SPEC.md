# Customers Page UI — Mock Spec

**Project:** DMS Dealer App  
**Module:** Customers list page  
**Reference:** Customer List mock (DMS Auto — header, 5 summary cards, filter bar, table, pagination)  
**Stack:** Next.js App Router, Tailwind + shadcn/ui, design tokens only (no Tailwind palette colors).

---

## 1. Layout Grid and Spacing

- **Overall:** Two-column layout. Left: app sidebar (existing AppShell). Right: main content area with vertical stack.
- **Main content structure (top to bottom):**
  1. **Page header** — title "Customer List" left; action buttons right. Height consistent with other list pages (e.g. Inventory). Vertical spacing below: `var(--space-grid)` or equivalent (gap-4).
  2. **Summary cards row** — 5 cards in a single horizontal row. Equal-width cards; gap between cards: `var(--space-grid)`. Same spacing as dashboard/inventory summary rows.
  3. **Filter bar** — full width. Left: Advanced Filters button, filter chips (dismissible). Right: Create Filters button, Save Search dropdown, **compact pagination** (page numbers + arrows). Vertical spacing above/below: consistent with section stack (gap-4).
  4. **Table card** — single card containing:
     - **Top strip:** left: "Showing 1 to 10 of X entries" + optional display-density control; right: **compact pagination** (same as filter bar right).
     - **Table** — header row, then body rows. No extra title inside card above table (mock shows table directly under the top strip).
     - **Bottom strip:** full-width pagination row (page numbers 1,2,3… + arrows), centered or left-aligned per mock.
- **Spacing rules:** Use `--space-page-x`, `--space-page-y` for page padding; `--space-grid` for gaps between sections and between cards. Internal card padding: `--radius-card` for corners; consistent padding (e.g. px-4 py-3 for header row, p-4 for card content).

---

## 2. Component Map

### 2.1 CustomersPageShell

- **Purpose:** Wraps the entire customers main content (excluding sidebar). Provides background and page padding.
- **Props:** `children: React.ReactNode`, optional `className?: string`
- **Behavior:** Uses `PageShell` (or equivalent) with `bg-[var(--page-bg)]`, `px-[var(--space-page-x)]`, `py-[var(--space-page-y)]`. No layout grid inside; children are a single column stack.
- **Token usage:** `--page-bg`, `--space-page-x`, `--space-page-y`

### 2.2 CustomersPageHeader

- **Purpose:** Row with page title and primary actions.
- **Props:**
  - `title: React.ReactNode` — e.g. "Customer List" (large, bold; use `text-2xl` or token `typography.pageTitle`)
  - `actions?: React.ReactNode` — right-aligned flex group
- **Actions (in order, left to right):**
  1. **Add Customer** — primary button (blue/accent), "+" icon left, label "Add Customer". Links to `/customers/new` (opens modal via intercepting route).
  2. **Bulk Actions** — secondary button (light grey surface), list icon left, chevron-down right (dropdown). Dropdown content TBD (e.g. Export, Assign).
  3. **Refresh** — secondary button, refresh icon left, label "Refresh". Triggers server refresh (e.g. revalidatePath or router.refresh).
  4. **Table view toggle** — icon button with grid/table icon + chevron-down (dropdown for view options if needed).
- **Token usage:** `--text`, `--accent` (primary button), `--surface`, `--border`, `--radius-button`

### 2.3 CustomersSummaryCardsRow (5 cards)

- **Purpose:** One row of five summary metric cards.
- **Props:**
  - `totalCustomers: number`
  - `totalLeads: number`
  - `activeCustomers: number`
  - `activeCount: number` (e.g. "Active" sub-metric — mock shows "366" "Active" with envelope icon)
  - `inactiveCustomers: number`
- **Card structure (each):**
  - Container: `rounded-[var(--radius-card)]`, `border border-[var(--border)]`, `bg-[var(--surface)]`, subtle shadow. Equal height; padding inside (e.g. px-4 pt-4 pb-3).
  - Top: small label (e.g. "Customers", "Leads") — `text-sm text-[var(--text-soft)]` or similar.
  - Middle: large number (e.g. "1.245") — bold, large font (e.g. `text-[28px]` or token), `text-[var(--text)]`.
  - Bottom-right: small colored icon/badge (circle or square). Colors per card: use semantic tokens (e.g. `--accent` blue for customers, green for leads, orange for active, purple for inactive) — no raw Tailwind colors.
- **Layout:** CSS grid or flex; 5 equal columns; gap `var(--space-grid)`.
- **Token usage:** `--radius-card`, `--border`, `--surface`, `--shadow-card`, `--text`, `--text-soft`, semantic accent vars for icons.

### 2.4 CustomersFilterBar

- **Purpose:** Filter controls and compact pagination in one horizontal bar.
- **Props:**
  - `advancedFiltersOpen?: boolean`, `onAdvancedFiltersToggle?: () => void`
  - `chips: { id: string; label: string; onRemove: () => void }[]` — e.g. "Callbacks", "Last Visited > 90 days"
  - `onCreateFilters?: () => void` — "+ Create Filters" button
  - `onSaveSearch?: () => void` — "Save Search" dropdown
  - **Compact pagination:** `page: number`, `totalPages: number`, `onPageChange: (page: number) => void`, optional `totalEntries: number` for display elsewhere
- **Layout:** Flex; left: Advanced Filters button + chips; right: Create Filters button + Save Search + compact pagination (small rectangular page numbers + prev/next arrows).
- **Token usage:** `--surface`, `--border`, `--text`, `--text-soft`, `--radius-button`, `--accent` for selected page.

### 2.5 CustomersTableCard

- **Purpose:** Card containing the data table, top info row, and bottom pagination.
- **Props:**
  - `entriesLabel: string` — e.g. "Showing 1 to 10 of 1,245 entries"
  - `compactPagination: React.ReactNode` — same as filter bar (page + totalPages + onPageChange)
  - `children: React.ReactNode` — table (TableHeader + TableBody)
  - `bottomPagination: React.ReactNode` — full pagination row (page numbers + arrows)
  - `loading?: boolean`, `error?: string | null`, `onRetry?: () => void`
- **Structure:**
  - Outer: `Card` (shadcn) or DMSCard — `rounded-[var(--radius-card)]`, `border border-[var(--border)]`, `bg-[var(--surface)]`, shadow.
  - **Top row:** flex; left: `entriesLabel` (small text); right: `compactPagination`. Border below to separate from table.
  - **Table:** Sticky header row; sortable column headers where applicable (Name, Status, Last Visit, Deals, Source). Body: one row per customer (see CustomersRow).
  - **Bottom row:** `bottomPagination` in a strip with border-top.
- **Token usage:** `--radius-card`, `--border`, `--surface`, `--text`, `--text-soft`, table recipe classes (`tableHeaderRow`, `tableRowHover`, `tableHeadCell`, `tableCell`).

### 2.6 CustomersRow (table row)

- **Purpose:** One table row per customer; clickable to open detail modal.
- **Props:** Single object matching **CustomerListItem** (see Data Contract). Columns:
  - **Checkbox** — for row selection (optional; can be disabled if no bulk actions).
  - **Name:** Avatar (circular) + customer name (bold) + email (smaller, muted) + right chevron icon.
  - **Contact:** Primary phone; secondary line: alternate email if different.
  - **Type:** Badge (e.g. "Customer", "Lead", "Inactive") — use semantic badge tokens.
  - **Status:** One or two badges (primary status + optional tag e.g. "Callbacks", "Modotox").
  - **Vehicles:** List of vehicle strings (e.g. "2019 Silverado", "2022 Tacoma"); comma or line-separated.
  - **Last Visit:** Date string (e.g. "04/21/24").
  - **Deals:** Number + optional small badge.
  - **Source:** Lead source text (e.g. "Sunset Lead", "Walk-In", "Referral").
- **Interaction:** Row click (or chevron) navigates to `/customers/profile/[id]` (Link or router.push). Opens modal via intercepting route.
- **Token usage:** `--text`, `--muted-text`/`--text-soft`, badge recipes, `tableRowHover`, `tableCell`.

---

## 3. Exact Props Contract (Data)

### 3.1 Summary metrics (server)

- `totalCustomers: number`
- `totalLeads: number`
- `activeCustomers: number`
- `activeCount: number`
- `inactiveCustomers: number`

### 3.2 Paginated list (server)

- `data: CustomerListItem[]`
- `meta: { total: number; limit: number; offset: number }`

### 3.3 CustomerListItem (per row)

Must support table columns. Existing type has: `id`, `name`, `status`, `leadSource`, `assignedTo`, `assignedToProfile`, `primaryPhone`, `primaryEmail`, `createdAt`, `updatedAt`. Mock additionally expects:

- **Type:** Can be derived from `status` (e.g. LEAD → "Lead", ACTIVE/SOLD → "Customer", INACTIVE → "Inactive") or a separate `type` field if backend adds it.
- **Status badges:** Primary = status; secondary = first tag or "Callbacks" etc. from filters/tags. If backend has `tags: string[]`, use first tag as secondary badge.
- **Vehicles:** Array of strings (e.g. `vehicles: string[]`). Backend may need to join or aggregate deal/vehicle data per customer.
- **Last Visit:** ISO date or formatted string. Backend may need to add from activity or deal events.
- **Deals:** Count (e.g. `dealsCount: number`). Backend may need to aggregate.
- **Source:** Map `leadSource` to display (e.g. "Sunset Lead", "Walk-In").
- **Avatar:** Optional `avatarUrl?: string` or derive initials from `name`.

Backend may extend list API to include these fields or compute in a dedicated summary + list endpoint.

---

## 4. Token Usage Rules

- **No hardcoded Tailwind palette colors** (e.g. no `bg-blue-500`, `text-gray-600`). Use only:
  - `var(--page-bg)`, `var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--panel)`, `var(--muted)`
  - `var(--text)`, `var(--text-soft)`, `var(--muted-text)`
  - `var(--border)`, `var(--ring)`
  - `var(--accent)`, `var(--accent-hover)`, and any semantic accents (e.g. `--accent-leads`, `--success`, `--warning`) defined in globals.css
- **Radius:** `var(--radius-card)`, `var(--radius-button)`, `var(--radius-input)`
- **Shadow:** `var(--shadow-card)`, `var(--shadow-card-hover)`
- **Spacing:** `var(--space-page-x)`, `var(--space-page-y)`, `var(--space-grid)`
- Use shared recipes from `@/lib/ui/recipes/layout`, `@/lib/ui/recipes/table`, `@/lib/ui/recipes/badge` where applicable.

---

## 5. Navigation Rules

- **Row click (or chevron):** Navigate to `/customers/profile/[id]`. Next.js intercepting route `(.)customers/profile/[id]` displays detail in a modal over the list. Use `<Link href={/customers/profile/${row.id}}>` or programmatic navigation so soft navigation applies.
- **Add Customer button:** Navigate to `/customers/new`. Intercepting route `(.)customers/new` displays create form in a modal.
- **Refresh button:** Trigger server refresh (e.g. `router.refresh()` and/or revalidate) so list and summary refetch server-side. No client fetch-on-mount for initial list/summary.
- **Filters / pagination:** Update URL query params (e.g. `?page=1&limit=10&status=LEAD`). Page is server-rendered with these params; server loads data and passes `initialData` to client. No client fetch for initial load.

---

## 6. Modal Architecture (Option B)

- **Full-page routes (for direct URL / refresh):**  
  `app/(app)/customers/page.tsx` (list), `app/(app)/customers/new/page.tsx` (create), `app/(app)/customers/profile/[id]/page.tsx` (detail).
- **Intercepting modal routes:**  
  `app/(app)/@modal/default.tsx` (null),  
  `app/(app)/@modal/(.)customers/new/page.tsx` (modal create),  
  `app/(app)/@modal/(.)customers/profile/[id]/page.tsx` (modal detail).
- **Rules:**  
  - `/customers/new` never fetches a customer record.  
  - `/customers/profile/[id]` server-loads customer by UUID and passes `initialData` to the modal client component.

---

## 7. Must Match Mock Checklist (Pixel Intent)

- [ ] **Header:** Title "Customer List" size and weight match; action buttons same height and order (Add Customer, Bulk Actions, Refresh, Table view). Primary button uses accent; secondary use surface + border.
- [ ] **Summary cards:** Five cards; identical dimensions and spacing; large number prominent; label above; small icon/badge bottom-right. No layout shift between cards.
- [ ] **Filter bar:** Advanced Filters + chips left; Create Filters + Save Search + compact pagination right. Chips have remove (X). Compact pagination: small page numbers, current page highlighted with accent.
- [ ] **Table card:** Top strip: "Showing 1 to 10 of X entries" left; compact pagination right. Table header: light grey background, sortable headers with chevron where indicated. Row height uniform; borders between rows subtle.
- [ ] **Table columns:** Checkbox, Name (avatar + name + email + chevron), Contact, Type, Status, Vehicles, Last Visit, Deals, Source. Alignment: text left; numbers/dates consistent.
- [ ] **Badges:** Type and Status use token-based badge styles (green/blue/orange/grey) — no arbitrary Tailwind colors.
- [ ] **Avatars:** Circular; size consistent; fallback initials when no image.
- [ ] **Bottom pagination:** Centered or left below table; page numbers + arrows; current page accent.
- [ ] **Spacing:** Consistent vertical rhythm (e.g. gap-4 between sections); card internal padding uniform.
- [ ] **Rounded corners:** All cards, buttons, inputs, badges use token radii.
- [ ] **Borders:** Light grey (`--border`) throughout; no heavy borders.

---

## 8. Suggested shadcn Components

- **Card** (or DMSCard) — summary cards, table card container
- **Button** — Add Customer, Bulk Actions, Refresh, Table view, Advanced Filters, Create Filters, Save Search, pagination controls
- **DropdownMenu** — Bulk Actions, Save Search, Table view options
- **Table**, **TableHeader**, **TableBody**, **TableRow**, **TableCell**, **TableHead**
- **Checkbox** — row selection
- **Badge** — Type, Status, tags
- **Avatar** — customer photo/initials
- **Input** — search (if present in header)
- **Separator** — optional; prefer border utilities for table and strips

---

## 9. Server-First and RBAC

- List page: **Server component** calls `noStore()`, loads list + summary via **services** (not fetch to `/api/customers` from client). Passes `initialData` to **CustomersPageClient**.
- **RBAC:** Server denies render/load when user lacks `customers.read`. Create flow requires `customers.create` or `customers.write`; detail requires `customers.read`; update requires `customers.update` or `customers.write`.
- Client component **must not** fetch list or summary on mount; it receives `initialData` and uses URL/searchParams for filters/pagination to trigger server updates (e.g. navigation with new query).

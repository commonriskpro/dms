# Mobile Customers Epic — Spec

## 1. Current mobile architecture and routing

- **Stack**: React Native, Expo, Expo Router (file-based). Tabs: Dashboard, Inventory, Customers, Deals, More.
- **Customers**: `(tabs)/customers/` — Stack with `index` (list), `[id]` (detail). List: search, FlatList, pull-to-refresh, tap row → `/(tabs)/customers/[id]`. Detail: fetch by id, simple cards for name/status/phone/email and a placeholder for quick actions.
- **Auth/API**: Session and `dealerFetch` with Bearer token; tenant implied by backend from auth. No customer-specific context beyond query keys.
- **Patterns**: useQuery for fetch, inline styles, no shared customer form or section components yet.

## 2. Current customer list and search state

- **List**: `api.listCustomers({ limit, offset, search })`. Query key: `["customers", { search, limit, offset }]`. Local state: `search`, `refreshing`. No add button in current UI.
- **Detail**: `api.getCustomerById(id)`. Query key: `["customers", id]`. Backend returns full customer (phones[], emails[], assignedToProfile, address fields, tags) but mobile types use legacy list shape (primaryPhone, primaryEmail on list item). Detail response is richer than `CustomerItem`.

## 3. Target customer experience on mobile

- **List**: Keep search and list; add an "Add customer" action (header or FAB). Tap row → detail.
- **Detail**: Single hub screen with:
  - **Top**: Name, quick contact (call/text/email if supported), Edit button, summary (phone, email, source, status, assigned).
  - **Sections**: Overview (key fields), Notes (list + add), Activity (timeline), Deals (list rows), Communication (history or shell).
- **Add customer**: Form (name required; phone, email, source, optional notes); submit → create → invalidate list → navigate to new customer detail or back to list with refresh.
- **Edit customer**: Same form prefilled; save → PATCH → invalidate detail + list → stay on detail or go back.
- No desktop-style tabs; use a single scrollable detail with clear section headings.

## 4. Proposed screen map

| Route | Screen | Purpose |
|-------|--------|--------|
| `(tabs)/customers/index` | CustomersListScreen | List + search; add button → add screen |
| `(tabs)/customers/[id]` | CustomerDetailScreen | Detail hub: overview, notes, activity, deals, communication |
| `(tabs)/customers/add` | AddCustomerScreen | Create customer form |
| `(tabs)/customers/[id]/edit` | EditCustomerScreen | Edit customer form (reuse form component) |

Navigation: List → Detail (tap row). Detail → Edit (edit button). List → Add (button). Add success → Detail (new id) or List. Edit success → Detail with refetch.

## 5. API dependencies

| Action | Method | Path | Body/Query | Notes |
|--------|--------|------|------------|--------|
| List customers | GET | `/api/customers` | limit, offset, search, status?, leadSource?, assignedTo?, sortBy, sortOrder | Already used |
| Get customer | GET | `/api/customers/[id]` | — | Returns phones[], emails[], assignedToProfile, address, tags |
| Create customer | POST | `/api/customers` | name, leadSource?, status?, assignedTo?, address*, tags?, phones?, emails? | name required; phones/emails arrays |
| Update customer | PATCH | `/api/customers/[id]` | Same fields as create (partial) | |
| List notes | GET | `/api/customers/[id]/notes` | limit, offset | Returns { data, meta }; note: id, body, createdBy, createdAt, createdByProfile |
| Create note | POST | `/api/customers/[id]/notes` | body | 201 with created note |
| List timeline | GET | `/api/customers/[id]/timeline` | limit, offset, type? (NOTE\|CALL\|CALLBACK\|APPOINTMENT\|SYSTEM) | Returns { data, meta }; event: type, createdAt, createdByUserId, payloadJson, sourceId |
| List deals (by customer) | GET | `/api/deals` | customerId, limit, offset | Serialized deal with vehicle, status, salePriceCents, totalDueCents |
| Log call | POST | `/api/customers/[id]/calls` | summary?, durationSeconds?, direction? | Optional for "communication" |

Communication history: No dedicated "communication history" list endpoint. Timeline includes CALL; optional POST calls. SMS/email sending not in scope for this epic; show timeline + empty state for a "Communication" section if desired.

## 6. Data model needed by the mobile UI

- **Customer (detail)**: id, name, status, leadSource, assignedTo, assignedToProfile { id, fullName, email }, phones[] { id?, kind?, value, isPrimary }, emails[] { id?, kind?, value, isPrimary }, addressLine1–country, tags[], createdAt, updatedAt. Derive primary phone/email: first with isPrimary or first in array.
- **Customer (list item)**: Existing CustomerItem (id, name, status, leadSource, primaryPhone, primaryEmail, createdAt, updatedAt).
- **Create/update payload**: name (required), leadSource?, status?, assignedTo?, phones?: { value, kind?, isPrimary? }[], emails?: { value, kind?, isPrimary? }[], address fields?, tags?.
- **Note**: id, body, createdBy, createdAt, createdByProfile? { fullName, email }.
- **Timeline event**: type (NOTE|CALL|CALLBACK|APPOINTMENT|SYSTEM), createdAt (ISO), createdByUserId, payloadJson, sourceId.
- **Deal (for list)**: id, customerId, vehicleId, status, salePriceCents (string), totalDueCents (string), vehicle? { year, make, model, stockNumber }, customer? { name }.

## 7. Notes, activity, communication, deals assumptions

- **Notes**: List and create only in this epic; edit/delete exist on backend (PATCH/DELETE note by noteId) — can wire in a follow-up. Show notes in a dedicated section; add-note inline or small modal.
- **Activity**: Use timeline API; render as vertical timeline; types NOTE, CALL, CALLBACK, APPOINTMENT, SYSTEM with readable labels. No fake events.
- **Deals**: List via GET /api/deals?customerId=; each row: vehicle/title, stage/status, amount. Link to existing deal detail `/(tabs)/deals/[id]`.
- **Communication**: No separate "communication history" API. Use timeline (CALL) and optional "Log call" from detail. Section can show "Recent activity" or a dedicated "Communication" header with timeline filtered by call-type or empty state.

## 8. Edge cases

- Customer not found / 403: Show not-found or unauthorized message; back to list.
- Empty notes/timeline/deals: Show empty state with "Add note" or "No deals" etc.
- Create customer validation: Required name; optional email/phone with basic format check; backend returns 400 with field errors.
- Invalidation: After create → invalidate ["customers"]; after update/note create → invalidate ["customers"], ["customers", id].
- Deal list by customer: Only show when customerId is set; use same permission as deals.read.

## 9. Acceptance criteria

- Detail shows full customer info; primary phone/email derived from arrays when needed.
- Add customer: form validation; on success navigate to new customer detail or list with fresh data.
- Edit customer: form prefilled; save updates customer; detail and list refetch.
- Notes section: list notes; add note; list refetches after add.
- Activity section: timeline from API; no fabricated events.
- Deals section: list deals for customer; rows link to deal detail.
- Communication: shell with timeline or empty state; no fake history.
- All flows tenant-scoped via existing auth; no cross-tenant data.
- Loading/error/empty states handled; large touch targets; keyboard-safe forms.

## 10. Files to touch (implementation summary)

- **Spec**: `apps/mobile/docs/MOBILE_CUSTOMERS_EPIC_SPEC.md` (this file).
- **API**: `src/api/endpoints.ts` — CustomerDetail, CreateCustomerBody, UpdateCustomerBody, CustomerNote, TimelineEvent, listDeals(customerId); createCustomer, updateCustomer, listCustomerNotes, createCustomerNote, listCustomerTimeline.
- **Screens**: `app/(tabs)/customers/[id].tsx` — full detail hub; `app/(tabs)/customers/add.tsx`; `app/(tabs)/customers/edit/_layout.tsx` + `edit/[id].tsx`.
- **Components**: `src/features/customers/components/` — CustomerHeaderCard, CustomerOverviewCard, CustomerNotesSection, CustomerActivitySection, CustomerDealsSection, CustomerCommunicationSection, CustomerForm; `src/features/customers/utils.ts`, `form-validation.ts`.
- **Layout**: `app/(tabs)/customers/_layout.tsx` — Stack screens: index, add, [id], edit.
- **List**: `app/(tabs)/customers/index.tsx` — "Add" button; list and search unchanged.
- **Tests**: `src/features/customers/__tests__/utils.test.ts`, `form-validation.test.ts`.

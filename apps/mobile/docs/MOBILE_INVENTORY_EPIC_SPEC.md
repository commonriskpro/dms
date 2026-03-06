# Mobile Inventory Epic — Spec

## 1. Architecture overview

- **Stack**: React Native, Expo (SDK 55), Expo Router. Tabs: Dashboard, Inventory, Customers, Deals, More.
- **Inventory today**: `(tabs)/inventory/` — Stack with `index` (list + search), `[id]` (minimal detail: stock#, vehicle, VIN, status, photos placeholder). List uses `api.listInventory`, detail uses `api.getInventoryById`. No add/edit, no VIN scan, no photo upload.
- **Auth/API**: Session and `dealerFetch` with Bearer token; dealership scoping enforced by backend. Same patterns as customers epic.
- **Target**: Full vehicle detail hub, add vehicle, edit vehicle, VIN scanner (expo-camera), photo upload (camera + gallery), recon/status display.

## 2. Screen map

| Route | Screen | Purpose |
|-------|--------|--------|
| `(tabs)/inventory/index` | InventoryListScreen | List + search; Add button → add |
| `(tabs)/inventory/[id]` | VehicleDetailScreen | Detail hub: header, overview, photos, pricing, recon, notes |
| `(tabs)/inventory/add` | AddVehicleScreen | Create vehicle form; optional VIN scan entry |
| `(tabs)/inventory/edit/[id]` | EditVehicleScreen | Edit form (reuse VehicleForm) |

Navigation: List → Detail (tap row). Detail → Edit (edit button). List → Add (button). Add success → Detail (new id). Edit success → Detail with refetch.

## 3. Data model used by mobile

- **Vehicle (list item)**: id, dealershipId, vin, year, make, model, trim, stockNumber, mileage, color, status, salePriceCents (string), createdAt, updatedAt. Already in `InventoryItem`.
- **Vehicle (detail)**: Same as list + `photos[]` (id, fileObjectId, filename, mimeType, sizeBytes, sortOrder, isPrimary, createdAt), optional `intelligence` (priceToMarket, daysToTurn). Backend GET /api/inventory/[id] returns this.
- **Create body**: vin?, year?, make?, model?, trim?, stockNumber (required), mileage?, color?, status?, salePriceCents? (string or number). Backend accepts optional VIN max 17; stockNumber min 1.
- **Update body**: Partial of create.
- **Photo**: id, fileObjectId, filename, mimeType, sizeBytes, sortOrder, isPrimary, createdAt.
- **Recon**: GET /api/inventory/[id]/recon returns data: { id, vehicleId, status, dueDate, totalCents, lineItems[] } or null. Line item: id, description, costCents, category, sortOrder.
- **Recon items (alternate)**: GET /api/inventory/[id]/recon/items returns data: { items[], totals }.

## 4. API endpoints required

| Action | Method | Path | Body/Query | Notes |
|--------|--------|------|------------|--------|
| List vehicles | GET | `/api/inventory` | limit, offset, search, status | Exists |
| Get vehicle | GET | `/api/inventory/[id]` | — | Returns vehicle + photos + intelligence |
| Create vehicle | POST | `/api/inventory` | createBodySchema | stockNumber required |
| Update vehicle | PATCH | `/api/inventory/[id]` | updateBodySchema (partial) | |
| List photos | GET | `/api/inventory/[id]/photos` | — | Or use photos in GET detail |
| Upload photo | POST | `/api/inventory/[id]/photos` | formData "file" (File) | multipart/form-data |
| Delete photo | DELETE | `/api/inventory/[id]/photos/[fileId]` | — | Exists |
| VIN decode | POST | `/api/inventory/vin-decode` | { vin } | Returns decoded + vehicle (year, make, model, trim, etc.) |
| Get recon | GET | `/api/inventory/[id]/recon` | — | data or null |
| List recon items | GET | `/api/inventory/[id]/recon/items` | — | items + totals |

## 5. VIN scanning workflow

1. User taps "Scan VIN" on Add (or Edit) vehicle screen.
2. Modal/screen with camera view (expo-camera) in barcode scanning mode; user points at VIN barcode.
3. On scan: parse code (strip non-alphanumeric), validate length 17; if valid, close scanner and populate VIN field; optionally call VIN decode API to prefill year/make/model/trim.
4. Fallback: manual VIN entry in form; optional "Decode" button to call POST /api/inventory/vin-decode and fill fields.
5. Permissions: request camera permission before showing scanner; show message if denied.
6. Do not add heavy scanning libs; use Expo (expo-camera) only.

## 6. Photo upload workflow

1. Vehicle detail shows photo grid (from GET detail or GET photos). Empty state when no photos.
2. "Add photo" → action sheet: "Take photo" | "Choose from library". Take photo: expo-image-picker launchCameraAsync. Choose: launchImageLibraryAsync.
3. On pick: get URI (and optionally type/size). Upload via POST /api/inventory/[id]/photos with FormData: append "file" with { uri, name, type } (React Native FormData format). Do not set Content-Type header (let runtime set multipart boundary).
4. On success: invalidate vehicle detail (and photos query if separate). Add new photo to list.
5. Delete: if user can delete, call DELETE /api/inventory/[id]/photos/[fileId]; then invalidate.
6. Tap photo → full-screen preview (modal or simple full-screen image).

## 7. Recon / status display

- **Status**: Backend vehicle status enum: AVAILABLE, HOLD, SOLD, WHOLESALE, REPAIR, ARCHIVED. Show as badge on list and detail.
- **Recon**: If GET /api/inventory/[id]/recon returns data, show a Recon section: status, dueDate, totalCents, line items list (description, costCents). If null, show "No recon" or hide section. Alternative: use GET recon/items for line items and totals.
- No fake recon data; status badge only if recon not available.

## 8. Edge cases

- Vehicle not found / 403: Show message; back to list.
- Invalid VIN: Validate length (17) and charset; show inline error. Backend VIN decode can return INVALID_VIN.
- Photo upload failure: Show error; allow retry. Rate limit 429: show "Too many uploads".
- Camera permission denied: Show message and fallback to manual VIN entry.
- Create validation: stockNumber required; VIN optional but if provided max 17; price/mileage numeric.
- Invalidation: After create → invalidate ["inventory"]; after update/photo add/delete → invalidate ["inventory"], ["inventory", id].

## 9. Acceptance criteria

- Detail shows year/make/model, VIN, price, mileage, status, stock number, color, photos, recon if present.
- Add vehicle: form with all fields; VIN scan populates VIN (and optionally decode fills year/make/model/trim); on success navigate to new vehicle detail.
- Edit vehicle: form prefilled; PATCH; invalidate and return to detail.
- VIN scanner: camera scan or manual entry; decode optional.
- Photos: grid, add (camera/gallery), upload, delete if API exists; full-screen preview on tap.
- Recon/status: status badge; recon section when API returns data.
- All flows dealership-scoped; loading/error/empty handled; large touch targets; keyboard-safe form.

## 10. Files to touch (implementation summary)

- **Spec**: `apps/mobile/docs/MOBILE_INVENTORY_EPIC_SPEC.md` (this file).
- **API**: `src/api/endpoints.ts` — VehicleDetail, VehiclePhoto, CreateVehicleBody, UpdateVehicleBody, VinDecodeResponse, VehicleReconResponse; createVehicle, updateVehicle, decodeVin, uploadVehiclePhoto, deleteVehiclePhoto, getVehicleRecon, getFileSignedUrl.
- **API client**: `src/api/client.ts` — dealerFetchFormData for multipart photo upload.
- **Screens**: `app/(tabs)/inventory/[id].tsx` (full detail with photos, recon); `app/(tabs)/inventory/add.tsx`; `app/(tabs)/inventory/edit/_layout.tsx`, `edit/[id].tsx`.
- **Components**: `src/features/inventory/components/` — VehicleHeaderCard, VehicleOverviewCard, VehiclePricingCard, VehiclePhotoSection, VehicleReconSection, VehicleForm, VinScannerModal (manual VIN entry + Decode).
- **Utils**: `src/features/inventory/utils.ts`, `form-validation.ts`; VIN normalize/validate/parse.
- **Layout**: `app/(tabs)/inventory/_layout.tsx` — Stack: index, add, [id], edit.
- **List**: `app/(tabs)/inventory/index.tsx` — Add button; row shows price.
- **Tests**: `src/features/inventory/__tests__/utils.test.ts`, `form-validation.test.ts`.
- **Dependency**: expo-image-picker for camera/gallery photo upload.

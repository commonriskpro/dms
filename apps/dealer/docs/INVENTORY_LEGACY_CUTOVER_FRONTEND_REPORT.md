# Inventory Legacy Cutover — Frontend Report

**Step 3 deliverables.** Minimal frontend updates to consume aligned photo shape; no UX or flow changes.

---

## A. Vehicle detail / media consumer alignment

**Changes made:**

- **Types:** `VehiclePhotoResponse` in `modules/inventory/ui/types.ts` was updated to the canonical inventory photo shape: added optional `fileObjectId`, `sortOrder`, `isPrimary`. Existing fields `id`, `filename`, `mimeType`, `sizeBytes`, `createdAt` unchanged. This matches GET `/api/inventory/[id]` and GET `/api/inventory/[id]/photos` response shape.
- **Consumers:** No component or hook changes were required. `VehicleDetailPage` fetches vehicle via GET [id]; the returned `photos` array now includes sortOrder and isPrimary when present. `VehiclePhotosManager` and photo list consumers already use the photos list API (GET [id]/photos) which already had this shape; GET [id] is used for the initial detail payload and is now aligned. Any consumer that only used `id`, `filename`, `mimeType`, `sizeBytes`, `createdAt` continues to work; those that need order/primary can use the new fields.

**No UX redesign, no fetch-on-mount changes, no change to upload/reorder/primary flows.**

---

## B. Optional targeted UI regression tests

Not added. Backend list and route tests plus type-level alignment are sufficient for this cutover. If needed later, add tests for detail photo rendering with aligned shape.

---

## C. Summary

- **Updated:** `VehiclePhotoResponse` type to include optional `fileObjectId`, `sortOrder`, `isPrimary`.
- **Unchanged:** VehicleDetailContent, EditVehicleUi, VehiclePhotosManager behavior and flows.
- **Result:** Frontend is aligned to the canonical photo shape with minimal, additive type changes only.

---

*Frontend step complete. Proceed to Step 4 (Security & QA).*

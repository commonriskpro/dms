-- CreateIndex: optimize GET /api/vendors/[id]/cost-entries (list by dealershipId + vendorId)
CREATE INDEX "vehicle_cost_entry_dealership_id_vendor_id_idx" ON "vehicle_cost_entry"("dealership_id", "vendor_id");

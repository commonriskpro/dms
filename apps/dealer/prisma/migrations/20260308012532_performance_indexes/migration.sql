-- AlterTable
ALTER TABLE "AuctionListingCache" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DealershipInvite" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FloorplanLoan" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InventorySourceLead" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PendingApproval" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PricingRule" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReconItem" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SavedFilter" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SavedSearch" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "VehicleAppraisal" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VehicleBookValue" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VehicleFloorplan" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VehicleListing" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VehicleMarketValuation" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VehicleRecon" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VehicleReconLineItem" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "DealFinanceProduct_deal_finance_id_dealership_id_idx" ON "DealFinanceProduct"("deal_finance_id", "dealership_id");

-- CreateIndex
CREATE INDEX "DealershipInvite_token_idx" ON "DealershipInvite"("token");

-- CreateIndex
CREATE INDEX "FinanceSubmission_dealership_id_funding_status_status_idx" ON "FinanceSubmission"("dealership_id", "funding_status", "status");

-- CreateIndex
CREATE INDEX "Membership_user_id_dealership_id_idx" ON "Membership"("user_id", "dealership_id");

-- RenameIndex
ALTER INDEX "AccountingTransaction_dealership_id_reference_type_reference_id" RENAME TO "AccountingTransaction_dealership_id_reference_type_referenc_idx";

-- RenameIndex
ALTER INDEX "Customer_last_visit_at_idx" RENAME TO "Customer_dealership_id_last_visit_at_idx";

-- RenameIndex
ALTER INDEX "InventoryAlertDismissal_dealership_id_user_id_vehicle_id_alert_" RENAME TO "InventoryAlertDismissal_dealership_id_user_id_vehicle_id_al_key";

-- RenameIndex
ALTER INDEX "Role_dealershipId_key_key" RENAME TO "Role_dealership_id_key_key";

/**
 * Report export: CSV generation for sales and inventory. No PII in audit.
 */
import type { VehicleStatus } from "@prisma/client";
import * as reportsDb from "../db/sales";
import * as reportsInventoryDb from "../db/inventory";
import * as costLedger from "@/modules/inventory/service/cost-ledger";

/** Escapes a CSV cell: quotes and doubles internal quotes if value contains comma, quote, or newline. Exported for tests. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toDateStart(isoDate: string): Date {
  const d = new Date(isoDate);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateEnd(isoDate: string): Date {
  const d = new Date(isoDate);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type ExportSalesParams = {
  dealershipId: string;
  from: string;
  to: string;
};

export async function exportSalesCsv(params: ExportSalesParams): Promise<string> {
  const { dealershipId, from, to } = params;
  const fromDate = toDateStart(from);
  const toDate = toDateEnd(to);

  const rows = await reportsDb.listContractedDealsForExport(
    dealershipId,
    fromDate,
    toDate
  );

  const header = "date,dealId,customerName,salePriceCents,frontGrossCents,financingMode";
  const lines = [
    header,
    ...rows.map((r) =>
      [
        r.createdAt.toISOString().slice(0, 10),
        r.id,
        escapeCsvCell(r.customerName),
        r.salePriceCents.toString(),
        r.frontGrossCents.toString(),
        r.financingMode ?? "UNKNOWN",
      ].join(",")
    ),
  ];
  return lines.join("\n");
}

export type ExportInventoryParams = {
  dealershipId: string;
  asOf?: string;
  status?: VehicleStatus;
};

export async function exportInventoryCsv(
  params: ExportInventoryParams
): Promise<string> {
  const { dealershipId, asOf, status } = params;
  const asOfDate = asOf ? new Date(asOf) : new Date();

  const rows = await reportsInventoryDb.listVehiclesForExport(
    dealershipId,
    asOfDate,
    status
  );

  const vehicleIds = rows.map((r) => r.id);
  const totalsMap =
    vehicleIds.length > 0
      ? await costLedger.getCostTotalsForVehicles(dealershipId, vehicleIds)
      : new Map<string, { totalInvestedCents: bigint }>();

  const header = "vin,stockNumber,status,daysInInventory,purchaseValueCents";
  const lines = [
    header,
    ...rows.map((r) => {
      const purchaseValueCents =
        totalsMap.get(r.id)?.totalInvestedCents ?? BigInt(0);
      return [
        escapeCsvCell(r.vin),
        escapeCsvCell(r.stockNumber),
        r.status,
        r.daysInInventory,
        purchaseValueCents.toString(),
      ].join(",");
    }),
  ];
  return lines.join("\n");
}

import type { VehicleDetail, InventoryItem } from "@/api/endpoints";

export function vehicleTitle(v: { year?: number | null; make?: string | null; model?: string | null; trim?: string | null }): string {
  const parts = [v.year, v.make, v.model, v.trim].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle";
}

export function formatCentsToDisplay(cents: string | number): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n / 100);
}

export function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null) return "—";
  return new Intl.NumberFormat("en-US").format(mileage) + " mi";
}

/** VIN: 17 alphanumeric (excluding I,O,Q). Normalize for display/API. */
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;
export function normalizeVin(input: string): string {
  return input.replace(/\s/g, "").toUpperCase().replace(/[IOQ]/gi, "");
}

export function isValidVin(vin: string): boolean {
  const n = normalizeVin(vin);
  return n.length === 17 && VIN_REGEX.test(n);
}

export function parseVinFromBarcode(code: string): string {
  const n = code.replace(/\s/g, "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  return n.length >= 17 ? n.slice(0, 17) : n;
}

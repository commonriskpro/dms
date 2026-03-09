export type VehicleFormValues = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  stockNumber: string;
  mileage: string;
  priceDollars: string;
  color: string;
  status: string;
};

const STATUS_OPTIONS = ["AVAILABLE", "HOLD", "SOLD", "WHOLESALE", "REPAIR", "ARCHIVED"];
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function validateVehicleForm(values: VehicleFormValues): {
  stockNumber?: string;
  vin?: string;
  year?: string;
  mileage?: string;
  priceDollars?: string;
} {
  const err: Record<string, string> = {};
  if (!values.stockNumber.trim()) err.stockNumber = "Stock number is required";
  if (values.vin.trim()) {
    const normalized = values.vin.replace(/\s/g, "").toUpperCase();
    if (normalized.length !== 17) err.vin = "VIN must be 17 characters";
    else if (!VIN_REGEX.test(normalized)) err.vin = "Invalid VIN characters";
  }
  if (values.year.trim()) {
    const y = parseInt(values.year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) err.year = "Enter a valid year";
  }
  if (values.mileage.trim()) {
    const m = parseInt(values.mileage, 10);
    if (Number.isNaN(m) || m < 0) err.mileage = "Enter a valid mileage";
  }
  if (values.priceDollars.trim()) {
    const p = parseFloat(values.priceDollars);
    if (Number.isNaN(p) || p < 0) err.priceDollars = "Enter a valid price";
  }
  return err;
}

export function statusOptions(): string[] {
  return STATUS_OPTIONS;
}

import { z } from "zod";
import { parseDollarsToCents } from "@/lib/money";

export const vehicleStatusSchema = z.enum([
  "AVAILABLE",
  "HOLD",
  "SOLD",
  "WHOLESALE",
  "REPAIR",
  "ARCHIVED",
]);

const optionalString = z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim()));
const optionalPositiveNumber = z.union([
  z.string().transform((s) => (s === "" ? undefined : Number(s))),
  z.number(),
]).optional().refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), "Must be 0 or greater");
/** Optional dollar input (e.g. "1234.56" or ""). Invalid non-empty values fail refinement. */
const optionalDollarString = z
  .string()
  .optional()
  .transform((s) => (s?.trim() === "" ? undefined : s?.trim()))
  .refine(
    (s) => s === undefined || parseDollarsToCents(s) !== "",
    "Enter a valid dollar amount (e.g. 1234.56)"
  );

export const vehicleFormSchema = z.object({
  vin: z.string().max(17).optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  year: z.union([
    z.string().transform((s) => (s === "" ? undefined : Number(s))),
    z.number(),
  ]).optional().refine((v) => v === undefined || (!Number.isNaN(v) && v >= 1900 && v <= 2100), "Invalid year"),
  make: optionalString,
  model: optionalString,
  trim: optionalString,
  stockNumber: z.string().min(1, "Stock number is required").transform((s) => s.trim()),
  mileage: z.union([
    z.string().transform((s) => (s === "" ? undefined : Number(s))),
    z.number(),
  ]).optional().refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), "Must be 0 or greater"),
  color: optionalString,
  status: vehicleStatusSchema.optional(),
  salePriceDollars: optionalDollarString,
  auctionCostDollars: optionalDollarString,
  transportCostDollars: optionalDollarString,
  reconCostDollars: optionalDollarString,
  miscCostDollars: optionalDollarString,
  locationId: z.string().uuid().optional().or(z.literal("")).transform((s) => (s === "" ? undefined : s)),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

/** Map form values to API create/update body. Dollar strings converted to cents via parseDollarsToCents. */
export function formToApiBody(values: VehicleFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    stockNumber: values.stockNumber,
  };
  const num = (v: unknown): v is number =>
    typeof v === "number" && !Number.isNaN(v);
  if (values.vin !== undefined) body.vin = values.vin;
  if (values.year !== undefined && num(values.year)) body.year = values.year;
  if (values.make !== undefined) body.make = values.make;
  if (values.model !== undefined) body.model = values.model;
  if (values.trim !== undefined) body.trim = values.trim;
  if (values.mileage !== undefined && num(values.mileage)) body.mileage = values.mileage;
  if (values.color !== undefined) body.color = values.color;
  if (values.status !== undefined) body.status = values.status;
  if (values.locationId !== undefined) body.locationId = values.locationId;

  const saleCents = values.salePriceDollars != null ? parseDollarsToCents(values.salePriceDollars) : "";
  if (saleCents !== "") body.salePriceCents = saleCents;
  const auctionCents = values.auctionCostDollars != null ? parseDollarsToCents(values.auctionCostDollars) : "";
  if (auctionCents !== "") body.auctionCostCents = auctionCents;
  const transportCents = values.transportCostDollars != null ? parseDollarsToCents(values.transportCostDollars) : "";
  if (transportCents !== "") body.transportCostCents = transportCents;
  const reconCents = values.reconCostDollars != null ? parseDollarsToCents(values.reconCostDollars) : "";
  if (reconCents !== "") body.reconCostCents = reconCents;
  const miscCents = values.miscCostDollars != null ? parseDollarsToCents(values.miscCostDollars) : "";
  if (miscCents !== "") body.miscCostCents = miscCents;

  return body;
}

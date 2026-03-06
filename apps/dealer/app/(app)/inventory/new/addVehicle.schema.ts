import { z } from "zod";
import { parseDollarsToCents } from "@/lib/money";

/** VIN: if present, must be 17 characters. */
const vinSchema = z
  .string()
  .max(17)
  .optional()
  .transform((s) => (s?.trim() === "" ? undefined : s?.trim()))
  .refine((v) => v == null || v.length === 17, { message: "VIN must be 17 characters" });

/** Mileage >= 0. */
const mileageSchema = z.union([
  z.string().transform((s) => (s === "" ? undefined : Number(s))),
  z.number(),
]).optional().refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), "Must be 0 or greater");

/** Optional dollar input; invalid non-empty fails. */
const optionalDollarString = z
  .string()
  .optional()
  .transform((s) => (s?.trim() === "" ? undefined : s?.trim()))
  .refine(
    (s) => s === undefined || parseDollarsToCents(s) !== "",
    "Enter a valid dollar amount"
  );

export const vehicleStatusSchema = z.enum([
  "AVAILABLE",
  "HOLD",
  "SOLD",
  "WHOLESALE",
  "REPAIR",
  "ARCHIVED",
]);

export const addVehicleFormSchema = z.object({
  vin: vinSchema,
  stockNumber: z.string().min(1, "Stock number is required").transform((s) => s.trim()),
  year: z.union([
    z.string().transform((s) => (s === "" ? undefined : Number(s))),
    z.number(),
  ]).optional().refine((v) => v === undefined || (!Number.isNaN(v) && v >= 1900 && v <= 2100), "Invalid year"),
  make: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  model: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  trim: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  mileage: mileageSchema,
  color: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  bodyStyle: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  transmission: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  fuelType: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
  status: vehicleStatusSchema.optional(),
  floorplan: z.string().optional(),
  auctionCostDollars: optionalDollarString,
  transportCostDollars: optionalDollarString,
  reconCostDollars: optionalDollarString,
  miscCostDollars: optionalDollarString,
  salePriceDollars: optionalDollarString,
  postOnline: z.boolean().optional(),
  postFacebook: z.boolean().optional(),
  postWebsite: z.boolean().optional(),
  postMarketplace: z.boolean().optional(),
  notes: z.string().optional().transform((s) => (s?.trim() === "" ? undefined : s?.trim())),
});

export type AddVehicleFormValues = z.infer<typeof addVehicleFormSchema>;

/** Convert form values to API create body (money as cents strings). */
export function addVehicleFormToApiBody(values: AddVehicleFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    stockNumber: values.stockNumber,
  };
  if (values.vin !== undefined) body.vin = values.vin;
  if (values.year !== undefined && typeof values.year === "number" && !Number.isNaN(values.year)) body.year = values.year;
  if (values.make !== undefined) body.make = values.make;
  if (values.model !== undefined) body.model = values.model;
  if (values.trim !== undefined) body.trim = values.trim;
  if (values.mileage !== undefined && typeof values.mileage === "number" && !Number.isNaN(values.mileage)) body.mileage = values.mileage;
  if (values.color !== undefined) body.color = values.color;
  if (values.status !== undefined) body.status = values.status;

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

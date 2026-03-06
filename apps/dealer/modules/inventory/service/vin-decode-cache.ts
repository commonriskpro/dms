/**
 * Slice D: VIN decode with VinDecodeCache + NHTSA VPIC.
 * Validates VIN, checks cache, calls NHTSA if needed, upserts cache, returns normalized payload.
 */
import * as vinDecodeCacheDb from "../db/vin-decode-cache";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";

const VIN_LENGTH = 17;
const VIN_INVALID_CHARS = /[IOQ]/i;
const CACHE_TTL_DAYS = 30;
const NHTSA_BASE = process.env.NHTSA_API_URL ?? "https://vpic.nhtsa.dot.gov/api";

export type DecodeVinResult = {
  vin: string;
  decoded: boolean;
  vehicle: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    bodyStyle?: string;
    engine?: string;
    fuelType?: string;
    driveType?: string;
    transmission?: string;
  };
  source: string;
  cached: boolean;
};

function isValidVinFormat(vin: string): boolean {
  const normalized = vin.trim().toUpperCase();
  if (normalized.length !== VIN_LENGTH) return false;
  if (VIN_INVALID_CHARS.test(normalized)) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized);
}

type NhtsaResult = {
  Count?: number;
  Results?: Array<Record<string, string>>;
};

function mapNhtsaToVehicle(results: Array<Record<string, string>>): DecodeVinResult["vehicle"] {
  const r = results[0];
  if (!r) return {};
  const yearStr = r.ModelYear;
  let year: number | undefined;
  if (yearStr) {
    const parsed = parseInt(yearStr, 10);
    if (!isNaN(parsed)) year = parsed;
  }
  return {
    year,
    make: r.Make || undefined,
    model: r.Model || r.Series || undefined,
    trim: r.Trim || r.Trim2 || undefined,
    bodyStyle: r.BodyClass || undefined,
    engine: r.EngineCylinders ? `${r.EngineCylinders} ${r.EngineModel || ""}`.trim() || undefined : undefined,
    fuelType: r.FuelTypePrimary || undefined,
    driveType: r.DriveType || undefined,
    transmission: r.TransmissionStyle || undefined,
  };
}

async function fetchNhtsa(vin: string): Promise<NhtsaResult> {
  const url = `${NHTSA_BASE}/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NHTSA API error: ${res.status}`);
  return (await res.json()) as NhtsaResult;
}

export async function decodeVin(dealershipId: string, vin: string): Promise<DecodeVinResult> {
  await requireTenantActiveForRead(dealershipId);
  const normalized = vin.trim().toUpperCase();
  if (!isValidVinFormat(normalized)) {
    throw new ApiError("INVALID_VIN", "Invalid VIN format (17 alphanumeric characters, excluding I, O, Q)", {
      fieldErrors: { vin: ["Invalid VIN format"] },
    });
  }

  const decodedAfter = new Date();
  decodedAfter.setDate(decodedAfter.getDate() - CACHE_TTL_DAYS);

  const cached = await vinDecodeCacheDb.findCached(dealershipId, normalized, decodedAfter);
  if (cached) {
    return {
      vin: cached.vin,
      decoded: true,
      vehicle: {
        year: cached.year ?? undefined,
        make: cached.make ?? undefined,
        model: cached.model ?? undefined,
        trim: cached.trim ?? undefined,
        bodyStyle: cached.bodyStyle ?? undefined,
        engine: cached.engine ?? undefined,
        fuelType: cached.fuelType ?? undefined,
        driveType: cached.driveType ?? undefined,
        transmission: cached.transmission ?? undefined,
      },
      source: cached.source,
      cached: true,
    };
  }

  const body = await fetchNhtsa(normalized);
  const results = body.Results ?? [];
  const vehicle = results.length ? mapNhtsaToVehicle(results) : {};
  const rawJson = results[0] ? (results[0] as unknown) : undefined;

  await vinDecodeCacheDb.upsertCache({
    dealershipId,
    vin: normalized,
    year: vehicle.year ?? undefined,
    make: vehicle.make ?? undefined,
    model: vehicle.model ?? undefined,
    trim: vehicle.trim ?? undefined,
    bodyStyle: vehicle.bodyStyle ?? undefined,
    engine: vehicle.engine ?? undefined,
    fuelType: vehicle.fuelType ?? undefined,
    driveType: vehicle.driveType ?? undefined,
    transmission: vehicle.transmission ?? undefined,
    source: "NHTSA",
    rawJson,
  });

  return {
    vin: normalized,
    decoded: !!results.length,
    vehicle,
    source: "NHTSA",
    cached: false,
  };
}

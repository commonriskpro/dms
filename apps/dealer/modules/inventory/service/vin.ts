/**
 * NHTSA vPIC API VIN decode. No persistence; optional in-memory cache with short TTL.
 * See https://vpic.nhtsa.dot.gov/api/
 */
const NHTSA_BASE = process.env.NHTSA_API_URL ?? "https://vpic.nhtsa.dot.gov/api";
const VIN_CACHE_TTL_MS = 60 * 1000; // 1 minute
const cache = new Map<string, { result: VinDecodeResult; expiresAt: number }>();

export type VinDecodeResult = {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  [key: string]: string | number | undefined;
};

type NhtsaResult = {
  Count: number;
  Message?: string;
  Results?: Array<Record<string, string>>;
};

function mapNhtsaToFlat(results: Array<Record<string, string>>): VinDecodeResult {
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
    manufacturer: r.Manufacturer || undefined,
    vehicleType: r.VehicleType || undefined,
    bodyClass: r.BodyClass || undefined,
  };
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const normalized = vin.trim().toUpperCase();
  const cached = cache.get(normalized);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }
  const url = `${NHTSA_BASE}/vehicles/DecodeVinValues/${encodeURIComponent(normalized)}?format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`NHTSA API error: ${res.status}`);
  }
  const body = (await res.json()) as NhtsaResult;
  if (!body.Results?.length) {
    const result: VinDecodeResult = {};
    cache.set(normalized, { result, expiresAt: Date.now() + VIN_CACHE_TTL_MS });
    return result;
  }
  const result = mapNhtsaToFlat(body.Results);
  cache.set(normalized, { result, expiresAt: Date.now() + VIN_CACHE_TTL_MS });
  return result;
}

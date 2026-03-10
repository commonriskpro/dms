import { randomUUID } from "node:crypto";
import * as jose from "jose";
import { INTERNAL_API_AUD, INTERNAL_API_ISS } from "@dms/contracts";

const JWT_TTL_SEC = 90;
const workerInternalApiProfileEnabled = process.env.WORKER_INTERNAL_API_PROFILE === "1";

export type DealerInternalBridgeProfile = {
  totalMs: number;
  setupMs: number;
  signMs: number;
  fetchMs: number;
  parseMs: number;
  requestBytes: number;
  responseBytes: number;
  status: number;
  handlerMs: number | null;
  serviceMs: number | null;
  dbMs: number | null;
};

function getBaseUrl(): string {
  const url = process.env.DEALER_INTERNAL_API_URL;
  if (!url?.startsWith("http")) {
    throw new Error("DEALER_INTERNAL_API_URL not set or invalid");
  }
  return url.replace(/\/$/, "");
}

function getSecret(): Uint8Array {
  const secret = process.env.INTERNAL_API_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("INTERNAL_API_JWT_SECRET not set or too short");
  }
  return new TextEncoder().encode(secret);
}

async function createToken(jti: string): Promise<string> {
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(INTERNAL_API_AUD)
    .setIssuer(INTERNAL_API_ISS)
    .setJti(jti)
    .setExpirationTime(`${JWT_TTL_SEC}s`)
    .sign(getSecret());
}

export async function postDealerInternalJob<TResponse>(
  path: string,
  body: unknown
): Promise<TResponse> {
  const result = await postDealerInternalJobWithProfile<TResponse>(path, body);
  return result.data;
}

function readTimingHeader(response: Response, header: string): number | null {
  const raw = response.headers.get(header);
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

export async function postDealerInternalJobWithProfile<TResponse>(
  path: string,
  body: unknown
): Promise<{ data: TResponse; profile: DealerInternalBridgeProfile }> {
  const startedAt = Date.now();
  const setupStartedAt = Date.now();
  const jti = `worker-${path.replace(/[^a-z0-9]+/gi, "-")}-${randomUUID()}`;
  const signStartedAt = Date.now();
  const token = await createToken(jti);
  const signMs = Date.now() - signStartedAt;
  const requestId = randomUUID();
  const requestBody = JSON.stringify(body);
  const baseUrl = getBaseUrl();
  const setupMs = Date.now() - setupStartedAt;
  const fetchStartedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-request-id": requestId,
    },
    body: requestBody,
  });
  const fetchMs = Date.now() - fetchStartedAt;

  const parseStartedAt = Date.now();
  const json = (await response.json().catch(() => ({}))) as {
    data?: TResponse;
    error?: { message?: string; code?: string };
  };
  const parseMs = Date.now() - parseStartedAt;
  const profile: DealerInternalBridgeProfile = {
    totalMs: Date.now() - startedAt,
    setupMs,
    signMs,
    fetchMs,
    parseMs,
    requestBytes: requestBody.length,
    responseBytes: JSON.stringify(json ?? {}).length,
    status: response.status,
    handlerMs: readTimingHeader(response, "x-bridge-handler-ms"),
    serviceMs: readTimingHeader(response, "x-bridge-service-ms"),
    dbMs: readTimingHeader(response, "x-bridge-db-ms"),
  };

  if (!response.ok) {
    if (workerInternalApiProfileEnabled) {
      console.warn(
        `[worker/internal/profile] path=${path} status=${response.status} durationMs=${Date.now() - startedAt} requestBytes=${requestBody.length}`
      );
    }
    throw new Error(
      `[worker/internal] ${path} failed with ${response.status}: ${json.error?.message ?? response.statusText}`
    );
  }

  if (json.data === undefined) {
    throw new Error(`[worker/internal] ${path} returned no data payload`);
  }

  if (workerInternalApiProfileEnabled) {
    console.log(
      `[worker/internal/profile] path=${path} status=${response.status} durationMs=${Date.now() - startedAt} requestBytes=${requestBody.length}`
    );
  }

  return { data: json.data, profile };
}

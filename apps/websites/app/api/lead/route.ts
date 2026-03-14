/**
 * Proxies lead submissions to the dealer API.
 * The hostname (not dealershipId) is injected server-side for tenant resolution.
 * This prevents the browser from controlling tenant selection.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRequestHostname } from "@/lib/hostname";

const DEALER_API_URL = process.env.DEALER_API_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

    // Inject server-resolved hostname — never trust client-supplied tenant identifier
    const hostname = await getRequestHostname();

    // Build a clean payload: strip any client-supplied tenant identifiers, inject hostname
    const { dealershipId: _did, siteId: _sid, hostname: _h, ...rest } = body;
    void _did; void _sid; void _h;
    const enriched: Record<string, unknown> = { ...rest, hostname };

    const res = await fetch(`${DEALER_API_URL}/api/public/websites/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ip ? { "x-forwarded-for": ip } : {}),
        "user-agent": request.headers.get("user-agent") ?? "",
      },
      body: JSON.stringify(enriched),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to submit form. Please try again." } },
      { status: 500 }
    );
  }
}

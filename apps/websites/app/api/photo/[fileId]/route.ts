/**
 * Proxies vehicle photo requests to the dealer public photo endpoint.
 * Resolves hostname server-side and redirects to the signed URL so the browser never sees the dealer origin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRequestHostname } from "@/lib/hostname";

const DEALER_API_URL = process.env.DEALER_API_URL ?? "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const hostname = await getRequestHostname();

  const url = `${DEALER_API_URL}/api/public/websites/photo?fileId=${encodeURIComponent(fileId)}&hostname=${encodeURIComponent(hostname)}`;

  const res = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": request.headers.get("user-agent") ?? "",
      "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
    },
  });

  if (res.status === 302 && res.headers.get("location")) {
    return NextResponse.redirect(res.headers.get("location")!, 302);
  }

  if (res.status === 404) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Photo not found" } },
      { status: 404 }
    );
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after") ?? "60";
    return new NextResponse(null, { status: 429, headers: { "Retry-After": retryAfter } });
  }

  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Failed to load photo" } },
    { status: 500 }
  );
}

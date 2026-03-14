/**
 * Internal revalidation endpoint. Called by the dealer app after publish/rollback
 * when WEBSITES_REVALIDATE_URL and WEBSITES_REVALIDATE_SECRET are configured.
 * Validates secret and revalidates main public paths.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const REVALIDATE_SECRET = process.env.WEBSITES_REVALIDATE_SECRET;

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-revalidate-secret") ??
    (await request.json().catch(() => ({}))).secret;

  if (!REVALIDATE_SECRET || secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/contact");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");

  return NextResponse.json({ revalidated: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Magic link callback: exchanges code for session and redirects to /platform (or ?next=). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") ?? "/platform";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3001";
  return NextResponse.redirect(new URL(nextPath, base), 302);
}

import { NextRequest, NextResponse } from "next/server";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Magic link callback: exchanges code for session and redirects to /platform (or ?next=). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") ?? "/platform";

  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3001";
  const redirectTo = new URL(nextPath, base);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/platform/login?error=config", base), 302);
  }

  const res = NextResponse.redirect(redirectTo, 302);
  const supabase = await createPlatformSupabaseServerClient({
    forOAuthCallback: true,
    redirectResponse: res,
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/platform/login?error=${encodeURIComponent(error.message)}`, base),
        302
      );
    }
  }

  return res;
}

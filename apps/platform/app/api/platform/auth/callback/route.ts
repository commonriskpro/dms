import { NextRequest, NextResponse } from "next/server";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeInternalRedirectPath, getValidatedAppBaseUrl } from "@/lib/auth-redirect";
import { platformAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Magic link callback: exchanges code for session and redirects to /platform (or ?next=). Audits email_verified on success. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeInternalRedirectPath(searchParams.get("next"));
  const base = getValidatedAppBaseUrl(request);
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/platform/login?error=invalid_link", base), 302);
    }
    if (data?.user) {
      await platformAuditLog({
        actorPlatformUserId: data.user.id,
        action: "auth.email_verified",
        targetType: "auth",
      });
    }
  }

  return res;
}

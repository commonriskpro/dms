import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/** Safe redirect path: only allow relative paths, no open redirect. */
function getSafeRedirectPath(next: string | null): string {
  if (!next || typeof next !== "string") return "/";
  const path = next.trim();
  if (path.startsWith("//") || path.includes("\\")) return "/";
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return "/";
}

/**
 * GET /api/auth/callback
 * Handles Supabase auth callback (e.g. email verification or magic link when using ?code=).
 * Exchanges code for session, audits email_verified when applicable, redirects to next or /.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeRedirectPath(searchParams.get("next"));
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin);
  const redirectTo = new URL(nextPath, base);

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=invalid_link`, base), 302);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", base), 302);
  }

  if (data?.user) {
    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: data.user.id,
      action: "auth.email_verified",
      entity: "Auth",
      metadata: {},
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return NextResponse.redirect(redirectTo, 302);
}

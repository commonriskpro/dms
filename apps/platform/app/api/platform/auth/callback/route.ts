import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type CookieOption = { name: string; value: string; options?: Record<string, unknown> };

/** Magic link callback: exchanges code for session and redirects to /platform (or ?next=). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") ?? "/platform";

  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3001";
  const redirectTo = new URL(nextPath, base);

  const cookieStore = await cookies();
  const captured: CookieOption[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/platform/login?error=config", base), 302);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieOption[]) {
        cookiesToSet.forEach((c) => {
          captured.push(c);
          try {
            cookieStore.set(c.name, c.value, c.options);
          } catch {
            // ignore
          }
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/platform/login?error=${encodeURIComponent(error.message)}`, base), 302);
    }
  }

  const res = NextResponse.redirect(redirectTo, 302);
  captured.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options as Record<string, unknown>);
  });
  return res;
}

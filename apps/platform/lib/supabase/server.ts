import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type CookieOption = { name: string; value: string; options?: Record<string, unknown> };

export type CreatePlatformSupabaseServerClientOptions = {
  /** When true, getAll() returns [] to avoid stale cookies breaking code exchange (OAuth callback). */
  forOAuthCallback?: boolean;
  /** When set, setAll() writes to this response's cookies (OAuth callback redirect). */
  redirectResponse?: NextResponse;
};

/**
 * Single source of truth for server-side Supabase client in the platform app.
 * Uses next/headers cookies(); no decoding/filtering. getAll() and setAll() only.
 */
export async function createPlatformSupabaseServerClient(
  options?: CreatePlatformSupabaseServerClientOptions
) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const { forOAuthCallback = false, redirectResponse } = options ?? {};
  // cookieEncoding: "raw" must match browser client; avoids UTF-8 decode errors on stale cookies.
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieEncoding: "raw",
    cookies: {
      getAll() {
        if (forOAuthCallback) return [];
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieOption[]) {
        if (redirectResponse) {
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options as Record<string, unknown>)
          );
          return;
        }
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component; ignore
        }
      },
    },
  });
}

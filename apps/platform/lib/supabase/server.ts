import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieOption = { name: string; value: string; options?: Record<string, unknown> };

/** Only pass cookies that decode without throwing; avoids @supabase/ssr "stale cookie data" / UTF-8 warnings and session loss. */
function getValidSupabaseCookies(all: { name: string; value: string }[]): { name: string; value: string }[] {
  return all.filter(({ name, value }) => {
    if (!name.startsWith("sb-")) return false;
    try {
      const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
      const buf = Buffer.from(base64, "base64");
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return true;
    } catch {
      return false;
    }
  });
}

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return getValidSupabaseCookies(cookieStore.getAll());
      },
      setAll(cookiesToSet: CookieOption[]) {
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

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  // cookieEncoding: "raw" avoids "stale cookie data that does not decode to a UTF-8 string"
  // when cookies are corrupted or from an old deployment (must match server).
  return createBrowserClient(supabaseUrl, supabaseAnonKey, { cookieEncoding: "raw" });
}

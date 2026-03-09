import { createClient } from "@supabase/supabase-js";

/**
 * Verifies a Supabase JWT (access_token) and returns the user.
 * Used for Bearer-token auth (e.g. mobile). No cookies.
 */
export async function getUserFromBearerToken(
  accessToken: string
): Promise<{ id: string; email: string | undefined } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
  };
}

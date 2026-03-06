import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with service role key.
 * Use for admin operations (e.g. Storage upload, user lookup).
 * Never expose this client or key to the browser.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

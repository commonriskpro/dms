/**
 * Supabase Admin (service role) client for server-side only operations
 * (e.g. invite user by email). Never import this from client components or expose
 * SUPABASE_SERVICE_ROLE_KEY in client bundles.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.length < 1) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for platform user invite");
  }
  return key;
}

/**
 * Returns a Supabase client with service role. Use only in server-side code (API routes).
 * Never log or expose the key.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  const key = getServiceRoleKey();
  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

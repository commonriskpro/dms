import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Lazy-init Supabase client so env is only validated when auth is first used.
 */
export function getSupabase(): SupabaseClient {
  if (client == null) {
    client = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return client;
}


/**
 * Runtime env for mobile. All EXPO_PUBLIC_* are available at build/runtime.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const dealerApiUrl = process.env.EXPO_PUBLIC_DEALER_API_URL ?? "";

export function getSupabaseUrl(): string {
  return supabaseUrl;
}

export function getSupabaseAnonKey(): string {
  return supabaseAnonKey;
}

export function getDealerApiUrl(): string {
  return dealerApiUrl;
}

export function isEnvConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && dealerApiUrl);
}

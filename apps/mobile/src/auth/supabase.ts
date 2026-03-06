import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

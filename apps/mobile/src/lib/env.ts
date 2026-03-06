/**
 * Runtime env for mobile. All EXPO_PUBLIC_* are available at build/runtime.
 * Required vars are validated on first access; missing vars throw a clear ConfigError (no secret values).
 */

const REQUIRED_VARS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_DEALER_API_URL",
] as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

let validated = false;

function validateEnv(): void {
  if (validated) return;
  const missing: string[] = [];
  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (value == null || String(value).trim() === "") {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required env: ${missing.join(", ")}. Copy .env.example to .env and set values.`
    );
  }
  validated = true;
}

export function getSupabaseUrl(): string {
  validateEnv();
  return process.env.EXPO_PUBLIC_SUPABASE_URL!.trim();
}

export function getSupabaseAnonKey(): string {
  validateEnv();
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!.trim();
}

export function getDealerApiUrl(): string {
  validateEnv();
  return process.env.EXPO_PUBLIC_DEALER_API_URL!.trim();
}

export function isEnvConfigured(): boolean {
  try {
    validateEnv();
    return true;
  } catch {
    return false;
  }
}

/** Returns a user-safe error if config is invalid; null if valid. */
export function getConfigError(): ConfigError | null {
  try {
    validateEnv();
    return null;
  } catch (e) {
    return e instanceof ConfigError ? e : new ConfigError(String(e));
  }
}

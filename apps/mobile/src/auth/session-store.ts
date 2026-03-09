import * as SecureStore from "expo-secure-store";

const KEY_ACCESS_TOKEN = "dms_access_token";
const KEY_REFRESH_TOKEN = "dms_refresh_token";
const KEY_EXPIRES_AT = "dms_expires_at";

export async function saveSession(accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(KEY_EXPIRES_AT, String(expiresAt));
}

export async function getStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS_TOKEN);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
}

export async function getStoredExpiresAt(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(KEY_EXPIRES_AT);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(KEY_EXPIRES_AT);
}

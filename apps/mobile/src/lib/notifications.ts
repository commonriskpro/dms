/**
 * Push notification helpers. Registers device token with dealer backend POST /api/push/devices.
 * Backend must be running and accept token + platform "ios".
 * Set EXPO_PUBLIC_PUSH_ENABLED=false to disable (e.g. when no paid Apple Developer account).
 */
import * as Notifications from "expo-notifications";
import type { ApiClient } from "@/lib/api/client";

const PUSH_ENABLED =
  process.env.EXPO_PUBLIC_PUSH_ENABLED !== "false" &&
  process.env.EXPO_PUBLIC_PUSH_ENABLED !== "0";

export type RegisterPushResult =
  | { ok: true }
  | { ok: false; reason: "permission_denied" | "no_token" | "api_error"; message?: string };

/**
 * Requests notification permission, gets Expo push token, and registers it with the dealer API.
 * Safe to call on every app foreground or after login; backend dedupes by (userId, token).
 * No-ops and returns { ok: true } when EXPO_PUBLIC_PUSH_ENABLED is false.
 */
export async function registerPushTokenWithBackend(api: ApiClient): Promise<RegisterPushResult> {
  if (!PUSH_ENABLED) {
    return { ok: true };
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (existingStatus !== "granted") {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      status = requested;
    }
    if (status !== "granted") {
      return { ok: false, reason: "permission_denied", message: "Notification permission denied." };
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // uses app.json extra.eas.projectId if set; optional for development
    });
    const token = tokenResult?.data;
    if (!token || typeof token !== "string") {
      return { ok: false, reason: "no_token", message: "Could not get push token." };
    }

    const r = await api.post<{ data: { id: string } }>("/api/push/devices", {
      token,
      platform: "ios",
    });
    if (!r.ok) {
      return {
        ok: false,
        reason: "api_error",
        message: r.error?.message ?? "Failed to register device.",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      message: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

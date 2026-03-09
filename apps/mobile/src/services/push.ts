/**
 * Push notification service. All behavior is no-op when ENABLE_PUSH_NOTIFICATIONS is false.
 * When enabled: registers for push, obtains Expo push token, and can send to backend (when endpoint exists).
 * Backend dependency (when enabled): POST /api/me/device-tokens or equivalent to store token for the user.
 * Not implemented on backend yet — document and no-op or fail gracefully.
 */

import { getPushFeatureEnabled } from "@/config/features";
import { Platform } from "react-native";

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: "disabled" | "permission_denied" | "config_missing" | "error"; message?: string };

/**
 * Register for push notifications and return Expo push token, only when feature is enabled.
 * When disabled, returns immediately with ok: false, reason: "disabled".
 * Does not request permission when disabled.
 */
export async function registerForPushIfEnabled(): Promise<PushRegistrationResult> {
  if (!getPushFeatureEnabled()) {
    return { ok: false, reason: "disabled" };
  }
  try {
    const { getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync } = await import(
      "expo-notifications"
    );
    const { default: Constants } = await import("expo-constants");
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { ok: false, reason: "config_missing", message: "EAS project ID not configured" };
    }
    const { status: existing } = await getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const { status: requested } = await requestPermissionsAsync();
      status = requested;
    }
    if (status !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }
    const tokenData = await getExpoPushTokenAsync({
      projectId,
      ...(Platform.OS === "android" && { applicationId: Constants.expoConfig?.android?.package }),
    });
    const token = tokenData?.data ?? "";
    if (!token) {
      return { ok: false, reason: "error", message: "No token returned" };
    }
    return { ok: true, token };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}

/**
 * Setup notification response listener (tap on notification → deep link / navigate).
 * Only runs when feature is enabled. No-op when disabled.
 * Backend dependency: notification payload should include target route (e.g. customer id, deal id).
 */
export function setupNotificationListenersIfEnabled(_onResponse?: (response: unknown) => void): () => void {
  if (!getPushFeatureEnabled()) {
    return () => {};
  }
  let subscription: { remove: () => void } | null = null;
  import("expo-notifications")
    .then((notifications) => {
      subscription = notifications.addNotificationResponseReceivedListener((response) => {
        _onResponse?.(response);
        // Future: parse response.notification.request.content.data and navigate to customer/deal/dashboard
      });
    })
    .catch(() => {});
  return () => {
    subscription?.remove();
  };
}

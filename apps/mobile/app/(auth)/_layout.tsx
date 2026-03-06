import { useEffect } from "react";
import { Linking } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function AuthLayout() {
  const router = useRouter();

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      if (url.includes("reset-password")) {
        router.replace("/(auth)/reset-password");
        return;
      }
      if (url.includes("accept-invite")) {
        try {
          const parsed = new URL(url);
          const token = parsed.searchParams.get("token");
          if (token) {
            router.replace({ pathname: "/(auth)/accept-invite", params: { token } });
          }
        } catch {
          // ignore URL parse errors
        }
      }
    });
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

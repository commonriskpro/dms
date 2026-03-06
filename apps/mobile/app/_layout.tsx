import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/auth/use-auth";

const queryClient = new QueryClient();

function AuthGate() {
  const { state, isAuthenticated } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (state.status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }
    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [state.status, isAuthenticated, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/auth/auth-context";
import { setOnUnauthorized } from "@/api/on-unauthorized";
import { getPendingInviteToken, clearPendingInviteToken } from "@/features/auth/pending-invite";
import { ConfigErrorScreen } from "@/components/config-error-screen";
import { getConfigError } from "@/lib/env";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

function AuthGate() {
  const { state, isAuthenticated, signOut } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    setOnUnauthorized(() => {
      signOut();
    });
    return () => setOnUnauthorized(null);
  }, [signOut]);

  useEffect(() => {
    if (state.status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }
    if (isAuthenticated && inAuthGroup) {
      const pendingToken = getPendingInviteToken();
      if (pendingToken) {
        clearPendingInviteToken();
        router.replace({ pathname: "/(auth)/accept-invite", params: { token: pendingToken } });
        return;
      }
      router.replace("/(tabs)");
    }
  }, [state.status, isAuthenticated, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [configError] = useState<Error | null>(() => getConfigError());

  if (configError) {
    return <ConfigErrorScreen error={configError} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider queryClient={queryClient}>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

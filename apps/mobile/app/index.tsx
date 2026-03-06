import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/auth/use-auth";

export default function Index() {
  const router = useRouter();
  const { state, isAuthenticated } = useAuth();

  useEffect(() => {
    if (state.status === "loading") return;
    if (isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/login");
    }
  }, [state.status, isAuthenticated, router]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

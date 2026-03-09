import { View, Text, StyleSheet } from "react-native";
import { ConfigError } from "@/lib/env";

export function ConfigErrorScreen({ error }: { error: unknown }) {
  const message =
    error instanceof ConfigError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Invalid configuration";
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Configuration needed</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>
        Copy .env.example to .env in apps/mobile and set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and EXPO_PUBLIC_DEALER_API_URL.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
});

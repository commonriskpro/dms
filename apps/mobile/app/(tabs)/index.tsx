import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, type MeResponse } from "@/api/endpoints";
import { useAuth } from "@/auth/use-auth";

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { state, session } = useAuth();

  const canQueryMe =
    state.status === "authenticated" && !!session?.accessToken;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: canQueryMe,
  });

  const onRefresh = useCallback(async () => {
    if (!canQueryMe) return;
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [canQueryMe, refetch]);

  if (state.status === "loading") {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading session…</Text>
      </View>
    );
  }

  if (state.status !== "authenticated") {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Waiting for sign-in…</Text>
      </View>
    );
  }

  if ((isLoading || isFetching) && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          {error instanceof Error ? error.message : "Something went wrong"}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const me = data as MeResponse | undefined;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.card}>
        <Text style={styles.label}>Welcome</Text>
        <Text style={styles.value}>{me?.user?.email ?? "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Dealership</Text>
        <Text style={styles.value}>
          {me?.dealership?.name ?? me?.dealership?.id ?? "—"}
        </Text>
      </View>

      {me?.permissions && me.permissions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Permissions</Text>
          <Text style={styles.small}>{me.permissions.join(", ")}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  muted: { color: "#666", fontSize: 16 },
  error: { color: "#c00", fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: { fontSize: 18, fontWeight: "600" },
  small: { fontSize: 14, color: "#444" },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
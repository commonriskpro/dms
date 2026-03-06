import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/endpoints";

function safeId(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function DealDetailScreen() {
  const raw = useLocalSearchParams<{ id: string }>();
  const id = safeId(raw.id);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deals", id],
    queryFn: () => api.getDealById(id!),
    enabled: Boolean(id),
  });

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid deal</Text>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error instanceof Error ? error.message : "Something went wrong"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const deal = data?.data;
  if (!deal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Deal not found</Text>
      </View>
    );
  }

  const d = deal as { status?: string; salePriceCents?: string; totalDueCents?: string };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{d.status ?? "—"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Sale price</Text>
        <Text style={styles.value}>
          {d.salePriceCents != null ? `$${(Number(d.salePriceCents) / 100).toFixed(2)}` : "—"}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Total due</Text>
        <Text style={styles.value}>
          {d.totalDueCents != null ? `$${(Number(d.totalDueCents) / 100).toFixed(2)}` : "—"}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Quick actions</Text>
        <Text style={styles.muted}>Placeholder — finance, documents, status</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#666", fontSize: 14 },
  error: { color: "#c00", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: "#666", marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 16, fontWeight: "500" },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/endpoints";

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", id],
    queryFn: () => api.getInventoryById(id!),
    enabled: Boolean(id),
  });

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid vehicle</Text>
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
        <Text style={styles.error}>{error instanceof Error ? error.message : "Failed to load"}</Text>
      </View>
    );
  }

  const vehicle = data?.data;
  if (!vehicle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Vehicle not found</Text>
      </View>
    );
  }

  const subtitle = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Stock #</Text>
        <Text style={styles.value}>{vehicle.stockNumber}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.value}>{subtitle || "—"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>VIN</Text>
        <Text style={styles.value}>{vehicle.vin ?? "—"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{vehicle.status}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Photos</Text>
        <Text style={styles.muted}>Media section placeholder — future photo capture/upload</Text>
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
});

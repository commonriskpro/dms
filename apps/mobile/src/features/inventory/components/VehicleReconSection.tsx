import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { VehicleReconResponse } from "@/api/endpoints";
import { formatCentsToDisplay } from "../utils";

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12, textTransform: "uppercase" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rowLast: { marginBottom: 0 },
  label: { fontSize: 12, color: "#666" },
  value: { fontSize: 14, fontWeight: "500" },
  lineItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#eee", flexDirection: "row", justifyContent: "space-between" },
});

export function VehicleReconSection({
  recon,
  isLoading,
}: {
  recon: VehicleReconResponse["data"];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Recon</Text>
        <View style={styles.empty}>
          <ActivityIndicator size="small" />
        </View>
      </View>
    );
  }
  if (!recon) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Recon</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recon record</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Recon</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{recon.status}</Text>
        </View>
        {recon.dueDate != null && (
          <View style={styles.row}>
            <Text style={styles.label}>Due date</Text>
            <Text style={styles.value}>{new Date(recon.dueDate).toLocaleDateString()}</Text>
          </View>
        )}
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>{formatCentsToDisplay(recon.totalCents)}</Text>
        </View>
        {recon.lineItems?.length > 0 &&
          recon.lineItems.map((li) => (
            <View key={li.id} style={styles.lineItem}>
              <Text style={styles.label}>{li.description}</Text>
              <Text style={styles.value}>{formatCentsToDisplay(li.costCents)}</Text>
            </View>
          ))}
      </View>
    </View>
  );
}

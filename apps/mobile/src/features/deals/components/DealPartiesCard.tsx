import { View, Text, StyleSheet } from "react-native";
import type { DealDetail } from "../types";

function vehicleSubtitle(v: DealDetail["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? `${parts.join(" ")} · ${v.stockNumber}` : v.stockNumber;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 10 },
  block: { marginBottom: 12 },
  label: { fontSize: 12, color: "#666", marginBottom: 2 },
  value: { fontSize: 16, fontWeight: "500" },
});

export function DealPartiesCard({ deal }: { deal: DealDetail }) {
  const customerName = deal.customer?.name ?? "—";
  const vehicleLine = vehicleSubtitle(deal.vehicle);
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Parties</Text>
      <View style={styles.block}>
        <Text style={styles.label}>Customer</Text>
        <Text style={styles.value}>{customerName}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.value}>{vehicleLine}</Text>
      </View>
    </View>
  );
}

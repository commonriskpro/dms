import { View, Text, StyleSheet } from "react-native";
import type { VehicleDetail } from "@/api/endpoints";
import { formatCentsToDisplay } from "../utils";

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: "#666", marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 18, fontWeight: "600" },
  row: { marginBottom: 8 },
  rowLast: { marginBottom: 0 },
});

export function VehiclePricingCard({ vehicle }: { vehicle: VehicleDetail }) {
  const salePrice = vehicle.salePriceCents != null ? formatCentsToDisplay(vehicle.salePriceCents) : "—";
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Pricing</Text>
      <View style={[styles.row, styles.rowLast]}>
        <Text style={styles.label}>Sale price</Text>
        <Text style={styles.value}>{salePrice}</Text>
      </View>
    </View>
  );
}

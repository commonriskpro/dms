import { View, Text, StyleSheet } from "react-native";
import type { VehicleDetail } from "@/api/endpoints";
import { formatMileage } from "../utils";

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: "#666", marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 16, fontWeight: "500" },
  row: { marginBottom: 12 },
  rowLast: { marginBottom: 0 },
});

export function VehicleOverviewCard({ vehicle }: { vehicle: VehicleDetail }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Overview</Text>
      <View style={styles.row}>
        <Text style={styles.label}>VIN</Text>
        <Text style={styles.value}>{vehicle.vin ?? "—"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Stock #</Text>
        <Text style={styles.value}>{vehicle.stockNumber ?? "—"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Mileage</Text>
        <Text style={styles.value}>{formatMileage(vehicle.mileage)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Color</Text>
        <Text style={styles.value}>{vehicle.color ?? "—"}</Text>
      </View>
      <View style={[styles.row, styles.rowLast]}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{vehicle.status ?? "—"}</Text>
      </View>
    </View>
  );
}
